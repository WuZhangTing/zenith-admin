import redis from '../redis';
import { config } from '../../config';
import { httpGet } from '../http-client';
import type { MpAccountRow } from '../../db/schema';
import { isSandboxAccount } from './sandbox';

const TOKEN_KEY_PREFIX = `${config.redis.keyPrefix}mp:access_token:`;
const WECHAT_API_BASE = 'https://api.weixin.qq.com';

/** access_token 提前过期的安全余量（秒），避免临界使用到已失效 token */
const TOKEN_EXPIRY_BUFFER = 300;

type MpCredential = Pick<MpAccountRow, 'id' | 'appId' | 'appSecret'>;

interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

/** 微信接口业务错误（errcode 非 0） */
export class WechatApiError extends Error {
  readonly errcode: number;

  constructor(errcode: number, errmsg: string) {
    super(`微信接口错误[${errcode}] ${errmsg}`);
    this.name = 'WechatApiError';
    this.errcode = errcode;
  }
}

function tokenKey(accountId: number): string {
  return `${TOKEN_KEY_PREFIX}${accountId}`;
}

/** 强制向微信服务器拉取新的 access_token 并写入 Redis 缓存。 */
export async function refreshMpAccessToken(account: MpCredential): Promise<string> {
  if (isSandboxAccount(account)) return 'sandbox-access-token';
  const url = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential`
    + `&appid=${encodeURIComponent(account.appId)}`
    + `&secret=${encodeURIComponent(account.appSecret)}`;
  // httpLog 关闭：URL 含 appSecret，避免写入出站日志
  const resp = await httpGet(url, { timeout: 10_000, httpLog: { level: 'off' } });
  const data = await resp.json<WechatTokenResponse>();
  if (!data.access_token) {
    throw new WechatApiError(data.errcode ?? -1, data.errmsg ?? '获取 access_token 失败');
  }
  const ttl = Math.max((data.expires_in ?? 7200) - TOKEN_EXPIRY_BUFFER, 60);
  await redis.set(tokenKey(account.id), data.access_token, 'EX', ttl);
  return data.access_token;
}

/** 获取 access_token：优先读 Redis 缓存，未命中则向微信拉取。 */
export async function getMpAccessToken(account: MpCredential): Promise<string> {
  if (isSandboxAccount(account)) return 'sandbox-access-token';
  const cached = await redis.get(tokenKey(account.id));
  if (cached) return cached;
  return refreshMpAccessToken(account);
}

/** 清除指定公众号缓存的 access_token（删除账号或更新凭证后调用）。 */
export async function clearMpAccessToken(accountId: number): Promise<void> {
  await redis.del(tokenKey(accountId));
}
