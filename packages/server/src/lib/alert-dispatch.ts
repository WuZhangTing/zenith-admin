/**
 * 告警通知的统一派发层（Webhook / 邮件 / 站内信）。
 *
 * 抽出公共实现的直接原因：站内信渠道此前在监控告警与错误告警里都只写了一行日志，
 * 而 UI 把「站内信」作为合法渠道（且是新建规则的默认渠道），`validateAlertDelivery`
 * 也强制要求填接收人——用户配置完全正确却收不到任何通知，且没有任何报错。
 * 各域自行拼一遍三渠道分发正是这类静默失效的温床，因此统一收口到此处。
 */
import { eq, inArray, or, type SQL } from 'drizzle-orm';
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
  /** 旧式混合标识，仅供尚未迁移的告警域使用 */
  recipients?: readonly string[];
  /** 系统用户：站内信直接投递；邮件渠道实时读取账户当前邮箱 */
  recipientUserIds?: readonly number[];
  /** 不绑定系统用户的额外邮箱 */
  recipientEmails?: readonly string[];
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
 * 解析本次派发涉及的系统用户。
 *
 * 新模型直接使用稳定用户 ID；尚未迁移的告警域仍可传邮箱 / 用户名标识。
 * 停用账号不再接收告警。租户为空的平台级规则不限制租户范围。
 */
interface ResolvedRecipientUser {
  id: number;
  email: string | null;
}

async function resolveRecipientUsers(target: AlertDispatchTarget): Promise<ResolvedRecipientUser[]> {
  const userIds = [...new Set((target.recipientUserIds ?? []).filter((id) => Number.isInteger(id) && id > 0))];
  const identifiers = [...new Set((target.recipients ?? []).map((recipient) => recipient.trim()).filter(Boolean))];
  const recipientConditions: SQL[] = [];
  if (userIds.length > 0) recipientConditions.push(inArray(users.id, userIds));
  if (identifiers.length > 0) {
    recipientConditions.push(inArray(users.email, identifiers), inArray(users.username, identifiers));
  }
  if (recipientConditions.length === 0) return [];

  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(buildWhere(
      or(...recipientConditions),
      eq(users.status, 'enabled'),
      target.tenantId == null ? undefined : eq(users.tenantId, target.tenantId),
    ));
  return rows;
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
  const recipientUsers = (channels.includes('inapp') || channels.includes('email'))
    ? resolveRecipientUsers(target)
    : Promise.resolve([]);

  if (channels.includes('webhook') && target.webhookUrl) {
    tasks.push(httpPost(target.webhookUrl, payload.webhookBody, { timeout: WEBHOOK_TIMEOUT_MS, ssrfProtection: true }));
  }

  if (channels.includes('email')) {
    tasks.push((async () => {
      const usersForDelivery = await recipientUsers;
      const emails = new Set(
        [
          ...(target.recipientEmails ?? []),
          ...(target.recipients ?? []).filter((recipient) => recipient.includes('@')),
          ...usersForDelivery.map((user) => user.email).filter((email): email is string => Boolean(email)),
        ]
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      );
      if (emails.size === 0) {
        logger.warn(`[${payload.logTag}] 邮件接收目标没有可用邮箱，本次邮件未送达`, {
          recipientUserCount: target.recipientUserIds?.length ?? 0,
          externalEmailCount: target.recipientEmails?.length ?? 0,
          tenantId: target.tenantId,
        });
        return;
      }
      await Promise.all([...emails].map((email) => sendMail(email, payload.subject, payload.html)));
    })());
  }

  if (channels.includes('inapp')) {
    tasks.push((async () => {
      const userIds = (await recipientUsers).map((user) => user.id);
      if (userIds.length === 0) {
        logger.warn(`[${payload.logTag}] 站内信接收人未匹配到任何启用用户，本次站内通知未送达`, {
          recipientUserCount: target.recipientUserIds?.length ?? 0,
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
