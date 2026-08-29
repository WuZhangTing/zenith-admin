/**
 * 限流拦截突增告警。
 *
 * 由中间件在拦截统计写入后异步调用（fire-and-forget，动态 import 解耦模块图）；
 * 双层去重保证同一规则同一小时最多通知一次：
 *  1. Redis SET NX（廉价前置闸，挡住阈值之后的每次拦截）
 *  2. notify() 的 dedupeKey（跨实例 / Redis 丢失时的最终兜底）
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import redis from '../../lib/redis';
import { config } from '../../config';
import logger from '../../lib/logger';
import { notify } from '../messaging/notification-outbox.service';

const STATS_PREFIX = `${config.redis.keyPrefix}rlstats:`;
/** 告警闸的存活时间：覆盖整个小时窗口即可，2h 留冗余 */
const ALERT_GATE_TTL_SECONDS = 2 * 60 * 60;

export async function maybeSendRateLimitSpikeAlert(input: {
  ruleName: string;
  threshold: number;
  blockedCount: number;
  /** 小时键（YYYY-MM-DD HH），与统计序列同源 */
  hourKey: string;
}): Promise<void> {
  const { ruleName, threshold, blockedCount, hourKey } = input;
  try {
    const gateKey = `${STATS_PREFIX}${ruleName}:alert-sent:${hourKey}`;
    const acquired = await redis.set(gateKey, '1', 'EX', ALERT_GATE_TTL_SECONDS, 'NX');
    if (acquired !== 'OK') return;

    // 平台管理员（与 SSL 到期巡检等运维告警同一收件人策略）
    const [admin] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.username, 'admin'), isNull(users.tenantId))).limit(1);
    if (!admin) return;

    await notify('ops.rate_limit.spike', {
      recipients: [{ type: 'user', id: admin.id }],
      vars: { ruleName, blockedCount, threshold, hour: hourKey },
      tenantId: null,
      link: '/system/rate-limit?tab=blocks',
      dedupeKey: `rate-limit-spike:${ruleName}:${hourKey}`,
    });
  } catch (err) {
    logger.warn('[rate-limit] 突增告警发送失败', { ruleName, hourKey, err });
  }
}
