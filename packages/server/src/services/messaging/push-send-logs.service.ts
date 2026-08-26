/**
 * App 推送发送记录（追加型日志,只读查询）。
 */
import { desc, eq, inArray } from 'drizzle-orm';
import type { PushProvider } from '@zenith/shared/messaging';
import { db } from '../../db';
import { pushSendLogs, users, type PushSendLogRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';

export function mapPushSendLog(row: PushSendLogRow, subjectName?: string | null) {
  return {
    id: row.id,
    configId: row.configId ?? null,
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
    withPagination(
      db.select().from(pushSendLogs).where(where).orderBy(desc(pushSendLogs.id)).$dynamic(),
      page,
      pageSize,
    ),
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
