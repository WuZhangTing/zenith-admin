import { createRequire } from 'node:module';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { driveNodes, driveNodeTexts, managedFiles, type DriveNodeRow } from '../../db/schema';
import { readStoredFile } from '../../lib/file-storage';
import logger from '../../lib/logger';
import { getRestrictedFileForRead, saveGeneratedManagedFile } from '../files/files.service';
import { getDriveSettings } from './drive-settings.service';

// sharp 属重型依赖：首次生成缩略图时才加载
const require = createRequire(import.meta.url);
const sharp = (...args: Parameters<typeof import('sharp')['default']>) =>
  (require('sharp') as unknown as typeof import('sharp')['default'])(...args);

const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const TEXT_INDEX_MAX_BYTES = 2 * 1024 * 1024;
const TEXT_INDEX_MAX_CHARS = 200_000;

const THUMBNAIL_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/tiff', 'image/bmp', 'image/heic', 'image/heif']);

const TEXT_MIME_PREFIXES = ['text/'];
const TEXT_MIME_EXACT = new Set([
  'application/json', 'application/xml', 'application/javascript', 'application/typescript', 'application/x-yaml',
  'application/sql', 'application/x-sh', 'application/csv',
]);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yaml', 'yml', 'log', 'ini', 'conf', 'cfg', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'h', 'cpp', 'cs', 'sql', 'sh', 'bat', 'ps1', 'html', 'htm', 'css', 'scss', 'less', 'vue', 'toml', 'properties']);

export function isThumbnailCandidate(node: Pick<DriveNodeRow, 'type' | 'mimeType' | 'size'>): boolean {
  return node.type === 'file' && !!node.mimeType && THUMBNAIL_MIME.has(node.mimeType.toLowerCase()) && node.size > 0 && node.size <= THUMBNAIL_MAX_SOURCE_BYTES;
}

export function isTextIndexCandidate(node: Pick<DriveNodeRow, 'type' | 'mimeType' | 'extension' | 'size'>): boolean {
  if (node.type !== 'file' || node.size <= 0 || node.size > TEXT_INDEX_MAX_BYTES) return false;
  const mime = node.mimeType?.toLowerCase() ?? '';
  if (TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p)) || TEXT_MIME_EXACT.has(mime)) return true;
  return !!node.extension && TEXT_EXTENSIONS.has(node.extension.toLowerCase());
}

async function readFileBuffer(fileId: string): Promise<Buffer> {
  const { file, storageConfig } = await getRestrictedFileForRead(fileId);
  const { stream } = await readStoredFile(file, storageConfig);
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** 生成 webp 缩略图并挂到节点（版本未变才写回，避免覆盖更新的版本） */
export async function generateNodeThumbnail(nodeId: number): Promise<boolean> {
  const [node] = await db.select().from(driveNodes).where(eq(driveNodes.id, nodeId)).limit(1);
  if (!node || !node.fileId || !isThumbnailCandidate(node)) return false;
  const actorId = node.createdBy ?? node.updatedBy;
  if (!actorId) return false;
  const source = await readFileBuffer(node.fileId);
  const thumb = await sharp(source, { failOn: 'none' }).rotate().resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const created = await saveGeneratedManagedFile({
    buffer: thumb,
    filename: `thumb-${node.id}-v${node.currentVersion}.webp`,
    mimeType: 'image/webp',
    tenantId: node.tenantId ?? null,
    createdBy: actorId,
  });
  await db.update(managedFiles).set({ visibility: 'restricted' }).where(eq(managedFiles.id, created.id));
  const [updated] = await db.update(driveNodes).set({ thumbnailFileId: created.id })
    .where(sql`${driveNodes.id} = ${node.id} AND ${driveNodes.currentVersion} = ${node.currentVersion}`)
    .returning({ id: driveNodes.id });
  if (!updated) {
    // 版本已变，丢弃刚生成的缩略图
    const { releaseUnreferencedFiles } = await import('./drive-nodes.service');
    await releaseUnreferencedFiles([created.id]);
    return false;
  }
  return true;
}

/** 抽取文本文件正文写入全文索引（每节点一行，随版本覆盖） */
export async function indexNodeText(nodeId: number): Promise<boolean> {
  const [node] = await db.select().from(driveNodes).where(eq(driveNodes.id, nodeId)).limit(1);
  if (!node || !node.fileId || !isTextIndexCandidate(node)) return false;
  const buffer = await readFileBuffer(node.fileId);
  const content = buffer.toString('utf8').replaceAll('\u0000', '').slice(0, TEXT_INDEX_MAX_CHARS);
  await db.insert(driveNodeTexts).values({
    nodeId: node.id,
    version: node.currentVersion,
    content,
    searchVector: sql`to_tsvector('simple', ${content})`,
  }).onConflictDoUpdate({
    target: driveNodeTexts.nodeId,
    set: { version: node.currentVersion, content, searchVector: sql`to_tsvector('simple', ${content})` },
  });
  return true;
}

/** 单节点的全部增强处理（缩略图 + 全文索引），按设置开关执行 */
export async function enrichNode(nodeId: number): Promise<void> {
  const settings = await getDriveSettings();
  const [node] = await db.select().from(driveNodes).where(eq(driveNodes.id, nodeId)).limit(1);
  if (!node) return;
  if (settings.thumbnailEnabled && isThumbnailCandidate(node)) {
    await generateNodeThumbnail(nodeId).catch((err) => logger.warn({ err, nodeId }, 'drive: 缩略图生成失败'));
  }
  if (settings.textIndexEnabled && isTextIndexCandidate(node)) {
    await indexNodeText(nodeId).catch((err) => logger.warn({ err, nodeId }, 'drive: 全文索引失败'));
  }
}

/**
 * 上传落地后的尽力增强：进程内异步执行，失败只记日志（不阻塞响应、不进任务托盘）。
 * 大批量补建走任务中心 `drive-reindex`。
 */
export function scheduleNodeEnrichment(node: Pick<DriveNodeRow, 'id' | 'type' | 'mimeType' | 'extension' | 'size'>): void {
  if (node.type !== 'file') return;
  if (!isThumbnailCandidate(node) && !isTextIndexCandidate(node)) return;
  setImmediate(() => {
    void enrichNode(node.id).catch((err) => logger.warn({ err, nodeId: node.id }, 'drive: 节点增强处理失败'));
  });
}
