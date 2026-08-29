/**
 * 平台运维主机 SFTP 文件服务。
 *
 * 与用户私有 ssh-sftp 不共用授权/连接池：连接由 host-exec 按 hostId 管理，
 * 此层在 raw ssh2 SFTPWrapper 上实现文件操作，并按主机串行化写操作。
 */
import { posix as posixPath } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SFTPWrapper, Stats } from 'ssh2';
import { HTTPException } from 'hono/http-exception';
import { getRemoteExecutor } from '../../lib/host-exec';
import { formatDateTime } from '../../lib/datetime';
import { MAX_EDIT_SIZE, assertNotStale, fileEtag, isBinaryBuffer } from '../../lib/fs-text';
import { assertUploadSizeWithinLimit } from './terminal-files.service';

export interface HostFileEntry {
  name: string;
  path: string;
  type: 'dir' | 'file';
  size: number;
  mtime: string;
  permissions?: string;
}

/** 每台主机写操作串行化，避免 rename/delete/upload 交错 */
const mutexes = new Map<number, Promise<unknown>>();

async function withSftp<T>(hostId: number, fn: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
  const tail = mutexes.get(hostId) ?? Promise.resolve();
  const run = tail.then(async () => {
    const lease = await (await getRemoteExecutor(hostId)).acquireSftp();
    try {
      return await fn(lease.sftp);
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(400, { message: `SFTP 操作失败: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      lease.release();
    }
  });
  mutexes.set(hostId, run.catch(() => undefined));
  return run;
}

function modeString(mode: number): string {
  const chars = ['r', 'w', 'x'];
  let result = '';
  for (let shift = 8; shift >= 0; shift -= 1) {
    result += (mode & (1 << shift)) ? chars[(8 - shift) % 3] : '-';
  }
  return result;
}

function statAsync(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => sftp.stat(path, (err, attrs) => err ? reject(err) : resolve(attrs)));
}

function lstatAsync(sftp: SFTPWrapper, path: string): Promise<Stats> {
  return new Promise((resolve, reject) => sftp.lstat(path, (err, attrs) => err ? reject(err) : resolve(attrs)));
}

function realpathAsync(sftp: SFTPWrapper, path: string): Promise<string> {
  return new Promise((resolve, reject) => sftp.realpath(path, (err, resolved) => err ? reject(err) : resolve(resolved)));
}

function readdirAsync(sftp: SFTPWrapper, path: string) {
  return new Promise<Parameters<Parameters<SFTPWrapper['readdir']>[1]>[1]>((resolve, reject) =>
    sftp.readdir(path, (err, entries) => err ? reject(err) : resolve(entries)),
  );
}

function unlinkAsync(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => sftp.unlink(path, (err) => err ? reject(err) : resolve()));
}

function rmdirAsync(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => sftp.rmdir(path, (err) => err ? reject(err) : resolve()));
}

function mkdirAsync(sftp: SFTPWrapper, path: string): Promise<void> {
  return new Promise((resolve, reject) => sftp.mkdir(path, (err) => err ? reject(err) : resolve()));
}

function renameAsync(sftp: SFTPWrapper, from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) => sftp.rename(from, to, (err) => err ? reject(err) : resolve()));
}

function posixRenameAsync(sftp: SFTPWrapper, from: string, to: string): Promise<void> {
  return new Promise((resolve, reject) =>
    sftp.ext_openssh_rename(from, to, (err) => err ? reject(err) : resolve()),
  );
}

async function replaceFileAtomically(
  sftp: SFTPWrapper,
  temporary: string,
  target: string,
  targetExists: boolean,
): Promise<void> {
  try {
    await posixRenameAsync(sftp, temporary, target);
    return;
  } catch {
    // 服务端不支持 posix-rename：先把原文件改成同目录备份，再替换。
    // 替换失败时恢复备份，避免“删了原文件但新文件也没落下”的数据丢失。
  }
  if (!targetExists) {
    await renameAsync(sftp, temporary, target);
    return;
  }
  const backup = posixPath.join(
    posixPath.dirname(target),
    `.${posixPath.basename(target)}.bak-${randomUUID().slice(0, 8)}`,
  );
  await renameAsync(sftp, target, backup);
  try {
    await renameAsync(sftp, temporary, target);
  } catch (err) {
    await renameAsync(sftp, backup, target).catch(() => undefined);
    throw err;
  }
  await unlinkAsync(sftp, backup).catch(() => undefined);
}

function chmodAsync(sftp: SFTPWrapper, path: string, mode: number): Promise<void> {
  return new Promise((resolve, reject) => sftp.chmod(path, mode, (err) => err ? reject(err) : resolve()));
}

async function readBuffer(sftp: SFTPWrapper, path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = sftp.createReadStream(path);
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function writeBuffer(sftp: SFTPWrapper, path: string, data: Buffer): Promise<void> {
  const stream = sftp.createWriteStream(path, { flags: 'w' });
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('close', resolve);
    stream.end(data);
  });
}

function toEntry(name: string, path: string, attrs: Stats): HostFileEntry {
  return {
    name,
    path,
    type: attrs.isDirectory() ? 'dir' : 'file',
    size: attrs.size,
    // ssh2 mtime 是 Unix 秒
    mtime: formatDateTime(new Date(attrs.mtime * 1000)),
    permissions: modeString(attrs.mode & 0o777),
  };
}

export async function hostFileHome(hostId: number): Promise<{ home: string }> {
  return withSftp(hostId, async (sftp) => ({ home: await realpathAsync(sftp, '.') || '/' }));
}

export async function hostFileList(hostId: number, dirPath?: string) {
  return withSftp(hostId, async (sftp) => {
    const target = dirPath?.trim() ? posixPath.resolve('/', dirPath) : await realpathAsync(sftp, '.');
    const stat = await statAsync(sftp, target);
    if (!stat.isDirectory()) throw new HTTPException(400, { message: '目标不是目录' });
    const items = await readdirAsync(sftp, target);
    const entries = items
      .filter((item) => item.filename !== '.' && item.filename !== '..')
      .map((item) => toEntry(item.filename, posixPath.join(target, item.filename), item.attrs))
      .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1);
    const parent = posixPath.dirname(target);
    return { path: target, parent: parent === target ? null : parent, entries };
  });
}

export async function hostFileReadText(hostId: number, filePath: string) {
  const resolved = posixPath.resolve('/', filePath);
  return withSftp(hostId, async (sftp) => {
    const stat = await statAsync(sftp, resolved).catch(() => null);
    if (!stat) throw new HTTPException(404, { message: '文件不存在' });
    if (stat.isDirectory()) throw new HTTPException(400, { message: '不能读取目录内容' });
    if (stat.size > MAX_EDIT_SIZE) throw new HTTPException(400, { message: '文件过大，无法在线编辑（上限 5MB）' });
    const buffer = await readBuffer(sftp, resolved);
    if (isBinaryBuffer(buffer)) throw new HTTPException(400, { message: '二进制文件无法在线编辑' });
    return {
      path: resolved,
      content: buffer.toString('utf8'),
      size: stat.size,
      etag: fileEtag({ mtimeMs: stat.mtime * 1000, size: stat.size }),
    };
  });
}

export async function hostFileWriteText(hostId: number, filePath: string, content: string, baseEtag?: string | null) {
  const resolved = posixPath.resolve('/', filePath);
  const temporary = posixPath.join(posixPath.dirname(resolved), `.${posixPath.basename(resolved)}.tmp-${randomUUID().slice(0, 8)}`);
  return withSftp(hostId, async (sftp) => {
    const existing = await statAsync(sftp, resolved).catch(() => null);
    if (existing) {
      if (existing.isDirectory()) throw new HTTPException(400, { message: '目标是目录，无法写入' });
      assertNotStale(fileEtag({ mtimeMs: existing.mtime * 1000, size: existing.size }), baseEtag);
    }
    try {
      await writeBuffer(sftp, temporary, Buffer.from(content, 'utf8'));
      if (existing) await chmodAsync(sftp, temporary, existing.mode & 0o777);
      await replaceFileAtomically(sftp, temporary, resolved, !!existing);
    } catch (err) {
      await unlinkAsync(sftp, temporary).catch(() => undefined);
      throw err;
    }
    return toEntry(posixPath.basename(resolved), resolved, await statAsync(sftp, resolved));
  });
}

export async function hostFileCreate(hostId: number, path: string, type: 'file' | 'dir') {
  const resolved = posixPath.resolve('/', path);
  return withSftp(hostId, async (sftp) => {
    if (await lstatAsync(sftp, resolved).catch(() => null)) {
      throw new HTTPException(400, { message: '同名文件或目录已存在' });
    }
    if (type === 'dir') await mkdirAsync(sftp, resolved);
    else await writeBuffer(sftp, resolved, Buffer.alloc(0));
    return toEntry(posixPath.basename(resolved), resolved, await statAsync(sftp, resolved));
  });
}

async function deleteRecursive(sftp: SFTPWrapper, path: string): Promise<void> {
  const stat = await lstatAsync(sftp, path);
  // 软链接必须删除链接本身，绝不能跟随到目标目录递归删除。
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    await unlinkAsync(sftp, path);
    return;
  }
  for (const entry of await readdirAsync(sftp, path)) {
    if (entry.filename === '.' || entry.filename === '..') continue;
    await deleteRecursive(sftp, posixPath.join(path, entry.filename));
  }
  await rmdirAsync(sftp, path);
}

export async function hostFileDelete(hostId: number, path: string): Promise<void> {
  const resolved = posixPath.resolve('/', path);
  if (resolved === '/') throw new HTTPException(400, { message: '禁止删除远程根目录' });
  await withSftp(hostId, (sftp) => deleteRecursive(sftp, resolved));
}

export async function hostFileRename(hostId: number, from: string, to: string) {
  const source = posixPath.resolve('/', from);
  const target = posixPath.resolve('/', to);
  return withSftp(hostId, async (sftp) => {
    await renameAsync(sftp, source, target);
    return toEntry(posixPath.basename(target), target, await statAsync(sftp, target));
  });
}

export async function hostFileChmod(hostId: number, path: string, mode: number): Promise<void> {
  await withSftp(hostId, (sftp) => chmodAsync(sftp, posixPath.resolve('/', path), mode));
}

export async function hostFileDownload(hostId: number, path: string) {
  const resolved = posixPath.resolve('/', path);
  const lease = await (await getRemoteExecutor(hostId)).acquireSftp();
  const sftp = lease.sftp;
  let stat: Stats;
  try {
    stat = await statAsync(sftp, resolved);
  } catch (err) {
    lease.release();
    throw err;
  }
  if (stat.isDirectory()) {
    lease.release();
    throw new HTTPException(400, { message: '暂不支持下载目录' });
  }
  const stream = sftp.createReadStream(resolved);
  stream.once('close', lease.release);
  stream.once('error', lease.release);
  stream.once('end', lease.release);
  return { stream, fileName: posixPath.basename(resolved), size: stat.size };
}

export async function hostFileUpload(hostId: number, dirPath: string, file: File) {
  await assertUploadSizeWithinLimit(file.size);
  const target = posixPath.join(posixPath.resolve('/', dirPath), posixPath.basename(file.name));
  const temporary = posixPath.join(
    posixPath.dirname(target),
    `.${posixPath.basename(target)}.upload-${randomUUID().slice(0, 8)}`,
  );
  return withSftp(hostId, async (sftp) => {
    const existing = await lstatAsync(sftp, target).catch(() => null);
    try {
      await writeBuffer(sftp, temporary, Buffer.from(await file.arrayBuffer()));
      if (existing) await chmodAsync(sftp, temporary, existing.mode & 0o777);
      await replaceFileAtomically(sftp, temporary, target, !!existing);
    } catch (err) {
      await unlinkAsync(sftp, temporary).catch(() => undefined);
      throw err;
    }
    return toEntry(posixPath.basename(target), target, await statAsync(sftp, target));
  });
}
