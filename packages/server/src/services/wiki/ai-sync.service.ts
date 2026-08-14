import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { wikiDocs } from '../../db/schema';
import logger from '../../lib/logger';
import { ingestKbDocument, removeKbDocumentsBySource } from '../ai/ai-knowledge.service';
import { getWikiSettings } from './stats.service';

/** Wiki 文档在 AI 知识库中的来源标识 */
function wikiSourceUrl(docId: number): string {
  return `wiki://docs/${docId}`;
}

/**
 * 文档发布后同步进 AI 知识库（全局设置 + 空间开关双重门控）。
 * 同步失败只记录日志，不阻断发布主流程。
 */
export async function syncPublishedWikiDocToAiKb(docId: number): Promise<void> {
  try {
    const settings = await getWikiSettings();
    if (!settings.aiSyncEnabled || !settings.aiSyncKbId) return;

    const doc = await db.query.wikiDocs.findFirst({
      where: eq(wikiDocs.id, docId),
      with: { space: { columns: { aiSyncEnabled: true } } },
    });
    if (!doc || doc.deletedAt !== null || doc.status !== 'published') return;
    if (!doc.space?.aiSyncEnabled) return;

    const sourceUrl = wikiSourceUrl(docId);
    // 重新发布时先清理旧副本再入库，保证知识库内始终只有一份最新内容
    await removeKbDocumentsBySource(settings.aiSyncKbId, sourceUrl);
    await ingestKbDocument(settings.aiSyncKbId, { name: doc.title, content: doc.content }, sourceUrl);
  } catch (err) {
    logger.warn('[wiki] 文档同步 AI 知识库失败', { docId, err });
  }
}

/** 文档下线（删除/回滚/退回草稿）时移除 AI 知识库副本；失败只记录日志 */
export async function removeWikiDocFromAiKb(docId: number): Promise<void> {
  try {
    const settings = await getWikiSettings();
    if (!settings.aiSyncKbId) return;
    await removeKbDocumentsBySource(settings.aiSyncKbId, wikiSourceUrl(docId));
  } catch (err) {
    logger.warn('[wiki] 移除 AI 知识库副本失败', { docId, err });
  }
}
