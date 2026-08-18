/**
 * 邮件退订令牌：HMAC 签名的无状态令牌。
 *
 * 不建令牌表——退订的最终状态本来就落在 notification_preferences，
 * 令牌只需要证明「这个链接确实是我们发给这位收件人的」。撤销即删除偏好行。
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config';

export interface UnsubscribePayload {
  recipientType: 'user' | 'member';
  recipientId: number;
  /** event = 退订该事件的邮件；all-email = 退订全部事件的邮件 */
  scope: 'event' | 'all-email';
  eventKey?: string;
  /** 过期时间戳（ms） */
  exp: number;
}

const DEFAULT_TTL_DAYS = 60;

function sign(data: string): string {
  return createHmac('sha256', config.jwtSecret).update(`notification-unsubscribe:${data}`).digest('base64url');
}

export function createUnsubscribeToken(
  payload: Omit<UnsubscribePayload, 'exp'>,
  ttlDays = DEFAULT_TTL_DAYS,
): string {
  const full: UnsubscribePayload = { ...payload, exp: Date.now() + ttlDays * 86_400_000 };
  const data = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(data);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  let payload: UnsubscribePayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as UnsubscribePayload;
  } catch {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  if (payload.recipientType !== 'user' && payload.recipientType !== 'member') return null;
  if (!Number.isInteger(payload.recipientId) || payload.recipientId <= 0) return null;
  if (payload.scope !== 'event' && payload.scope !== 'all-email') return null;
  if (payload.scope === 'event' && !payload.eventKey) return null;
  return payload;
}

/** 退订链接（指向公开确认页，人点确认、邮件客户端 One-Click 直接 POST）。 */
export function buildUnsubscribeUrl(payload: Omit<UnsubscribePayload, 'exp'>): string {
  return `${config.publicBaseUrl}/api/notification-unsubscribe/${createUnsubscribeToken(payload)}`;
}
