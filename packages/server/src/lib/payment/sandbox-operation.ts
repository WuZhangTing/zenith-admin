import { createHash, createHmac } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import type { AdapterContext } from './types';

type SandboxOperationValue = string | number | boolean | null | undefined;

/** 为沙箱资金操作生成确定性渠道号和 HMAC 留痕，模拟真实渠道签名边界。 */
export function buildSignedSandboxOperation(
  ctx: AdapterContext,
  prefix: string,
  operation: string,
  payload: Record<string, SandboxOperationValue>,
) {
  if (!ctx.config.sandbox) {
    throw new HTTPException(400, { message: `CAPABILITY_UNSUPPORTED: ${ctx.config.channel}/${operation}/live` });
  }
  const secret = ctx.secrets.sandboxNotifySecret;
  if (!secret) throw new HTTPException(400, { message: '沙箱操作签名密钥不可用' });
  const canonicalPayload = Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const body = JSON.stringify({
    sandbox: true,
    channelConfigId: ctx.config.id,
    operation,
    payload: canonicalPayload,
  });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  const reference = `${prefix}${createHash('sha256').update(body).digest('hex').slice(0, 28).toUpperCase()}`;
  return {
    reference,
    raw: { sandbox: true, channelConfigId: ctx.config.id, operation, payload: canonicalPayload, signature },
  };
}
