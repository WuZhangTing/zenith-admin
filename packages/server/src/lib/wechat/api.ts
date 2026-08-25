import { httpGet, httpPost } from '../http-client';
import type { MpAccountRow } from '../../db/schema';
import { getMpAccessToken, refreshMpAccessToken, WechatApiError } from './access-token';
import { isSandboxAccount, sandboxCall } from './sandbox';

const WECHAT_API_BASE = 'https://api.weixin.qq.com';

/** access_token 失效相关错误码：触发刷新后重试一次 */
const TOKEN_INVALID_CODES = new Set([40001, 40014, 42001]);

export type MpCredential = Pick<MpAccountRow, 'id' | 'appId' | 'appSecret'>;

interface WechatErrorFields {
  errcode?: number;
  errmsg?: string;
}

function ensureOk<T extends WechatErrorFields>(data: T): T {
  if (data.errcode && data.errcode !== 0) {
    throw new WechatApiError(data.errcode, data.errmsg ?? '微信接口调用失败');
  }
  return data;
}

/** 统一执行微信接口调用：token 失效时自动刷新并重试一次 */
async function callWithToken<T extends WechatErrorFields>(
  account: MpCredential,
  doCall: (token: string) => Promise<T>,
): Promise<T> {
  const token = await getMpAccessToken(account);
  const data = await doCall(token);
  if (data.errcode && TOKEN_INVALID_CODES.has(data.errcode)) {
    const fresh = await refreshMpAccessToken(account);
    return ensureOk(await doCall(fresh));
  }
  return ensureOk(data);
}

/** 调用微信 GET 接口（自动注入 access_token；沙箱账号短路返回模拟响应） */
export async function wechatApiGet<T extends WechatErrorFields>(
  account: MpCredential,
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (isSandboxAccount(account)) return sandboxCall<T>(path, params);
  return callWithToken(account, async (token) => {
    const qs = new URLSearchParams({ access_token: token });
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
    const resp = await httpGet(`${WECHAT_API_BASE}${path}?${qs.toString()}`, { timeout: 10_000, httpLog: { level: 'off' } });
    return resp.json<T>();
  });
}

/** 调用微信 POST 接口（自动注入 access_token；沙箱账号短路返回模拟响应） */
export async function wechatApiPost<T extends WechatErrorFields>(
  account: MpCredential,
  path: string,
  body: Record<string, unknown> | unknown[],
): Promise<T> {
  if (isSandboxAccount(account)) return sandboxCall<T>(path, body);
  return callWithToken(account, async (token) => {
    const resp = await httpPost(`${WECHAT_API_BASE}${path}?access_token=${encodeURIComponent(token)}`, body, { timeout: 10_000, httpLog: { level: 'off' } });
    return resp.json<T>();
  });
}
