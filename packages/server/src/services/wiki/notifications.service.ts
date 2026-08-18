import { eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { wikiDocSubscriptions, wikiDocs } from '../../db/schema';
import { currentUserId } from '../../lib/context';
import logger from '../../lib/logger';
import { buildWhere } from '../../lib/where-helpers';
import { notify } from '../messaging/notification-outbox.service';

/**
 * 知识中心通知（P2-C）。
 * 统一走通知中心的 `notify()`：渠道、收件人偏好与免打扰由派发层决定，
 * 这里只负责说明「发生了什么、跟谁有关」。失败只记录日志，不阻断业务主流程。
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

function toRecipients(userIds: number[]) {
  return userIds.map((id) => ({ type: 'user' as const, id }));
}

/** 文档发布（含审核通过与直发）→ 通知订阅者 */
export async function notifyWikiDocPublished(docId: number): Promise<void> {
  try {
    const doc = await getDocBrief(docId);
    if (!doc) return;
    const userIds = await listSubscriberIds(docId, currentUserId());
    if (userIds.length === 0) return;
    await notify('wiki.doc.published', {
      recipients: toRecipients(userIds),
      vars: { docId: doc.id, docTitle: doc.title },
      tenantId: doc.tenantId ?? null,
      link: `/wiki/docs/${doc.id}`,
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
    await notify('wiki.doc.commented', {
      recipients: toRecipients([...ids]),
      vars: { docId: doc.id, docTitle: doc.title, summary: commentSummary.slice(0, 80) },
      tenantId: doc.tenantId ?? null,
      link: `/wiki/docs/${doc.id}`,
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
    await notify('wiki.doc.mentioned', {
      recipients: toRecipients(userIds),
      vars: { docId: doc.id, docTitle: doc.title },
      tenantId: doc.tenantId ?? null,
      link: `/wiki/docs/${doc.id}`,
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
    await notify('wiki.doc.reviewed', {
      recipients: toRecipients([doc.createdBy]),
      vars: {
        docId: doc.id,
        docTitle: doc.title,
        resultText: approved
          ? '已审核通过并发布。'
          : `被驳回${reason ? `：${reason.slice(0, 100)}` : '，请修改后重新提交。'}`,
      },
      tenantId: doc.tenantId ?? null,
      link: `/wiki/docs/${doc.id}`,
    });
  } catch (err) {
    logger.warn('[wiki] 审核结果通知发送失败', { docId, err });
  }
}
