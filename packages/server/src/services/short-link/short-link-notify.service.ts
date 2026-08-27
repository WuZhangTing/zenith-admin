/**
 * 短链过期提醒：每日扫描 72 小时内到期且仍启用的短链，通知创建人。
 *
 * 经通知中心 notify() 统一派发（渠道/偏好/免打扰由派发层负责）；
 * dedupeKey 锚定「短链 + 到期时间」，调整有效期后会再次提醒，重复扫描不重发。
 */
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '../../db';
import { shortLinks } from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { notify } from '../messaging/notification-outbox.service';
import { buildShortUrl } from './short-link.service';

const EXPIRING_WINDOW_MS = 72 * 3600_000;

export async function scanExpiringShortLinks(): Promise<number> {
  const now = new Date();
  const until = new Date(now.getTime() + EXPIRING_WINDOW_MS);
  const rows = await db
    .select()
    .from(shortLinks)
    .where(and(
      eq(shortLinks.status, 'enabled'),
      isNotNull(shortLinks.expiresAt),
      gte(shortLinks.expiresAt, now),
      lte(shortLinks.expiresAt, until),
      isNotNull(shortLinks.createdBy),
    ));

  let notified = 0;
  for (const row of rows) {
    const queued = await notify('shortlink.link.expiring', {
      recipients: [{ type: 'user', id: row.createdBy! }],
      vars: {
        code: row.code,
        title: row.title ?? row.code,
        shortUrl: buildShortUrl(row.code),
        expiresAtText: formatDateTime(row.expiresAt!),
      },
      tenantId: row.tenantId ?? null,
      link: '/growth/short-links',
      dedupeKey: `shortlink-expiring:${row.id}:${row.expiresAt!.getTime()}`,
    });
    if (queued) notified++;
  }
  return notified;
}
