import * as z from 'zod';
import { defineContract, op } from '../../core/contract';
import { IOT_SIGN_HEADER, IOT_TIMESTAMP_HEADER } from '../constants';
import {
  iotCommandAckSchema, iotEventIngestSchema, iotGatewayBatchSchema, iotGatewayEventSchema,
  iotLogIngestSchema, iotOtaProgressSchema, iotRegisterDeviceSchema, iotTelemetryIngestSchema,
} from '../validation';
import { iotMetricsSchema } from './devices';
import { iotOtaPayloadSchema } from './ota';

// ─── 设备侧载荷 ───────────────────────────────────────────────────────────────

/** 设备侧指令载荷（WS command:exec 帧 / 心跳响应捎带） */
export const iotCommandPayloadSchema = z.object({
  commandId: z.int(),
  service: z.string(),
  params: z.record(z.string(), z.unknown()).nullable(),
  expireAt: z.string(),
}).meta({ id: 'IotCommandPayload' });

export type IotCommandPayload = z.infer<typeof iotCommandPayloadSchema>;

/** 设备侧期望属性载荷（WS shadow:desired 帧 / 心跳响应捎带） */
export const iotDesiredPayloadSchema = z.object({
  version: z.int(),
  desired: iotMetricsSchema,
}).meta({ id: 'IotDesiredPayload' });

export type IotDesiredPayload = z.infer<typeof iotDesiredPayloadSchema>;

export const iotIngestAcceptedSchema = z.object({
  accepted: z.int(),
}).meta({ id: 'IotIngestAccepted' });

export type IotIngestAccepted = z.infer<typeof iotIngestAcceptedSchema>;

/** 网关代理上报结果：归属校验失败的条目静默丢弃并计入 rejected */
export const iotGatewayIngestResultSchema = z.object({
  accepted: z.int(),
  rejected: z.int(),
}).meta({ id: 'IotGatewayIngestResult' });

export type IotGatewayIngestResult = z.infer<typeof iotGatewayIngestResultSchema>;

/** 心跳响应：待执行指令、待同步期望属性与待升级固件 */
export const iotHeartbeatResultSchema = z.object({
  commands: z.array(iotCommandPayloadSchema),
  desired: iotDesiredPayloadSchema.nullable(),
  ota: iotOtaPayloadSchema.nullable(),
}).meta({ id: 'IotHeartbeatResult' });

export type IotHeartbeatResult = z.infer<typeof iotHeartbeatResultSchema>;

/** 动态注册成功：设备须持久化 secret */
export const iotRegisterResultSchema = z.object({
  deviceId: z.int(),
  sn: z.string(),
  secret: z.string(),
}).meta({ id: 'IotRegisterResult' });

export type IotRegisterResult = z.infer<typeof iotRegisterResultSchema>;

// ─── 入参 ────────────────────────────────────────────────────────────────────

export const iotCommandIdParam = z.object({
  commandId: z.coerce.number().int().positive().meta({ description: '指令 ID', example: 1 }),
});

/** 固件下载以查询串携带签名参数（对空串签名） */
export const iotFirmwareDownloadQuery = z.object({
  taskId: z.coerce.number().int().positive().meta({ description: '升级任务 ID', example: 1 }),
  sn: z.string().meta({ description: '设备 SN' }),
  ts: z.string().meta({ description: '签名时间戳（秒）' }),
  sign: z.string().meta({ description: 'HMAC-SHA256(secret, `${sn}\\n${ts}\\n`) 的 hex' }),
});

// ─── 契约 ────────────────────────────────────────────────────────────────────

/**
 * 设备侧接口以设备签名鉴权（security: device-signature，签名基于原始请求体）；
 * 固件下载以查询串携带同款签名参数（对空串签名）；动态注册无需任何凭证（产品注册密钥签名在服务内校验）。
 */
export const iotIngestContract = defineContract('/api/iot/ingest', {
  telemetry: op.post('/telemetry', {
    body: iotTelemetryIngestSchema,
    response: iotIngestAcceptedSchema,
    security: 'device-signature',
    summary: '批量上报遥测（自动续期在线态）',
  }),
  events: op.post('/events', {
    body: iotEventIngestSchema,
    response: iotIngestAcceptedSchema,
    security: 'device-signature',
    summary: '批量上报设备事件（按物模型解析级别，触发事件类告警）',
  }),
  logs: op.post('/logs', {
    body: iotLogIngestSchema,
    response: iotIngestAcceptedSchema,
    security: 'device-signature',
    summary: '批量上报设备运行日志',
  }),
  gatewayTelemetry: op.post('/gateway/telemetry', {
    body: iotGatewayBatchSchema,
    response: iotGatewayIngestResultSchema,
    security: 'device-signature',
    summary: '网关批量代理子设备遥测（网关身份签名，子设备免密）',
  }),
  gatewayEvents: op.post('/gateway/events', {
    body: iotGatewayEventSchema,
    response: iotGatewayIngestResultSchema,
    security: 'device-signature',
    summary: '网关代理子设备事件',
  }),
  heartbeat: op.post('/heartbeat', {
    response: iotHeartbeatResultSchema,
    security: 'device-signature',
    summary: '心跳（body 可为空对象），响应携带待执行指令、期望属性与待升级固件',
  }),
  otaProgress: op.post('/ota/progress', {
    body: iotOtaProgressSchema,
    security: 'device-signature',
    summary: 'OTA 进度回报（downloading/installing 带进度，succeeded/failed 终态）',
  }),
  otaFirmware: op.get('/ota/firmware', {
    query: iotFirmwareDownloadQuery,
    kind: 'file',
    security: 'device-signature',
    summary: '固件下载（302 跳转存储直链）',
    description: '签名参数在查询串 sn / ts / sign 中携带（对空串签名），成功时 302 重定向到固件文件访问地址。',
  }),
  commandAck: op.post('/commands/{commandId}/ack', {
    params: iotCommandIdParam,
    body: iotCommandAckSchema,
    security: 'device-signature',
    summary: '指令执行回执',
  }),
  register: op.post('/register', {
    body: iotRegisterDeviceSchema,
    response: iotRegisterResultSchema,
    public: true,
    summary: '一型一密动态注册（产品注册密钥签名，白名单核销后返回设备密钥）',
    description: `请求头携带 ${IOT_TIMESTAMP_HEADER} / ${IOT_SIGN_HEADER}（HMAC-SHA256(registrationSecret, \`\${sn}\\n\${ts}\\n\${rawBody}\`) 的 hex），SN 须在产品白名单内。`,
  }),
}, { tags: ['IoT 设备接入'] });