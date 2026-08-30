/**
 * 沙箱回调协议：sandbox 渠道配置接受统一的明文 JSON 测试报文，
 * 让回调全链路（验签 → 解析 → 幂等落库 → outbox 事件 → Webhook 投递）在沙箱环境可被真实触达，
 * 「模拟支付成功」与业务方联调共用生产同径的 handleNotify 入口。
 *
 * 安全边界：仅当渠道配置 sandbox=true 且请求头携带 `X-Sandbox-Notify: 1` 时生效；
 * 生产配置（sandbox=false）不受影响，仍走各渠道真实验签。
 */
import { formatDateTime, parseDateTimeInput } from '../datetime';
import type { AdapterContext, NotifyResult } from './types';

export const SANDBOX_NOTIFY_HEADER = 'X-Sandbox-Notify';

const SANDBOX_TRADE_STATUSES = ['success', 'closed', 'failed', 'refunded'] as const;

export interface SandboxNotifyPayload {
  sandbox: true;
  scene: 'payment' | 'refund';
  outTradeNo?: string;
  outRefundNo?: string;
  channelTradeNo?: string;
  channelRefundNo?: string;
  tradeStatus: (typeof SANDBOX_TRADE_STATUSES)[number];
  /** 实付金额（分） */
  paidAmount?: number;
  /** YYYY-MM-DD HH:mm:ss */
  paidAt?: string;
}

/** 构造沙箱回调报文（模拟支付/联调脚本用） */
export function buildSandboxNotifyBody(payload: Omit<SandboxNotifyPayload, 'sandbox'>): string {
  return JSON.stringify({ sandbox: true, ...payload });
}

/** 构造一条「支付成功」沙箱报文的便捷入口 */
export function buildSandboxPaidNotifyBody(input: { outTradeNo: string; paidAmount: number; channelTradeNo?: string }): string {
  return buildSandboxNotifyBody({
    scene: 'payment',
    outTradeNo: input.outTradeNo,
    channelTradeNo: input.channelTradeNo ?? `SIM${Date.now()}`,
    tradeStatus: 'success',
    paidAmount: input.paidAmount,
    paidAt: formatDateTime(new Date()),
  });
}

/**
 * 尝试按沙箱协议解析回调。
 * 返回 null 表示不适用（非沙箱配置或未携带协议头），调用方继续走真实渠道验签；
 * 返回 NotifyResult 时即为最终结果（valid=false 表示报文不合法，ACK 400 拒收）。
 */
export function trySandboxNotify(
  ctx: AdapterContext,
  rawBody: string,
  headers: Headers,
  successAck: NotifyResult['ack'],
): NotifyResult | null {
  if (!ctx.config.sandbox) return null;
  if (headers.get(SANDBOX_NOTIFY_HEADER) !== '1') return null;

  const invalidAck: NotifyResult['ack'] = { body: 'invalid sandbox notify', contentType: 'text/plain', status: 400 };
  let data: Partial<SandboxNotifyPayload>;
  try {
    data = JSON.parse(rawBody) as Partial<SandboxNotifyPayload>;
  } catch {
    return { valid: false, scene: 'payment', tradeStatus: 'unknown', ack: invalidAck, message: '沙箱回调报文解析失败（须为 JSON）' };
  }
  if (data.sandbox !== true || (data.scene !== 'payment' && data.scene !== 'refund')) {
    return { valid: false, scene: 'payment', tradeStatus: 'unknown', ack: invalidAck, message: '沙箱回调报文缺少 sandbox/scene 标记' };
  }
  if (!SANDBOX_TRADE_STATUSES.includes(data.tradeStatus as (typeof SANDBOX_TRADE_STATUSES)[number])) {
    return { valid: false, scene: data.scene, tradeStatus: 'unknown', ack: invalidAck, message: `沙箱回调 tradeStatus 不合法：${String(data.tradeStatus)}` };
  }
  return {
    valid: true,
    scene: data.scene,
    ack: successAck,
    outTradeNo: data.outTradeNo,
    outRefundNo: data.outRefundNo,
    channelTradeNo: data.channelTradeNo,
    channelRefundNo: data.channelRefundNo,
    tradeStatus: data.tradeStatus as NotifyResult['tradeStatus'],
    paidAmount: typeof data.paidAmount === 'number' ? data.paidAmount : undefined,
    paidAt: data.paidAt ? (parseDateTimeInput(data.paidAt) ?? undefined) : undefined,
    raw: data,
  };
}
