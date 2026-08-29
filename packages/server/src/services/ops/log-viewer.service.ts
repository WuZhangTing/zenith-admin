import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { getRemoteExecutor, resolveExecutor } from '../../lib/host-exec';

const execFileAsync = promisify(execFile);

/** 验证路径安全性（防止路径穿越） */
export function validateLogPath(filePath: string): void {
  const normalized = nodePath.normalize(filePath);
  if (normalized.includes('..') || normalized !== filePath.replaceAll('\\', '/').replace(/\/$/, '')) {
    // Allow absolute paths only
    if (!nodePath.isAbsolute(normalized)) throw new Error('路径必须为绝对路径');
  }
}

/** 读取文件末尾 N 行 */
export async function readLastLines(filePath: string, lines: number, hostId?: number | null): Promise<string> {
  validateLogPath(filePath);
  if (hostId != null) {
    return (await (await resolveExecutor(hostId)).exec(
      'tail',
      ['-n', String(lines), '--', filePath],
      { timeoutMs: 10000, maxBuffer: 20 * 1024 * 1024 },
    )).stdout;
  }
  try {
    const { stdout } = await execFileAsync('tail', ['-n', String(lines), '--', filePath], {
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 20, // 20 MB
    });
    return stdout;
  } catch {
    // Windows/无 tail 回退：直接读取文件
    const content = await fs.promises.readFile(filePath, 'utf8');
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
  validateLogPath(filePath);
  return (await resolveExecutor(hostId)).execStream(
    'tail',
    ['-f', '-n', '0', '--', filePath],
    { onData, onExit },
  );
}

/** 为下载读取日志文件（容量上限保护），返回文件名与可读流 */
export async function openLogForDownload(
  filePath: string,
  maxBytes = 100 * 1024 * 1024,
  hostId?: number | null,
): Promise<{ filename: string; size: number; stream: NodeJS.ReadableStream & { destroy(): void } }> {
  validateLogPath(filePath);
  if (hostId != null) {
    const lease = await (await getRemoteExecutor(hostId)).acquireSftp();
    const sftp = lease.sftp;
    let stat: { size: number; isFile(): boolean };
    try {
      stat = await new Promise<{ size: number; isFile(): boolean }>((resolve, reject) => {
        sftp.stat(filePath, (err, attrs) => err ? reject(err) : resolve(attrs));
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
    const stream = sftp.createReadStream(filePath) as NodeJS.ReadableStream & { destroy(): void };
    stream.once('close', lease.release);
    stream.once('error', lease.release);
    stream.once('end', lease.release);
    return {
      filename: nodePath.posix.basename(filePath),
      size: stat.size,
      stream,
    };
  }
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error('目标不是文件');
  if (stat.size > maxBytes) throw new Error(`文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），超出下载上限 ${maxBytes / 1024 / 1024}MB`);
  return { filename: nodePath.basename(filePath), size: stat.size, stream: fs.createReadStream(filePath) };
}
