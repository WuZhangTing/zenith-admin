/**
 * 告警通知的统一派发层（Webhook / 邮件 / 站内信）。
 *
 * 抽出公共实现的直接原因：站内信渠道此前在监控告警与错误告警里都只写了一行日志，
 * 而 UI 把「站内信」作为合法渠道（且是新建规则的默认渠道），`validateAlertDelivery`
 * 也强制要求填接收人——用户配置完全正确却收不到任何通知，且没有任何报错。
 * 各域自行拼一遍三渠道分发正是这类静默失效的温床，因此统一收口到此处。
 */
import { eq, inArray, or } from 'drizzle-orm';
import type { InAppMessageType } from '@zenith/shared/messaging';
import { db } from '../db';
import { users } from '../db/schema';
import { sendMail } from './email';
import { httpPost } from './http-client';
import logger from './logger';
import { buildWhere } from './where-helpers';
import { sendSystemInApp } from '../services/messaging/in-app-messages.service';

const WEBHOOK_TIMEOUT_MS = 8000;

export interface AlertDispatchTarget {
  /** 已配置的通知渠道：email / webhook / inapp */
  channels: readonly string[];
  webhookUrl: string | null;
  /** 接收人标识：邮箱（邮件渠道直接使用）或用户名（站内信渠道解析为用户） */
  recipients: readonly string[];
  /** 规则所属租户；为空表示平台级规则 */
  tenantId: number | null;
}

export interface AlertDispatchPayload {
  /** 邮件主题 */
  subject: string;
  /** 邮件正文（HTML） */
  html: string;
  /** 站内信标题 */
  title: string;
  /** 站内信正文（纯文本） */
  content: string;
  inAppType?: InAppMessageType;
  /** 站内信幂等键：同一次触发重复派发时不会产生重复消息 */
  dedupeKey?: string;
  /** Webhook 请求体 */
  webhookBody: Record<string, unknown>;
  /** 日志前缀，如 `MonitorAlert` */
  logTag: string;
}

/**
 * 把规则里的接收人标识解析为站内信收件用户。
 *
 * 接收人既可能填邮箱（邮件渠道的自然形态）也可能填用户名，因此两列都匹配；
 * 停用账号不再接收告警。租户为空的平台级规则不限制租户范围，与 `tenantCondition`
 * 中平台管理员的可见范围保持一致。
 */
async function resolveRecipientUserIds(recipients: readonly string[], tenantId: number | null): Promise<number[]> {
  const identifiers = [...new Set(recipients.map((r) => r.trim()).filter(Boolean))];
  if (identifiers.length === 0) return [];
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(buildWhere(
      or(inArray(users.email, identifiers), inArray(users.username, identifiers)),
      eq(users.status, 'enabled'),
      tenantId == null ? undefined : eq(users.tenantId, tenantId),
    ));
  return rows.map((r) => r.id);
}

/**
 * 按配置的渠道派发一条告警通知。
 *
 * 单个渠道失败不影响其他渠道（各渠道彼此独立），失败会记日志但不抛出——
 * 告警评估器的状态机推进不应因为下游通知不可用而中断。
 */
export async function dispatchAlertChannels(target: AlertDispatchTarget, payload: AlertDispatchPayload): Promise<void> {
  const channels = target.channels ?? [];
  const tasks: Promise<unknown>[] = [];

  if (channels.includes('webhook') && target.webhookUrl) {
    tasks.push(httpPost(target.webhookUrl, payload.webhookBody, { timeout: WEBHOOK_TIMEOUT_MS, ssrfProtection: true }));
  }

  if (channels.includes('email')) {
    for (const to of target.recipients.filter((r) => r.includes('@'))) {
      tasks.push(sendMail(to, payload.subject, payload.html));
    }
  }

  if (channels.includes('inapp')) {
    tasks.push((async () => {
      const userIds = await resolveRecipientUserIds(target.recipients, target.tenantId);
      if (userIds.length === 0) {
        logger.warn(`[${payload.logTag}] 站内信接收人未匹配到任何启用用户，本次站内通知未送达`, {
          recipients: target.recipients,
          tenantId: target.tenantId,
        });
        return;
      }
      await sendSystemInApp({
        userIds,
        title: payload.title,
        content: payload.content,
        type: payload.inAppType ?? 'warning',
        tenantId: target.tenantId,
        dedupeKey: payload.dedupeKey,
      });
    })());
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error(`[${payload.logTag}] 告警通知派发失败`, { err: result.reason });
    }
  }
}
