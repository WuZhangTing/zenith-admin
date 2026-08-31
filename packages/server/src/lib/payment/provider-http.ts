import { HTTPException } from 'hono/http-exception';
import { config } from '../../config';
import type { HttpRequestOptions } from '../http-client';

const OFFICIAL_GATEWAY_HOSTS: Readonly<Record<'alipay' | 'unionpay', ReadonlySet<string>>> = {
  alipay: new Set(['openapi.alipay.com', 'openapi.alipaydev.com']),
  unionpay: new Set(['gateway.95516.com']),
};

/** 自定义网关只允许渠道官方 HTTPS 主机，避免配置项成为任意出站代理。 */
export function assertApprovedProviderGateway(rawUrl: string, provider: 'alipay' | 'unionpay'): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HTTPException(400, { message: `${provider === 'alipay' ? '支付宝' : '云闪付'}网关地址无效` });
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new HTTPException(400, { message: '支付渠道网关必须使用 HTTPS，且不得携带用户名或密码' });
  }
  if (!OFFICIAL_GATEWAY_HOSTS[provider].has(url.hostname.toLowerCase())) {
    throw new HTTPException(400, { message: '支付渠道网关主机不在官方允许列表中' });
  }
  return url.toString();
}

/** 渠道外呼统一策略：硬超时、socket 级 SSRF 防护、禁止自动重试资金请求。 */
export function providerHttpOptions(): Pick<HttpRequestOptions, 'timeout' | 'retries' | 'ssrfProtection' | 'httpLog'> {
  return {
    timeout: config.payment.providerTimeoutMs,
    retries: 0,
    ssrfProtection: true,
    httpLog: { level: 'off' },
  };
}
