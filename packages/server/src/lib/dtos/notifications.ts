/**
 * 通知中心 DTO：偏好矩阵 / 全局设置 / 策略事件 / 派发日志
 */
import { z } from '@hono/zod-openapi';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DECISIONS,
  NOTIFICATION_DIGEST_MODES,
  NOTIFICATION_EVENT_GROUPS,
  NOTIFICATION_RECIPIENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '@zenith/shared/messaging';

const matrixChannelSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  available: z.boolean(),
  enabled: z.boolean(),
  locked: z.boolean(),
  defaultEnabled: z.boolean(),
});

const matrixEventSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  severity: z.enum(NOTIFICATION_SEVERITIES),
  mandatory: z.boolean(),
  channels: z.array(matrixChannelSchema),
});

export const NotificationMatrixGroupDTO = z
  .object({
    group: z.enum(NOTIFICATION_EVENT_GROUPS),
    label: z.string(),
    events: z.array(matrixEventSchema),
  })
  .openapi('NotificationMatrixGroup');

export const NotificationSettingsDTO = z
  .object({
    recipientType: z.enum(NOTIFICATION_RECIPIENT_TYPES),
    recipientId: z.number().int(),
    globalMuted: z.boolean(),
    timezone: z.string(),
    quietStart: z.string().nullable(),
    quietEnd: z.string().nullable(),
    digestMode: z.enum(NOTIFICATION_DIGEST_MODES),
    digestHour: z.number().int(),
    updatedAt: z.string(),
  })
  .openapi('NotificationSettings');

const policyChannelSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  available: z.boolean(),
  defaultEnabled: z.boolean(),
  override: z.object({ enabled: z.boolean(), locked: z.boolean() }).nullable(),
});

export const NotificationPolicyEventDTO = z
  .object({
    key: z.string(),
    group: z.enum(NOTIFICATION_EVENT_GROUPS),
    groupLabel: z.string(),
    label: z.string(),
    description: z.string().optional(),
    severity: z.enum(NOTIFICATION_SEVERITIES),
    mandatory: z.boolean(),
    bypassQuietHours: z.boolean(),
    channels: z.array(policyChannelSchema),
  })
  .openapi('NotificationPolicyEvent');

export const NotificationDispatchDTO = z
  .object({
    id: z.number().int(),
    outboxId: z.number().int().nullable(),
    eventKey: z.string(),
    eventLabel: z.string(),
    recipientType: z.enum(NOTIFICATION_RECIPIENT_TYPES),
    recipientId: z.number().int().nullable(),
    recipientName: z.string().nullable(),
    recipientAddress: z.string().nullable(),
    channel: z.enum(NOTIFICATION_CHANNELS),
    decision: z.enum(NOTIFICATION_DECISIONS),
    reasonCode: z.string().nullable(),
    reasonDetail: z.string().nullable(),
    providerMsgId: z.string().nullable(),
    tenantId: z.number().int().nullable(),
    createdAt: z.string(),
  })
  .openapi('NotificationDispatch');
