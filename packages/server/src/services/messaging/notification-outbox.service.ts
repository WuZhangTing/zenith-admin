/**
 * 通知 Outbox 服务：`notify()` 是全站唯一的通知入口。
 *
 * 业务域不再直接调渠道函数，只声明「发生了什么事件、发给谁」；
 * 渠道选择、偏好、免打扰、幂等与留痕全部由派发层负责。
 * 这样新增一个渠道或改一次偏好规则，不需要回头去改任何业务代码。
 */
import { and, eq, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type {
  NotificationChannelOptions,
  NotificationChannelPolicy,
  NotificationEventKey,
  NotificationEventVars,
  NotificationRecipient,
} from '@zenith/shared/messaging';
import { isNotificationEventKey, getNotificationEvent } from '@zenith/shared/messaging';
import { db } from '../../db';
import { notificationOutbox } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { currentTraceId, currentParentRef } from '../../lib/context';
import { formatDateTime } from '../../lib/datetime';
import { escapeHtml } from '@zenith/shared/core';
import { deliverOutboxRow } from '../../lib/notification/dispatch';
import logger from '../../lib/logger';
import { renderTemplate } from '../../lib/sms-sender';
import { buildWhere } from '../../lib/where-helpers';

const MAX_ATTEMPTS = 5;
const CLAIM_TIMEOUT_MS = 5 * 60_000;
const SCAN_LIMIT = 200;

export interface NotifyInput<K extends NotificationEventKey> {
  /** 收件人列表；空数组直接跳过，不产生 outbox 行 */
  recipients: readonly NotificationRecipient[];
  /** 事件声明的变量，类型由事件目录约束 */
  vars: NotificationEventVars<K>;
  tenantId?: number | null;
  /** 幂等键：同键只会入队一次，用于重复触发的定时任务与重放场景 */
  dedupeKey?: string | null;
  /** 站内路由深链 */
  link?: string | null;
  /** 管理员配置层的渠道策略（流程 notifyChannels、告警规则 channels） */
  channelPolicy?: NotificationChannelPolicy | null;
  /** 渠道级参数（短信模板、Webhook 地址与请求体） */
  channelOptions?: NotificationChannelOptions | null;
  /** 指定投递时间，用于定时提醒 */
  scheduledAt?: Date | null;
}

function buildValues<K extends NotificationEventKey>(eventKey: K, input: NotifyInput<K>) {
  return {
    eventKey,
    recipients: [...input.recipients],
    vars: (input.vars ?? {}) as Record<string, unknown>,
    channelPolicy: input.channelPolicy ?? null,
    channelOptions: input.channelOptions ?? null,
    link: input.link ?? null,
    dedupeKey: input.dedupeKey ?? null,
    scheduledAt: input.scheduledAt ?? null,
    traceId: currentTraceId() ?? null,
    parentRef: currentParentRef() ?? null,
    tenantId: input.tenantId ?? null,
  };
}

/**
 * 在给定事务内登记通知事件。
 *
 * 与业务写入同事务提交，因此业务回滚时通知不会发出去。
 * 事务提交后由 cron 兜底派发；需要更低延迟时在提交后调用 `flushNotification(id)`。
 */
export async function notifyWithin<K extends NotificationEventKey>(
  executor: DbExecutor,
  eventKey: K,
  input: NotifyInput<K>,
): Promise<number | null> {
  if (input.recipients.length === 0) return null;
  if (!isNotificationEventKey(eventKey)) {
    throw new Error(`未注册的通知事件：${String(eventKey)}`);
  }
  const [row] = await executor.insert(notificationOutbox)
    .values(buildValues(eventKey, input))
    // 幂等键是部分唯一索引（仅 dedupe_key 非空时生效），
    // ON CONFLICT 必须同时给出索引谓词，否则 PG 无法推断仲裁索引（42P10）
    .onConflictDoNothing({
      target: notificationOutbox.dedupeKey,
      where: sql`${notificationOutbox.dedupeKey} is not null`,
    })
    .returning({ id: notificationOutbox.id });
  return row?.id ?? null;
}

/**
 * 登记并立即派发通知事件（非事务场景的默认入口）。
 *
 * 派发在 `setImmediate` 中异步进行：通知永远不该拖慢或拖垮触发它的业务请求，
 * 即便渠道全挂，事件也已经落库，cron 会继续补投。
 */
export async function notify<K extends NotificationEventKey>(
  eventKey: K,
  input: NotifyInput<K>,
): Promise<number | null> {
  const id = await notifyWithin(db, eventKey, input);
  if (id === null) return null;
  // 定时投递的事件交给 cron 在到点后取走，这里不抢跑
  if (!input.scheduledAt) flushNotification(id);
  return id;
}

/** 触发一次异步派发，不等待结果。 */
export function flushNotification(id: number): void {
  setImmediate(() => {
    void processNotificationOutbox(id).catch((err) => {
      logger.error('[notification-outbox] 立即派发失败', { id, err });
    });
  });
}

/**
 * 处理单条 outbox 事件。
 *
 * 先做条件认领（pending + 未超重试上限 + 未被其他实例占用），
 * 多实例部署下同一条事件不会被并发派发两次。
 */
export async function processNotificationOutbox(id: number): Promise<void> {
  const claimBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS);
  const now = new Date();
  const [row] = await db
    .update(notificationOutbox)
    .set({ claimedAt: now })
    .where(and(
      eq(notificationOutbox.id, id),
      eq(notificationOutbox.status, 'pending'),
      // 摘要行不走逐条派发，由聚合任务合并处理
      isNull(notificationOutbox.digestKey),
      lt(notificationOutbox.attempts, MAX_ATTEMPTS),
      or(isNull(notificationOutbox.claimedAt), lt(notificationOutbox.claimedAt, claimBefore)),
      or(isNull(notificationOutbox.scheduledAt), lte(notificationOutbox.scheduledAt, now)),
    ))
    .returning();
  if (!row) return;

  try {
    const summary = await deliverOutboxRow(row);
    // 渠道失败已逐条留痕；只要事件展开成功就置 done，
    // 否则一个坏邮箱会让整条事件反复重试，把其他人重复轰炸一遍
    await db.update(notificationOutbox).set({ status: 'done' }).where(eq(notificationOutbox.id, id));
    if (summary.failed > 0) {
      logger.warn('[notification-outbox] 部分渠道投递失败', { id, eventKey: row.eventKey, ...summary });
    }
  } catch (err) {
    const attempts = row.attempts + 1;
    const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
    const lastError = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await db.update(notificationOutbox).set({
      attempts,
      status,
      lastError,
      claimedAt: status === 'pending' ? null : new Date(),
    }).where(eq(notificationOutbox.id, id));
    logger.error('[notification-outbox] 派发失败', { id, attempts, lastError });
  }
}

/** Cron 兜底：补投 pending 事件（含进程崩溃遗留与免打扰延后到期的行）。返回扫描条数。 */
export async function dispatchPendingNotifications(): Promise<number> {
  const claimBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS);
  const now = new Date();
  const rows = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(buildWhere(
      eq(notificationOutbox.status, 'pending'),
      isNull(notificationOutbox.digestKey),
      lt(notificationOutbox.attempts, MAX_ATTEMPTS),
      or(isNull(notificationOutbox.claimedAt), lt(notificationOutbox.claimedAt, claimBefore)),
      or(isNull(notificationOutbox.scheduledAt), lte(notificationOutbox.scheduledAt, now)),
    ))
    .limit(SCAN_LIMIT);
  for (const row of rows) {
    await processNotificationOutbox(row.id);
  }
  return rows.length;
}

/**
 * 摘要聚合：把到期的摘要行按「收件人 × 窗口」合并成一封汇总邮件。
 *
 * 摘要邮件经 `notify('messaging.digest')` 走完整派发链路，
 * 邮件发送记录与派发留痕都与普通通知同一套，不另起旁路。
 */
export async function aggregateNotificationDigests(): Promise<{ groups: number; items: number }> {
  const now = new Date();
  const due = await db.select().from(notificationOutbox)
    .where(buildWhere(
      eq(notificationOutbox.status, 'pending'),
      isNotNull(notificationOutbox.digestKey),
      lte(notificationOutbox.scheduledAt, now),
    ))
    .limit(SCAN_LIMIT);
  if (due.length === 0) return { groups: 0, items: 0 };

  const groups = new Map<string, typeof due>();
  for (const row of due) {
    const key = row.digestKey!;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let handledGroups = 0;
  let handledItems = 0;
  for (const [, rows] of groups) {
    // 单组失败不影响其余分组；未被认领的组保持 pending，下轮继续
    try {
      // 认领与摘要入队同事务：若在两步之间崩溃，认领回滚、行保持 pending，
      // 否则被置 done 的行既没有摘要也没有留痕，延后的邮件会静默丢失
      const summary = await db.transaction(async (tx) => {
        const claimed = await tx.update(notificationOutbox)
          .set({ status: 'done', claimedAt: new Date() })
          .where(and(
            inArrayIds(rows.map((r) => r.id)),
            eq(notificationOutbox.status, 'pending'),
          ))
          .returning({ id: notificationOutbox.id });
        if (claimed.length === 0) return null;
        const claimedIds = new Set(claimed.map((r) => r.id));
        const items = rows.filter((r) => claimedIds.has(r.id));
        const recipient = items[0].recipients[0];
        if (!recipient || recipient.type === 'external') return null;

        const lines = items.map((r) => {
          if (!isNotificationEventKey(r.eventKey)) return null;
          const vars = normalizeDigestVars(r.vars ?? {});
          const def = getNotificationEvent(r.eventKey);
          return {
            title: renderTemplate(def.title, vars),
            content: renderTemplate(def.content, vars),
            link: r.link,
            at: formatDateTime(r.createdAt),
          };
        }).filter((line): line is NonNullable<typeof line> => line !== null);
        if (lines.length === 0) return null;

        const html = [
          `<h3>通知摘要（${lines.length} 条）</h3>`,
          '<ul style="padding-left:18px">',
          ...lines.map((line) => `<li style="margin-bottom:8px"><b>${escapeHtml(line.title)}</b><br/>${escapeHtml(line.content)}<br/><span style="color:#888;font-size:12px">${line.at}</span></li>`),
          '</ul>',
        ].join('');

        const outboxId = await notifyWithin(tx, 'messaging.digest', {
          recipients: [recipient],
          vars: { count: lines.length, periodText: '摘要' },
          tenantId: items[0].tenantId,
          channelPolicy: { only: ['email'] },
          channelOptions: { email: { html, subject: `通知摘要：${lines.length} 条未读通知` } },
        });
        return { outboxId, itemCount: items.length };
      });

      if (summary) {
        if (summary.outboxId !== null) flushNotification(summary.outboxId);
        handledGroups += 1;
        handledItems += summary.itemCount;
      }
    } catch (err) {
      logger.error('[notification-digest] 摘要分组聚合失败', { err });
    }
  }
  return { groups: handledGroups, items: handledItems };
}

function inArrayIds(ids: number[]) {
  return sql`${notificationOutbox.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
}

function normalizeDigestVars(vars: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    result[key] = value === null || value === undefined ? '' : String(value);
  }
  return result;
}
