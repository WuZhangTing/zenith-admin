import { desc, like, and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { ipAccessLogs } from '../../db/schema';
import { dateRangeConditions, escapeLike, mergeWhere, withPagination } from '../../lib/where-helpers';
import { formatDateTime } from '../../lib/datetime';

export interface ListIpAccessLogsQuery {
  page?: number;
  pageSize?: number;
  ip?: string;
  blockType?: 'blacklist' | 'whitelist';
  startTime?: string;
  endTime?: string;
}

export async function listIpAccessLogs(q: ListIpAccessLogsQuery) {
  const page = Number(q.page) || 1;
  const pageSize = Number(q.pageSize) || 10;
  const conditions = [];
  if (q.ip) conditions.push(like(ipAccessLogs.ip, `%${escapeLike(q.ip)}%`));
  if (q.blockType) conditions.push(eq(ipAccessLogs.blockType, q.blockType));
  conditions.push(...dateRangeConditions(ipAccessLogs.createdAt, q.startTime, q.endTime));
  const where = and(...conditions);
  const finalWhere = mergeWhere(where);
  const [total, rows] = await Promise.all([
    db.$count(ipAccessLogs, finalWhere),
    withPagination(
      db.select().from(ipAccessLogs).where(finalWhere).orderBy(desc(ipAccessLogs.createdAt)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return {
    list: rows.map((r) => ({ ...r, createdAt: formatDateTime(r.createdAt), blockType: r.blockType as 'blacklist' | 'whitelist' })),
    total,
    page,
    pageSize,
  };
}

export async function writeIpAccessLog(data: {
  ip: string;
  path: string;
  method: string;
  blockType: 'blacklist' | 'whitelist';
  userAgent?: string | null;
}) {
  await db.insert(ipAccessLogs).values({
    ip: data.ip,
    path: data.path,
    method: data.method,
    blockType: data.blockType,
    userAgent: data.userAgent ?? null,
  });
}
