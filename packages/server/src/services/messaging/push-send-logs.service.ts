/**
 * App 推送发送记录（追加型日志,回执回调更新送达状态）。
 */
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { PushDeliveryStatus, PushProvider } from '@zenith/shared/messaging';
import { db } from '../../db';
import { pushSendLogs, users, type PushSendLogRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition } from '../../lib/where-helpers';
import { pageOffset } from '../../lib/pagination';

export function mapPushSendLog(row: PushSendLogRow & { app?: { name: string } | null }, subjectName?: string | null) {
  return {
    id: row.id,
    configId: row.configId ?? null,
    appId: row.appId ?? null,
    appName: row.app?.name ?? null,
    provider: row.provider,
    subjectType: row.subjectType ?? null,
    subjectId: row.subjectId ?? null,
    subjectName: subjectName ?? null,
    deviceCount: row.deviceCount,
    title: row.title,
    content: row.content,
    link: row.link ?? null,
    eventKey: row.eventKey ?? null,
    status: row.status,
    providerMsgId: row.providerMsgId ?? null,
    deliveryStatus: (row.deliveryStatus as PushDeliveryStatus | null) ?? null,
    deliveredAt: formatNullableDateTime(row.deliveredAt),
    clickedAt: formatNullableDateTime(row.clickedAt),
    errorMsg: row.errorMsg ?? null,
    source: row.source,
    tenantId: row.tenantId ?? null,
    sentAt: formatNullableDateTime(row.sentAt),
    createdAt: formatDateTime(row.createdAt),
  };
}

export interface ListPushSendLogsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  provider?: PushProvider;
  status?: 'pending' | 'success' | 'failed';
  startTime?: string;
  endTime?: string;
}

export async function listPushSendLogs(q: ListPushSendLogsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildWhere(
    keywordCondition(q.keyword, [pushSendLogs.title, pushSendLogs.content, pushSendLogs.eventKey]),
    q.provider ? eq(pushSendLogs.provider, q.provider) : undefined,
    q.status ? eq(pushSendLogs.status, q.status) : undefined,
    ...dateRangeConditions(pushSendLogs.createdAt, q.startTime, q.endTime),
  );
  const [total, rows] = await Promise.all([
    db.$count(pushSendLogs, where),
    db.query.pushSendLogs.findMany({
      where,
      with: { app: { columns: { name: true } } },
      orderBy: desc(pushSendLogs.id),
      limit: pageSize,
      offset: pageOffset(page, pageSize),
    }),
  ]);

  // 管理端收件人只展示 user 主体的昵称;member 主体显示 ID 即可
  const userIds = [...new Set(rows.filter((r) => r.subjectType === 'user' && r.subjectId).map((r) => r.subjectId as number))];
  const nameMap = new Map<number, string>();
  if (userIds.length > 0) {
    const nameRows = await db.select({ id: users.id, nickname: users.nickname }).from(users).where(inArray(users.id, userIds));
    for (const r of nameRows) nameMap.set(r.id, r.nickname);
  }

  return {
    list: rows.map((row) => mapPushSendLog(row, row.subjectType === 'user' && row.subjectId ? nameMap.get(row.subjectId) : null)),
    total,
    page,
    pageSize,
  };
}

// ─── 送达回执（供应商回调）────────────────────────────────────────────────────

export interface PushReceiptEvent {
  provider: PushProvider;
  msgId: string;
  /** received=送达,click=点击 */
  type: 'received' | 'click';
  /** 事件发生时间（秒级时间戳）,缺省用当前时间 */
  itime?: number;
}

/**
 * 将供应商回执写回发送记录。
 * 按 (provider, providerMsgId) 定位;点击蕴含送达;时间列只写一次(重复回执幂等)。
 * 找不到对应记录时静默忽略——回调方无法区分,返回错误只会招致重试轰炸。
 */
export async function applyPushReceipt(event: PushReceiptEvent): Promise<boolean> {
  const eventAt = (event.itime ? new Date(event.itime * 1000) : new Date()).toISOString();
  const result = await db
    .update(pushSendLogs)
    .set(event.type === 'click'
      ? {
        deliveryStatus: 'clicked' satisfies PushDeliveryStatus,
        clickedAt: sql`coalesce(${pushSendLogs.clickedAt}, ${eventAt}::timestamptz)`,
        deliveredAt: sql`coalesce(${pushSendLogs.deliveredAt}, ${eventAt}::timestamptz)`,
      }
      : {
        // 已是 clicked 的不回退为 delivered
        deliveryStatus: sql`coalesce(${pushSendLogs.deliveryStatus}, 'delivered')`,
        deliveredAt: sql`coalesce(${pushSendLogs.deliveredAt}, ${eventAt}::timestamptz)`,
      })
    .where(and(
      eq(pushSendLogs.provider, event.provider),
      eq(pushSendLogs.providerMsgId, event.msgId),
      event.type === 'click'
        ? or(isNull(pushSendLogs.clickedAt), isNull(pushSendLogs.deliveredAt))
        : isNull(pushSendLogs.deliveredAt),
    ))
    .returning({ id: pushSendLogs.id });
  return result.length > 0;
}
