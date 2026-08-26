/**
 * App 推送发送适配（聚合供应商）。
 *
 * 与 sms-sender 同构:provider 可插拔,当前实现极光 JPush REST API v3。
 * 厂商通道（华为/小米/OV/荣耀/APNs）凭证全部配置在供应商后台,服务端只持有
 * 聚合商的 appKey/masterSecret,通过 `lib/http-client` 直接调 REST,不引 SDK。
 */
import type { PushConfigRow } from '../db/schema';
import { httpPost } from './http-client';

/** 极光单次调用的 registration_id 上限 */
const JPUSH_BATCH_LIMIT = 1000;

export interface PushSendInput {
  config: PushConfigRow;
  registrationIds: string[];
  title: string;
  content: string;
  /** 点击跳转深链,放进 extras.link 由客户端解析 */
  link?: string | null;
  extras?: Record<string, string>;
}

export interface PushSendResult {
  success: boolean;
  /** 供应商消息 ID（多批时取首批） */
  msgId?: string;
  errorMsg?: string;
}

interface JPushResponse {
  msg_id?: string | number;
  error?: { code: number; message: string };
}

async function sendByJPush(input: PushSendInput): Promise<PushSendResult> {
  const { config, title, content } = input;
  const auth = Buffer.from(`${config.appKey}:${config.masterSecret}`).toString('base64');
  const extras: Record<string, string> = { ...input.extras };
  if (input.link) extras.link = input.link;

  let firstMsgId: string | undefined;
  for (let i = 0; i < input.registrationIds.length; i += JPUSH_BATCH_LIMIT) {
    const batch = input.registrationIds.slice(i, i + JPUSH_BATCH_LIMIT);
    const res = await httpPost('https://api.jpush.cn/v3/push', {
      platform: 'all',
      audience: { registration_id: batch },
      notification: {
        alert: content,
        android: { title, alert: content, extras },
        ios: { alert: { title, body: content }, sound: 'default', extras },
      },
      options: { apns_production: config.apnsProduction, time_to_live: 86400 },
    }, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10_000,
      // 凭证经 Basic 头传输,不落请求日志
      httpLog: { level: 'off' },
    });

    const body = await res.json<JPushResponse>().catch(() => ({} as JPushResponse));
    if (!res.ok || body.error) {
      const detail = body.error ? `[${body.error.code}] ${body.error.message}` : `HTTP ${res.status}`;
      return { success: false, msgId: firstMsgId, errorMsg: `极光推送失败: ${detail}` };
    }
    if (!firstMsgId && body.msg_id !== undefined) firstMsgId = String(body.msg_id);
  }
  return { success: true, msgId: firstMsgId };
}

/** 按配置的 provider 分发到对应实现 */
export async function sendPushByProvider(input: PushSendInput): Promise<PushSendResult> {
  if (input.registrationIds.length === 0) {
    return { success: false, errorMsg: '没有可投递的设备' };
  }
  try {
    switch (input.config.provider) {
      case 'jpush':
        return await sendByJPush(input);
      default:
        return { success: false, errorMsg: `不支持的推送供应商: ${input.config.provider as string}` };
    }
  } catch (err) {
    return { success: false, errorMsg: err instanceof Error ? err.message : String(err) };
  }
}
