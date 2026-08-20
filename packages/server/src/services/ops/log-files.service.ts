import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { config } from '../../config';
import { formatDateTime } from '../../lib/datetime';

export const LOG_DIR = path.resolve(config.log.dir);

/**
 * 安全校验文件名：防止路径穿越。
 * 返回 null 表示非法文件名。
 */
export function safeFilename(filename: string): string | null {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.startsWith('.')) {
    return null;
  }
  return filename;
}

/** 解析文件完整路径并验证在 LOG_DIR 内（双重保护） */
export function resolveLogPath(filename: string): string | null {
  const resolved = path.resolve(LOG_DIR, filename);
  if (!resolved.startsWith(LOG_DIR + path.sep) && resolved !== LOG_DIR) {
    return null;
  }
  return resolved;
}

/** 固定容量环形缓冲：流式读取时只保留最后 N 行，避免整文件驻留内存 */
class TailRingBuffer {
  private readonly buf: string[];
  private idx = 0;
  private filled = false;

  constructor(private readonly capacity: number) {
    this.buf = new Array<string>(capacity);
  }

  push(line: string): void {
    this.buf[this.idx] = line;
    this.idx = (this.idx + 1) % this.capacity;
    if (this.idx === 0) this.filled = true;
  }

  toArray(): string[] {
    return this.filled
      ? [...this.buf.slice(this.idx), ...this.buf.slice(0, this.idx)]
      : this.buf.slice(0, this.idx);
  }
}

export interface ReadLogOptions {
  keyword?: string;
  /** keyword 命中行前后额外保留的上下文行数（0-10，仅 keyword 存在时生效） */
  context?: number;
}

/**
 * 流式读取日志最后 N 行（普通文本与 gzip 统一入口）。
 * 逐行经过环形缓冲，峰值内存 O(N)，替代旧的全量 readFile/gunzip 方案（大文件 OOM 风险）。
 */
async function readTailLinesStream(filepath: string, n: number, opts: ReadLogOptions = {}): Promise<string[]> {
  const keyword = opts.keyword?.trim().toLowerCase();
  const context = keyword ? Math.max(0, Math.min(opts.context ?? 0, 10)) : 0;

  const source = fs.createReadStream(filepath);
  const input = filepath.endsWith('.gz') ? source.pipe(zlib.createGunzip()) : source;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  const ring = new TailRingBuffer(n);
  // 上下文窗口：before 保留匹配前的候选行，afterRemaining 统计匹配后还需保留的行数
  const before: string[] = [];
  let afterRemaining = 0;

  try {
    for await (const line of rl) {
      if (line.trim() === '') continue;
      if (!keyword) {
        ring.push(line);
        continue;
      }
      if (line.toLowerCase().includes(keyword)) {
        for (const b of before) ring.push(b);
        before.length = 0;
        ring.push(line);
        afterRemaining = context;
      } else if (afterRemaining > 0) {
        ring.push(line);
        afterRemaining -= 1;
      } else if (context > 0) {
        before.push(line);
        if (before.length > context) before.shift();
      }
    }
  } finally {
    rl.close();
    source.destroy();
  }
  return ring.toArray();
}

export async function readLastLines(filepath: string, n: number, keyword?: string, context?: number): Promise<string[]> {
  return readTailLinesStream(filepath, n, { keyword, context });
}

/** 可中止的延时（abort 时提前 resolve） */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const onAbort = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 轮询文件新增内容并回调，直到 signal 中止（全程异步 I/O，await 回调形成背压） */
export async function watchTail(
  filepath: string,
  signal: AbortSignal,
  initialPosition: number,
  onLines: (lines: string[], newPosition: number) => Promise<void>,
): Promise<void> {
  let position = initialPosition;
  while (!signal.aborted) {
    await sleep(1000, signal);
    if (signal.aborted) return;

    let stat: Awaited<ReturnType<typeof fsp.stat>>;
    try {
      stat = await fsp.stat(filepath);
    } catch {
      return; // 文件被删除/轮转
    }
    if (stat.size <= position) continue;

    const newBytes = stat.size - position;
    const buf = Buffer.alloc(newBytes);
    const fh = await fsp.open(filepath, 'r');
    try {
      await fh.read(buf, 0, newBytes, position);
    } finally {
      await fh.close();
    }
    position = stat.size;
    const newLines = buf.toString('utf-8').split(/\r?\n/).filter(l => l.trim() !== '');
    if (newLines.length > 0) {
      await onLines(newLines, position);
    }
  }
}

// ─── 业务逻辑 ─────────────────────────────────────────────────────────────────
import { HTTPException } from 'hono/http-exception';

export async function listLogFiles() {
  let entries;
  try {
    entries = await fsp.readdir(LOG_DIR, { withFileTypes: true });
  } catch {
    return []; // 日志目录尚未创建
  }
  const logEntries = entries.filter(e => e.isFile() && (e.name.endsWith('.log') || e.name.endsWith('.log.gz')));
  const files = await Promise.all(logEntries.map(async (e) => {
    const stat = await fsp.stat(path.join(LOG_DIR, e.name));
    return {
      name: e.name,
      size: stat.size,
      modifiedAt: formatDateTime(stat.mtime),
      isGzip: e.name.endsWith('.gz'),
    };
  }));
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function readLogFileLines(filename: string, lines: number, keyword?: string, context?: number) {
  const { filepath } = await resolveLogFile(filename);
  return readTailLinesStream(filepath, lines, { keyword, context });
}

export async function deleteLogFile(filename: string) {
  const { filepath } = await resolveLogFile(filename);
  await fsp.unlink(filepath);
}

export async function getLogFileBeforeAudit(filename: string) {
  const { name, filepath } = await resolveLogFile(filename);
  const stat = await fsp.stat(filepath);
  return {
    name,
    size: stat.size,
    modifiedAt: formatDateTime(stat.mtime),
    isGzip: name.endsWith('.gz'),
  };
}

export async function resolveLogFile(filename: string) {
  const name = safeFilename(filename);
  if (!name) throw new HTTPException(400, { message: '无效的文件名' });
  const filepath = resolveLogPath(name);
  if (!filepath) throw new HTTPException(404, { message: '文件不存在' });
  try {
    await fsp.access(filepath);
  } catch {
    throw new HTTPException(404, { message: '文件不存在' });
  }
  return { name, filepath };
}
