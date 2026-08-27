import { z } from 'zod';
import { IOT_TELEMETRY_BATCH_MAX } from './constants';

// ─── 管理端 ───────────────────────────────────────────────────────────────────
export const createIotProductSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(128),
  keyMetrics: z.array(z.string().min(1).max(64)).max(20).default([]),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateIotProductSchema = createIotProductSchema.partial();

export const createIotDeviceSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1, '设备名称不能为空').max(128),
  /** 留空自动生成；仅字母数字与连字符 */
  sn: z.string().min(4).max(64).regex(/^[0-9A-Za-z-]+$/, 'SN 仅支持字母、数字、连字符').optional(),
  firmwareVersion: z.string().max(32).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).nullable().optional(),
});

/** SN 一经接入不可变更 */
export const updateIotDeviceSchema = createIotDeviceSchema.omit({ sn: true }).partial();

export const sendIotCommandSchema = z.object({
  service: z.string().min(1, '指令名不能为空').max(64).regex(/^[a-zA-Z][a-zA-Z0-9_:.-]*$/, '指令名需以字母开头'),
  params: z.record(z.string(), z.unknown()).nullable().optional(),
  /** 超时秒数，默认 300 */
  ttlSeconds: z.number().int().min(10).max(86400).optional(),
});

// ─── 设备侧（ingest / WS 帧载荷）──────────────────────────────────────────────
const metricValueSchema = z.union([z.number(), z.string().max(256), z.boolean()]);

export const iotTelemetryItemSchema = z.object({
  metrics: z.record(z.string().min(1).max(64), metricValueSchema),
  /** YYYY-MM-DD HH:mm:ss 或 ISO；缺省取服务器时间 */
  reportedAt: z.string().max(32).optional(),
});

export const iotTelemetryIngestSchema = z.object({
  items: z.array(iotTelemetryItemSchema).min(1).max(IOT_TELEMETRY_BATCH_MAX),
  /** 顺带上报固件版本（首次连接/升级后） */
  firmwareVersion: z.string().max(32).optional(),
});

export const iotCommandAckSchema = z.object({
  success: z.boolean(),
  response: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMsg: z.string().max(256).optional(),
});

export type CreateIotProductInput = z.infer<typeof createIotProductSchema>;

export type UpdateIotProductInput = z.infer<typeof updateIotProductSchema>;

export type CreateIotDeviceInput = z.infer<typeof createIotDeviceSchema>;

export type UpdateIotDeviceInput = z.infer<typeof updateIotDeviceSchema>;

export type SendIotCommandInput = z.infer<typeof sendIotCommandSchema>;

export type IotTelemetryIngestInput = z.infer<typeof iotTelemetryIngestSchema>;

export type IotCommandAckInput = z.infer<typeof iotCommandAckSchema>;
