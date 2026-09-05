import * as z from 'zod';

// ─── 实体 ────────────────────────────────────────────────────────────────────

export const operationLogSchema = z.object({
  id: z.int(),
  userId: z.int().nullable(),
  username: z.string().nullable(),
  nickname: z.string().nullable().optional().meta({ description: '用户当前昵称（按 username 关联补充；用户已删除时为 null）' }),
  module: z.string().nullable(),
  description: z.string(),
  method: z.string(),
  path: z.string(),
  requestId: z.string().nullable().optional().meta({ description: '链路 ID（= 请求的 X-Request-Id），可跳转链路追踪' }),
  requestBody: z.string().nullable(),
  beforeData: z.string().nullable(),
  afterData: z.string().nullable(),
  responseCode: z.int().nullable(),
  responseBody: z.string().nullable(),
  durationMs: z.int().nullable(),
  ip: z.string().nullable(),
  location: z.string().nullable().optional(),
  userAgent: z.string().nullable(),
  os: z.string().nullable(),
  browser: z.string().nullable(),
  tenantId: z.int().nullable().optional(),
  createdAt: z.string(),
}).meta({ id: 'OperationLog' });

export type OperationLog = z.infer<typeof operationLogSchema>;
