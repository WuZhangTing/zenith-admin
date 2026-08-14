import { eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { wikiDocSubscriptions, wikiDocs } from '../../db/schema';
import { currentUserId } from '../../lib/context';
import logger from '../../lib/logger';
import { buildWhere } from '../../lib/where-helpers';
import { sendSystemInApp } from '../messaging/in-app-messages.service';

/**
 * 知识中心站内通知（P2-C）。
 * 统一走 messaging 的 sendSystemInApp；失败只记录日志，不阻断业务主流程。
 */

async function listSubscriberIds(docId: number, excludeUserId?: number): Promise<number[]> {
  const rows = await db.select({ userId: wikiDocSubscriptions.userId }).from(wikiDocSubscriptions)
    .where(buildWhere(
      eq(wikiDocSubscriptions.docId, docId),
      excludeUserId !== undefined ? ne(wikiDocSubscriptions.userId, excludeUserId) : undefined,
    ));
  return rows.map((r) => r.userId);
}

async function getDocBrief(docId: number) {
  return db.query.wikiDocs.findFirst({
    where: eq(wikiDocs.id, docId),
    columns: { id: true, title: true, tenantId: true, createdBy: true },
  });
}

/** 文档发布（含审核通过与直发）→ 通知订阅者 */
export async function notifyWikiDocPublished(docId: number): Promise<void> {
  try {
    const doc = await getDocBrief(docId);
    if (!doc) return;
    const userIds = await listSubscriberIds(docId, currentUserId());
    if (userIds.length === 0) return;
    await sendSystemInApp({
      userIds,
      title: '订阅的知识文档已更新',
      content: `你订阅的文档《${doc.title}》发布了新版本，点击知识中心查看。`,
      type: 'info',
      tenantId: doc.tenantId ?? null,
    });
  } catch (err) {
    logger.warn('[wiki] 发布通知发送失败', { docId, err });
  }
}

/** 新评论 → 通知文档作者与订阅者（排除评论人自己） */
export async function notifyWikiDocCommented(docId: number, commentSummary: string): Promise<void> {
  try {
    const doc = await getDocBrief(docId);
    if (!doc) return;
    const me = currentUserId();
    const ids = new Set<number>(await listSubscriberIds(docId, me));
    if (doc.createdBy !== null && doc.createdBy !== me) ids.add(doc.createdBy);
    if (ids.size === 0) return;
    await sendSystemInApp({
      userIds: [...ids],
      title: '知识文档有新评论',
      content: `《${doc.title}》收到新评论：${commentSummary.slice(0, 80)}`,
      type: 'info',
      tenantId: doc.tenantId ?? null,
    });
  } catch (err) {
    logger.warn('[wiki] 评论通知发送失败', { docId, err });
  }
}

/** 评论 @提及 → 通知被提及人 */
export async function notifyWikiMentioned(docId: number, mentionedUserIds: number[]): Promise<void> {
  if (mentionedUserIds.length === 0) return;
  try {
    const doc = await getDocBrief(docId);
    if (!doc) return;
    const me = currentUserId();
    const userIds = [...new Set(mentionedUserIds)].filter((uid) => uid !== me);
    if (userIds.length === 0) return;
    await sendSystemInApp({
      userIds,
      title: '有人在知识文档中提到了你',
      content: `你在《${doc.title}》的评论中被提及，去看看吧。`,
      type: 'info',
      tenantId: doc.tenantId ?? null,
    });
  } catch (err) {
    logger.warn('[wiki] @提及通知发送失败', { docId, err });
  }
}

/** 审核结果 → 通知文档作者 */
export async function notifyWikiDocReviewed(docId: number, approved: boolean, reason?: string | null): Promise<void> {
  try {
    const doc = await getDocBrief(docId);
    if (!doc || doc.createdBy === null || doc.createdBy === currentUserId()) return;
    await sendSystemInApp({
      userIds: [doc.createdBy],
      title: approved ? '知识文档审核通过' : '知识文档被驳回',
      content: approved
        ? `你提交的《${doc.title}》已审核通过并发布。`
        : `你提交的《${doc.title}》被驳回${reason ? `：${reason.slice(0, 100)}` : '，请修改后重新提交。'}`,
      type: approved ? 'success' : 'warning',
      tenantId: doc.tenantId ?? null,
    });
  } catch (err) {
    logger.warn('[wiki] 审核结果通知发送失败', { docId, err });
  }
}
