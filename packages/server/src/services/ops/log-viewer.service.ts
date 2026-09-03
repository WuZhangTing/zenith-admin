/**
 * 日志查看器：只允许读取白名单目录内的常规文件。
 *
 * 白名单 = 应用日志目录（LOG_DIR）+ LOG_VIEWER_ROOTS（默认非 Windows 为 /var/log）。
 * 本机路径先 realpath 再做目录包含判定（防符号链接逃逸），且必须是常规文件（拒绝 /dev/*、FIFO）；
 * 远端主机无法 realpath，按 POSIX 规范化后做字符串包含判定（远端符号链接逃逸需要远端 root，不在本模型内）。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { HTTPException } from 'hono/http-exception';
import { config } from '../../config';
import { getRemoteExecutor, resolveExecutor } from '../../lib/host-exec';

const execFileAsync = promisify(execFile);

/** 本机允许目录（绝对路径，已 resolve）：应用日志目录 + 配置白名单 */
export function getLocalLogRoots(): string[] {
  const roots = [nodePath.resolve(config.log.dir), ...config.log.viewerRoots.map((r) => nodePath.resolve(r))];
  return Array.from(new Set(roots));
}

/** 远端允许目录（POSIX 绝对路径）：仅配置白名单中的 POSIX 路径 */
export function getRemoteLogRoots(): string[] {
  return Array.from(new Set(config.log.viewerRoots
    .filter((r) => r.startsWith('/'))
    .map((r) => nodePath.posix.normalize(r).replace(/\/+$/, '') || '/')));
}

function isWithin(target: string, root: string, sep: string): boolean {
  return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * 校验并规范化日志路径。通过则返回应实际读取的路径（本机为 realpath），否则抛 HTTPException：
 * 400 非绝对路径 / 403 目录白名单外 / 404 文件不存在 / 400 非常规文件。
 */
export async function resolveAllowedLogPath(filePath: string, hostId?: number | null): Promise<string> {
  const input = filePath.trim();
  if (!input) throw new HTTPException(400, { message: '参数 path 不能为空' });

  if (hostId != null) {
    if (!input.startsWith('/')) throw new HTTPException(400, { message: '路径必须为绝对路径' });
    const normalized = nodePath.posix.normalize(input);
    if (normalized.split('/').includes('..')) throw new HTTPException(400, { message: '路径不合法' });
    const roots = getRemoteLogRoots();
    if (!roots.some((root) => isWithin(normalized, root, '/'))) {
      throw new HTTPException(403, { message: `仅允许读取以下目录内的日志：${roots.join('、') || '（未配置 LOG_VIEWER_ROOTS）'}` });
    }
    return normalized;
  }

  if (!nodePath.isAbsolute(input)) throw new HTTPException(400, { message: '路径必须为绝对路径' });
  const roots = getLocalLogRoots();
  let real: string;
  try {
    real = await fs.promises.realpath(input);
  } catch {
    // 不存在的文件也先做白名单判定，避免用 404 / 403 差异探测目录外文件是否存在
    const resolved = nodePath.resolve(input);
    if (!roots.some((root) => isWithin(resolved, root, nodePath.sep))) {
      throw new HTTPException(403, { message: `仅允许读取以下目录内的日志：${roots.join('、')}` });
    }
    throw new HTTPException(404, { message: '日志文件不存在' });
  }
  const realRoots = await Promise.all(roots.map((root) => fs.promises.realpath(root).catch(() => root)));
  if (!realRoots.some((root) => isWithin(real, root, nodePath.sep))) {
    throw new HTTPException(403, { message: `仅允许读取以下目录内的日志：${roots.join('、')}` });
  }
  const stat = await fs.promises.stat(real);
  if (!stat.isFile()) throw new HTTPException(400, { message: '目标不是常规文件' });
  return real;
}

/** 读取文件末尾 N 行 */
export async function readLastLines(filePath: string, lines: number, hostId?: number | null): Promise<string> {
  const target = await resolveAllowedLogPath(filePath, hostId);
  if (hostId != null) {
    return (await (await resolveExecutor(hostId)).exec(
      'tail',
      ['-n', String(lines), '--', target],
      { timeoutMs: 10000, maxBuffer: 20 * 1024 * 1024 },
    )).stdout;
  }
  try {
    const { stdout } = await execFileAsync('tail', ['-n', String(lines), '--', target], {
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 20, // 20 MB
    });
    return stdout;
  } catch {
    // Windows/无 tail 回退：直接读取文件
    const content = await fs.promises.readFile(target, 'utf8');
    const allLines = content.split('\n');
    return allLines.slice(Math.max(0, allLines.length - lines)).join('\n');
  }
}

/** 流式 tail -f（实时追踪，本机 / 远端统一回调接口） */
export async function spawnTailFollow(
  filePath: string,
  onData: (chunk: string) => void,
  onExit: (code: number | null) => void,
  hostId?: number | null,
): Promise<{ kill: () => void }> {
  const target = await resolveAllowedLogPath(filePath, hostId);
  return (await resolveExecutor(hostId)).execStream(
    'tail',
    ['-f', '-n', '0', '--', target],
    { onData, onExit },
  );
}

/** 为下载读取日志文件（容量上限保护），返回文件名与可读流 */
export async function openLogForDownload(
  filePath: string,
  maxBytes = 100 * 1024 * 1024,
  hostId?: number | null,
): Promise<{ filename: string; size: number; stream: NodeJS.ReadableStream & { destroy(): void } }> {
  const target = await resolveAllowedLogPath(filePath, hostId);
  if (hostId != null) {
    const lease = await (await getRemoteExecutor(hostId)).acquireSftp();
    const sftp = lease.sftp;
    let stat: { size: number; isFile(): boolean };
    try {
      stat = await new Promise<{ size: number; isFile(): boolean }>((resolve, reject) => {
        sftp.stat(target, (err, attrs) => err ? reject(err) : resolve(attrs));
      });
    } catch (err) {
      lease.release();
      throw err;
    }
    if (!stat.isFile()) {
      lease.release();
      throw new Error('目标不是文件');
    }
    if (stat.size > maxBytes) {
      lease.release();
      throw new Error(`文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），超出下载上限 ${maxBytes / 1024 / 1024}MB`);
    }
    const stream = sftp.createReadStream(target) as NodeJS.ReadableStream & { destroy(): void };
    stream.once('close', lease.release);
    stream.once('error', lease.release);
    stream.once('end', lease.release);
    return {
      filename: nodePath.posix.basename(target),
      size: stat.size,
      stream,
    };
  }
  const stat = await fs.promises.stat(target);
  if (stat.size > maxBytes) throw new Error(`文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），超出下载上限 ${maxBytes / 1024 / 1024}MB`);
  return { filename: nodePath.basename(target), size: stat.size, stream: fs.createReadStream(target) };
}
