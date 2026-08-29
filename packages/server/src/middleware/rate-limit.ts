import { rateLimiter, RedisStore } from 'hono-rate-limiter';
import type { MiddlewareHandler, Context } from 'hono';
import redis from '../lib/redis';
import { config } from '../config';
import { errBody } from '../lib/openapi-schemas';
import { getClientIp } from '../lib/request-helpers';
import logger from '../lib/logger';
import dayjs from 'dayjs';
import { db } from '../db';
import { rateLimitRules } from '../db/schema';
import { currentUser } from '../lib/context';

export type RateLimitName = 'auth' | 'captcha' | 'sensitive' | 'analytics-ingest' | 'error-report' | 'report_public_share' | 'workflow_public_callback' | 'push_public_callback' | 'chat_send' | 'chatbi_ask' | 'report_chatbi_write' | 'report_fill_write' | 'ai_chat_send' | 'ai_share_view';
export type RateLimitKeyType = 'ip' | 'user' | 'ip_path';

export interface RuleConfig {
  name: string;
  description: string | null;
  windowMs: number;
  limit: number;
  keyType: RateLimitKeyType;
  enabled: boolean;
  blockedMessage: string | null;
  pathPatterns: string[];
}

const DEFAULTS: Record<RateLimitName, RuleConfig> = {
  auth:      { name: 'auth',      description: '登录接口限流',          windowMs: 3 * 60 * 1000,      limit: 20, keyType: 'ip', enabled: true, blockedMessage: '登录尝试过于频繁，请 3 分钟后再试', pathPatterns: [] },
  captcha:   { name: 'captcha',   description: '验证码接口限流',        windowMs: 60 * 1000,          limit: 30, keyType: 'ip', enabled: true, blockedMessage: '验证码请求过于频繁，请稍后再试', pathPatterns: [] },
  sensitive: { name: 'sensitive', description: '敏感操作（注册/重置）限流', windowMs: 60 * 60 * 1000,  limit: 5,  keyType: 'ip', enabled: true, blockedMessage: '操作过于频繁，请 1 小时后重试', pathPatterns: [] },
  'analytics-ingest': { name: 'analytics-ingest', description: '匿名埋点事件上报限流', windowMs: 60 * 1000, limit: 120, keyType: 'ip', enabled: true, blockedMessage: '埋点上报过于频繁，请稍后再试', pathPatterns: [] },
  'error-report': { name: 'error-report', description: '匿名前端错误上报限流', windowMs: 60 * 1000, limit: 60, keyType: 'ip', enabled: true, blockedMessage: '错误上报过于频繁，请稍后再试', pathPatterns: [] },
  report_public_share: { name: 'report_public_share', description: '报表公开分享访问限流（无需登录，防滥用/防爆破）', windowMs: 60 * 1000, limit: 120, keyType: 'ip', enabled: true, blockedMessage: '访问过于频繁，请稍后再试', pathPatterns: ['/api/report/public/*'] },
  workflow_public_callback: { name: 'workflow_public_callback', description: '工作流公开回调接口限流', windowMs: 60 * 1000, limit: 120, keyType: 'ip_path', enabled: true, blockedMessage: '工作流回调请求过于频繁，请稍后再试', pathPatterns: ['/api/public/workflow/external-callback/*', '/api/public/workflow/trigger-callback/*'] },
  push_public_callback: { name: 'push_public_callback', description: '推送供应商回执回调限流', windowMs: 60 * 1000, limit: 300, keyType: 'ip', enabled: true, blockedMessage: '回执回调过于频繁，请稍后再试', pathPatterns: ['/api/public/push/callbacks/*'] },
  chat_send: { name: 'chat_send', description: '聊天消息发送限流（按用户）', windowMs: 60 * 1000, limit: 60, keyType: 'user', enabled: true, blockedMessage: '消息发送过于频繁，请稍后再试', pathPatterns: [] },
  chatbi_ask: { name: 'chatbi_ask', description: 'ChatBI 提问限流（按用户）', windowMs: 60 * 1000, limit: 10, keyType: 'user', enabled: true, blockedMessage: 'ChatBI 提问过于频繁，请稍后再试', pathPatterns: [] },
  report_chatbi_write: { name: 'report_chatbi_write', description: 'ChatBI 写操作限流（按用户）', windowMs: 60 * 1000, limit: 30, keyType: 'user', enabled: true, blockedMessage: 'ChatBI 操作过于频繁，请稍后再试', pathPatterns: [] },
  report_fill_write: { name: 'report_fill_write', description: '报表填报写操作限流（按用户）', windowMs: 60 * 1000, limit: 30, keyType: 'user', enabled: true, blockedMessage: '填报操作过于频繁，请稍后再试', pathPatterns: [] },
  ai_chat_send: { name: 'ai_chat_send', description: 'AI 对话发送限流（按用户）', windowMs: 60 * 1000, limit: 15, keyType: 'user', enabled: true, blockedMessage: 'AI 对话过于频繁，请稍后再试', pathPatterns: [] },
  ai_share_view: { name: 'ai_share_view', description: 'AI 对话分享页访问限流（无需登录，防滥用）', windowMs: 60 * 1000, limit: 60, keyType: 'ip', enabled: true, blockedMessage: '访问过于频繁，请稍后再试', pathPatterns: [] },
};

const ruleCache = new Map<string, RuleConfig>(Object.entries(DEFAULTS));
const compiledLimiters = new Map<string, MiddlewareHandler>();

const RL_PREFIX = `${config.redis.keyPrefix}rl:`;
const STATS_PREFIX = `${config.redis.keyPrefix}rlstats:`;
const STATS_TTL = 7 * 24 * 60 * 60;
const HOURLY_TTL = 25 * 60 * 60;

function currentHourKey(): string {
  return dayjs().format('YYYY-MM-DD HH');
}

const ioredisAdapter = {
  scriptLoad(script: string): Promise<string> {
    return redis.script('LOAD', script) as Promise<string>;
  },
  evalsha<TArgs extends unknown[], TData = unknown>(
    sha1: string,
    keys: string[],
    args: TArgs,
  ): Promise<TData> {
    return redis.evalsha(
      sha1,
      keys.length,
      ...keys,
      ...(args as string[]),
    ) as Promise<TData>;
  },
  decr(key: string): Promise<number> {
    return redis.decr(key);
  },
  del(key: string): Promise<number> {
    return redis.del(key);
  },
};

const rateLimitStore = new RedisStore({
  client: ioredisAdapter,
  prefix: RL_PREFIX,
});

/**
 * 统计写入失败的日志节流：Redis 故障时命中统计会对每个请求都失败，
 * 逐条 warn 会在故障期间淹没日志。每分钟最多报一次，并带上累计失败数。
 */
const STATS_LOG_INTERVAL_MS = 60_000;
let statsFailureCount = 0;
let statsFailureLoggedAt = 0;

function reportStatsFailure(scope: string, err: unknown): void {
  statsFailureCount += 1;
  const now = Date.now();
  if (now - statsFailureLoggedAt < STATS_LOG_INTERVAL_MS) return;
  statsFailureLoggedAt = now;
  const suppressed = statsFailureCount;
  statsFailureCount = 0;
  logger.warn(`[rate-limit] ${scope} stats write failed (${suppressed} occurrence(s) in the last minute)`, err);
}

/**
 * 计数身份生成器：返回不含规则名前缀的身份标识（IP / `u:{userId}` / `ip|path`）。
 * Redis 计数键由 buildLimiter 统一拼接 `{name}|{identity}` 做规则级隔离；
 * 统计与解封均使用裸身份，前后端不再各自拆前缀。
 */
function makeIdentityGen(rule: RuleConfig): (c: Context) => string {
  if (rule.keyType === 'user') {
    return (c) => {
      try {
        const u = currentUser();
        return u?.userId ? `u:${u.userId}` : getClientIp(c);
      } catch {
        return getClientIp(c);
      }
    };
  }
  if (rule.keyType === 'ip_path') {
    return (c) => `${getClientIp(c)}|${c.req.path}`;
  }
  return (c) => getClientIp(c);
}

/** 最近拦截记录的 zset member 结构（JSON 序列化，字段可含任意分隔符） */
export interface RecentBlockRecord {
  ts: number;
  key: string;
  path: string;
}

function buildLimiter(rule: RuleConfig): MiddlewareHandler {
  const identityGen = makeIdentityGen(rule);
  return rateLimiter({
    windowMs: rule.windowMs,
    limit: rule.limit,
    keyGenerator: (c) => `${rule.name}|${identityGen(c)}`,
    store: rateLimitStore,
    handler: async (c) => {
      try {
        const blockedKey = `${STATS_PREFIX}${rule.name}:blocked`;
        const recentKey = `${STATS_PREFIX}${rule.name}:recent`;
        const hourlyBlockedKey = `${STATS_PREFIX}${rule.name}:hourly:blocked`;
        const ts = Date.now();
        const hk = currentHourKey();
        const record: RecentBlockRecord = { ts, key: identityGen(c), path: c.req.path };
        await redis
          .multi()
          .incr(blockedKey)
          .expire(blockedKey, STATS_TTL)
          .zadd(recentKey, ts, JSON.stringify(record))
          .zremrangebyrank(recentKey, 0, -201)
          .expire(recentKey, STATS_TTL)
          .hincrby(hourlyBlockedKey, hk, 1)
          .expire(hourlyBlockedKey, HOURLY_TTL)
          .exec();
      } catch (err) {
        reportStatsFailure('blocked', err);
      }
      const retryAfterSec = Math.ceil(rule.windowMs / 1000);
      return c.json(errBody(rule.blockedMessage ?? '请求过于频繁，请稍后再试', 429), 429, {
        'Retry-After': String(retryAfterSec),
      });
    },
  });
}

function rebuildAll(): void {
  compiledLimiters.clear();
  for (const rule of ruleCache.values()) {
    compiledLimiters.set(rule.name, buildLimiter(rule));
  }
}
rebuildAll();

/**
 * 命中统计（fire-and-forget）：统计只服务于限流看板，其失败不应拖慢或中断被保护的接口。
 * 限流判定本身由调用方的 limiter 同步完成，不受影响。
 */
function recordHitStats(name: string): void {
  void (async () => {
    try {
      const k = `${STATS_PREFIX}${name}:hit`;
      const hk = currentHourKey();
      const hourlyHitsKey = `${STATS_PREFIX}${name}:hourly:hits`;
      await redis
        .multi()
        .incr(k)
        .expire(k, STATS_TTL)
        .hincrby(hourlyHitsKey, hk, 1)
        .expire(hourlyHitsKey, HOURLY_TTL)
        .exec();
    } catch (err) {
      reportStatsFailure('hit', err);
    }
  })();
}

/**
 * 同一请求内的规则去重标记：一条规则可能同时通过路由级 named 中间件与
 * 全局 pathBoundRateLimit（管理页可给任意规则配 pathPatterns）命中同一请求，
 * 不去重会对同一计数窗口 +2，实际限额减半。谁先应用谁生效，后者跳过。
 */
const APPLIED_VAR = 'rateLimitApplied';

function alreadyApplied(c: Context, name: string): boolean {
  const applied = c.get(APPLIED_VAR) as Set<string> | undefined;
  return applied?.has(name) ?? false;
}

function markApplied(c: Context, name: string): void {
  let applied = c.get(APPLIED_VAR) as Set<string> | undefined;
  if (!applied) {
    applied = new Set();
    c.set(APPLIED_VAR, applied);
  }
  applied.add(name);
}

function makeNamed(name: RateLimitName): MiddlewareHandler {
  return async (c, next) => {
    const rule = ruleCache.get(name);
    if (!rule?.enabled) return next();
    if (alreadyApplied(c, name)) return next();
    const limiter = compiledLimiters.get(name);
    if (!limiter) return next();
    markApplied(c, name);
    recordHitStats(name);
    return limiter(c, next);
  };
}

export const authRateLimit: MiddlewareHandler = makeNamed('auth');
export const captchaRateLimit: MiddlewareHandler = makeNamed('captcha');
export const sensitiveRateLimit: MiddlewareHandler = makeNamed('sensitive');

/** 内置规则名称集合（不可删除） */
export const PREDEFINED_NAMES = new Set(['auth', 'captcha', 'sensitive', 'analytics-ingest', 'error-report', 'report_public_share', 'workflow_public_callback', 'push_public_callback', 'chat_send', 'chatbi_ask', 'report_chatbi_write', 'report_fill_write', 'ai_chat_send', 'ai_share_view']);

/** 通过规则名称动态应用限流（支持自定义规则） */
export function namedRateLimit(name: string): MiddlewareHandler {
  return makeNamed(name as RateLimitName);
}

/** 全局路径绑定限流中间件：自动应用 pathPatterns 匹配的规则 */
export const pathBoundRateLimit: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  for (const rule of ruleCache.values()) {
    if (!rule.enabled || !rule.pathPatterns.length) continue;
    const matched = rule.pathPatterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        return path.startsWith(pattern.slice(0, -2));
      }
      return path === pattern;
    });
    if (matched) {
      if (alreadyApplied(c, rule.name)) return next();
      const limiter = compiledLimiters.get(rule.name);
      if (limiter) {
        markApplied(c, rule.name);
        recordHitStats(rule.name);
        return limiter(c, next);
      }
    }
  }
  return next();
};

/** 从数据库加载规则到内存缓存并重建限流器 */
export async function refreshRateLimitRules(): Promise<void> {
  try {
    const rows = await db.select().from(rateLimitRules);
    const next = new Map<string, RuleConfig>(Object.entries(DEFAULTS));
    for (const r of rows) {
      next.set(r.name, {
        name: r.name,
        description: r.description,
        windowMs: r.windowMs,
        limit: r.limit,
        keyType: r.keyType,
        enabled: r.enabled,
        blockedMessage: r.blockedMessage,
        pathPatterns: r.pathPatterns ?? [],
      });
    }
    ruleCache.clear();
    for (const [k, v] of next) ruleCache.set(k, v);
    rebuildAll();
    logger.info(`[rate-limit] reloaded ${rows.length} rule(s) from DB`);
  } catch (err) {
    logger.warn('[rate-limit] DB load failed, using defaults', err);
  }
}

/** 服务启动时调用，预热规则缓存 */
export async function bootstrapRateLimitRules(): Promise<void> {
  await refreshRateLimitRules();
}

/** 当前缓存中的所有规则配置 */
export function listRuleConfigs(): RuleConfig[] {
  return [...ruleCache.values()];
}

/**
 * 解封某个 key（清除该 key 在 rate-limit Redis 中的计数窗口）。
 *
 * `key` 为不含规则名前缀的计数身份（IP / `u:{userId}` / `ip|path`，
 * 与统计接口 recentBlocks 返回的 key 字段一致）；Redis 计数键为
 * `{name}|{identity}`（见 buildLimiter 的 keyGenerator），这里负责补回前缀。
 * 同时从最近拦截记录中移除该身份的条目。
 */
export async function unblockRateLimitKey(name: string, key: string): Promise<boolean> {
  const n = await redis.del(`${RL_PREFIX}${name}|${key}`);
  try {
    const recentKey = `${STATS_PREFIX}${name}:recent`;
    const members = await redis.zrange(recentKey, '0', '-1');
    const toRemove = members.filter((m) => {
      try {
        return (JSON.parse(m) as RecentBlockRecord).key === key;
      } catch {
        return false;
      }
    });
    if (toRemove.length > 0) await redis.zrem(recentKey, ...toRemove);
  } catch {
    /* ignore */
  }
  return n > 0;
}

export const RATE_LIMIT_KEYS = {
  rlPrefix: RL_PREFIX,
  statsPrefix: STATS_PREFIX,
} as const;
