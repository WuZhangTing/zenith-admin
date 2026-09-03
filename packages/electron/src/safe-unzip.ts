/**
 * 热更包安全解压。
 *
 * 替代 extract-zip（GHSA-jmr9-qjv8-65gv：符号链接条目可越界写入，上游无修复）：
 * - 拒绝符号链接 / 非常规文件条目、绝对路径、`..`、反斜杠与控制字符
 * - 每个条目的落地路径必须位于目标目录内（解析后再比对）
 * - 限制条目数、单文件与总解压体积，防 zip 炸弹
 * - 条目在 zip 中声明的未压缩大小与实际写入字节数不一致即失败
 */
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

const MAX_ENTRIES = 20_000;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
/** Unix 文件类型位（externalFileAttributes 高 16 位） */
const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;

// eslint-disable-next-line no-control-regex
const UNSAFE_NAME_RE = /[\u0000-\u001F\\]|^\/|^[A-Za-z]:|(^|\/)\.\.(\/|$)/;

function openZip(file: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (err, zip) => {
      if (err || !zip) reject(err ?? new Error('无法打开 zip'));
      else resolve(zip);
    });
  });
}

function openStream(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
      if (err || !stream) reject(err ?? new Error('无法读取 zip 条目'));
      else resolve(stream);
    });
  });
}

function entryMode(entry: Entry): number {
  return (entry.externalFileAttributes >>> 16) & 0xffff;
}

function assertSafeEntry(entry: Entry, targetDir: string): string {
  const name = entry.fileName;
  if (!name || UNSAFE_NAME_RE.test(name)) {
    throw new Error(`热更包包含非法路径条目：${name}`);
  }
  const mode = entryMode(entry);
  const type = mode & S_IFMT;
  // 非 Unix 打包器（如 Windows）type 为 0，按常规文件 / 目录处理；其余类型（符号链接、设备等）一律拒绝
  if (type !== 0 && type !== S_IFREG && type !== S_IFDIR) {
    throw new Error(`热更包包含非常规文件条目（符号链接等）：${name}`);
  }
  const dest = path.resolve(targetDir, name);
  const root = path.resolve(targetDir) + path.sep;
  if (dest !== path.resolve(targetDir) && !dest.startsWith(root)) {
    throw new Error(`热更包条目越出目标目录：${name}`);
  }
  if (entry.uncompressedSize > MAX_FILE_BYTES) {
    throw new Error(`热更包条目过大：${name}`);
  }
  return dest;
}

/** 将 zip 安全解压到 targetDir（目录须为空或不存在）。任何校验失败都会抛错，调用方负责清理。 */
export async function safeExtractZip(zipPath: string, targetDir: string): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });
  const zip = await openZip(zipPath);
  let entries = 0;
  let totalBytes = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry: Entry) => {
        void (async () => {
          if (++entries > MAX_ENTRIES) throw new Error('热更包条目数超过上限');
          const dest = assertSafeEntry(entry, targetDir);
          const isDir = entry.fileName.endsWith('/') || (entryMode(entry) & S_IFMT) === S_IFDIR;
          if (isDir) {
            await fs.mkdir(dest, { recursive: true });
            zip.readEntry();
            return;
          }
          totalBytes += entry.uncompressedSize;
          if (totalBytes > MAX_TOTAL_BYTES) throw new Error('热更包解压体积超过上限');
          await fs.mkdir(path.dirname(dest), { recursive: true });
          const stream = await openStream(zip, entry);
          let written = 0;
          stream.on('data', (chunk: Buffer) => {
            written += chunk.length;
            if (written > entry.uncompressedSize) stream.emit('error', new Error(`热更包条目实际大小与声明不符：${entry.fileName}`));
          });
          // 只保留常规文件权限位，去掉 setuid / setgid / sticky
          const mode = (entryMode(entry) & 0o777) || 0o644;
          await pipeline(stream, createWriteStream(dest, { mode, flags: 'wx' }));
          zip.readEntry();
        })().catch((err) => {
          zip.close();
          reject(err);
        });
      });
      zip.readEntry();
    });
  } finally {
    zip.close();
  }
}
