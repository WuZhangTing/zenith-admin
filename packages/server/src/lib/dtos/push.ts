/**
 * App 推送 DTO（配置 / 发送记录）。
 */
import { z } from '@hono/zod-openapi';
import { PUSH_DELIVERY_STATUSES, PUSH_PROVIDERS } from '@zenith/shared/messaging';

export const PushConfigDTO = z
  .object({
    id: z.number().int(),
    appId: z.number().int(),
    appName: z.string().optional(),
    name: z.string(),
    provider: z.enum(PUSH_PROVIDERS),
    appKey: z.string(),
    masterSecret: z.string().optional(),
    apnsProduction: z.boolean(),
    status: z.enum(['enabled', 'disabled']),
    remark: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('PushConfig');

export const PushSendLogDTO = z
  .object({
    id: z.number().int(),
    configId: z.number().int().nullable().optional(),
    appId: z.number().int().nullable().optional(),
    appName: z.string().nullable().optional(),
    provider: z.enum(PUSH_PROVIDERS),
    subjectType: z.string().nullable().optional(),
    subjectId: z.number().int().nullable().optional(),
    subjectName: z.string().nullable().optional(),
    deviceCount: z.number().int(),
    title: z.string(),
    content: z.string(),
    link: z.string().nullable().optional(),
    eventKey: z.string().nullable().optional(),
    status: z.enum(['pending', 'success', 'failed']),
    providerMsgId: z.string().nullable().optional(),
    deliveryStatus: z.enum(PUSH_DELIVERY_STATUSES).nullable().optional(),
    deliveredAt: z.string().nullable().optional(),
    clickedAt: z.string().nullable().optional(),
    errorMsg: z.string().nullable().optional(),
    source: z.enum(['manual', 'test', 'system', 'api']),
    tenantId: z.number().int().nullable().optional(),
    sentAt: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('PushSendLog');

const PushTrendPointDTO = z.object({
  date: z.string(),
  total: z.number().int(),
  success: z.number().int(),
  failed: z.number().int(),
  delivered: z.number().int(),
  clicked: z.number().int(),
});

export const PushSendLogStatsDTO = z
  .object({
    totals: z.object({
      total: z.number().int(),
      success: z.number().int(),
      failed: z.number().int(),
      delivered: z.number().int(),
      clicked: z.number().int(),
    }),
    trend: z.array(PushTrendPointDTO),
  })
  .openapi('PushSendLogStats');
