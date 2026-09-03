/**
 * 通用 Redis 会话存储（管理员 / 会员会话共用的底层实现）。
 *
 * 通过 key 前缀参数化隔离不同用户体系（如 `session:` 与 `member-session:`），
 * 上层 session-manager / member-session-manager 各自实例化并保持原有导出 API。
 *
 * 每个登录会话由 jti 标识，对应三类 key：
 * - `{sessionPrefix}{jti}`   在线会话（滑动 TTL，供在线用户列表 / 活跃时间）
 * - `{refreshPrefix}{jti}`   refresh 授权（TTL = refresh token 有效期）。refresh token 只是承载 jti 的凭据，
 *                            能否续签以该 key 是否存在为准：登出 / 强制下线 / 改密即删除，续签时一次性消费并轮换到新 jti
 * - `{blacklistPrefix}{jti}` 吊销标记（TTL = access token 有效期），让尚未过期的 access token 立即失效
 *
 * 因此「登出」与「强制下线」语义一致：吊销 access token + 撤销 refresh 授权 + 删在线会话。
 */
import redis from './redis';
import { scanKeys } from './redis-scan';

export interface BaseSessionInfo {
  tokenId: string;
  loginAt: Date;
  lastActiveAt: Date;
}

export interface RedisSessionStoreOptions {
  /** 完整 session key 前缀（含命名空间），如 `zenith:session:` */
  sessionPrefix: string;
  /** 完整黑名单 key 前缀（含命名空间），如 `zenith:blacklist:` */
  blacklistPrefix: string;
  /** 完整 refresh 授权 key 前缀（含命名空间），如 `zenith:refresh:` */
  refreshPrefix: string;
  /** Session TTL（秒），默认 8h */
  sessionTtlSeconds?: number;
  /** Blacklist TTL（秒），默认 2h（与 accessToken 有效期一致） */
  blacklistTtlSeconds?: number;
  /** refresh 授权 TTL（秒），默认 30d（与 refreshToken 有效期一致） */
  refreshTtlSeconds?: number;
  /** lastActiveAt 回写节流间隔（毫秒）：TTL 每请求都续，活跃时间戳按此粒度更新 */
  activeAtRefreshMs?: number;
}

/** 反序列化并还原 Date 字段 */
function reviveSession<T extends BaseSessionInfo>(raw: string): T {
  const s = JSON.parse(raw) as T;
  s.loginAt = new Date(s.loginAt);
  s.lastActiveAt = new Date(s.lastActiveAt);
  return s;
}

export function createRedisSessionStore<T extends BaseSessionInfo>(options: RedisSessionStoreOptions) {
  const {
    sessionPrefix,
    blacklistPrefix,
    refreshPrefix,
    sessionTtlSeconds = 8 * 60 * 60,
    blacklistTtlSeconds = 2 * 60 * 60,
    refreshTtlSeconds = 30 * 24 * 60 * 60,
    activeAtRefreshMs = 60_000,
  } = options;

  const sessionKey = (tokenId: string) => `${sessionPrefix}${tokenId}`;
  const blacklistKey = (tokenId: string) => `${blacklistPrefix}${tokenId}`;
  const refreshKey = (tokenId: string) => `${refreshPrefix}${tokenId}`;

  /** 登录时注册会话 */
  async function register(info: Omit<T, 'lastActiveAt'>): Promise<void> {
    const session = { ...info, lastActiveAt: new Date() };
    await redis.set(sessionKey(info.tokenId), JSON.stringify(session), 'EX', sessionTtlSeconds);
  }

  /** 为 jti 签发 refresh 授权（登录 / 续签轮换时调用） */
  async function grantRefresh(tokenId: string): Promise<void> {
    await redis.set(refreshKey(tokenId), '1', 'EX', refreshTtlSeconds);
  }

  /** 一次性消费 refresh 授权：存在则删除并返回 true；不存在（已登出 / 已轮换 / 已过期）返回 false */
  async function consumeRefreshGrant(tokenId: string): Promise<boolean> {
    const value = await redis.getdel(refreshKey(tokenId));
    return value !== null;
  }

  /** 刷新会话活跃时间并重置 TTL。返回 false 表示会话不存在。 */
  async function touch(tokenId: string): Promise<boolean> {
    const key = sessionKey(tokenId);
    // GETEX 单次往返完成读取 + TTL 续期（替代 GET+SET 两次往返）
    const raw = await redis.getex(key, 'EX', sessionTtlSeconds);
    if (!raw) return false;
    const session: T = JSON.parse(raw);
    // lastActiveAt 仅按分钟级精度回写，避免每个请求都 JSON.stringify + SET
    const lastActive = new Date(session.lastActiveAt).getTime();
    if (!Number.isFinite(lastActive) || Date.now() - lastActive >= activeAtRefreshMs) {
      session.lastActiveAt = new Date();
      // XX：仅当 key 仍存在时写入，避免与强制下线的 del 竞争后复活会话
      await redis.set(key, JSON.stringify(session), 'EX', sessionTtlSeconds, 'XX');
    }
    return true;
  }

  /** 检查 token 是否已被吊销（登出 / 强制下线 / 续签轮换后的旧 jti） */
  async function isBlacklisted(tokenId: string): Promise<boolean> {
    const result = await redis.exists(blacklistKey(tokenId));
    return result === 1;
  }

  /**
   * 吊销一个 jti：拉黑 access token、撤销 refresh 授权、删在线会话。
   * 登出、强制下线、续签轮换淘汰旧 jti 都走这里；幂等，key 不存在也安全。
   */
  async function revoke(tokenId: string): Promise<void> {
    await Promise.all([
      redis.set(blacklistKey(tokenId), '1', 'EX', blacklistTtlSeconds),
      redis.del(sessionKey(tokenId), refreshKey(tokenId)),
    ]);
  }

  /** 强制下线某个会话。会话与 refresh 授权都不存在时返回 false（不做任何写入）。 */
  async function forceLogout(tokenId: string): Promise<boolean> {
    const [raw, grant] = await Promise.all([redis.get(sessionKey(tokenId)), redis.exists(refreshKey(tokenId))]);
    if (!raw && !grant) return false;
    await revoke(tokenId);
    return true;
  }

  /** 强制下线所有匹配的会话（单次 SCAN + pipeline），返回被下线的 tokenId 列表 */
  async function forceLogoutMatching(predicate: (session: T) => boolean): Promise<string[]> {
    const sessions = await getAll();
    const targets = sessions.filter((s) => predicate(s));
    if (targets.length === 0) return [];
    const pipeline = redis.pipeline();
    for (const s of targets) {
      pipeline.set(blacklistKey(s.tokenId), '1', 'EX', blacklistTtlSeconds);
      pipeline.del(sessionKey(s.tokenId), refreshKey(s.tokenId));
    }
    await pipeline.exec();
    return targets.map((s) => s.tokenId);
  }

  /** 正常登出：与强制下线同样吊销 access token 与 refresh 授权（不再只删会话） */
  async function remove(tokenId: string): Promise<void> {
    await revoke(tokenId);
  }

  /** 获取单个会话 */
  async function get(tokenId: string): Promise<T | null> {
    const raw = await redis.get(sessionKey(tokenId));
    if (!raw) return null;
    return reviveSession<T>(raw);
  }

  /** 获取所有在线会话（按登录时间倒序）*/
  async function getAll(): Promise<T[]> {
    const keys = await scanKeys(`${sessionPrefix}*`);
    if (keys.length === 0) return [];
    const values = await redis.mget(...keys);
    return values
      .filter((v): v is string => v !== null)
      .map((v) => reviveSession<T>(v))
      .sort((a, b) => b.loginAt.getTime() - a.loginAt.getTime());
  }

  /** 在线会话数 */
  async function count(): Promise<number> {
    const keys = await scanKeys(`${sessionPrefix}*`);
    return keys.length;
  }

  return {
    register, grantRefresh, consumeRefreshGrant, touch, isBlacklisted, revoke,
    forceLogout, forceLogoutMatching, remove, get, getAll, count,
  };
}
