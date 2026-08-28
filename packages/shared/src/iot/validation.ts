import { z } from 'zod';
import {
  IOT_ACCESS_MODES, IOT_ALARM_LEVELS, IOT_ALARM_RULE_TYPES, IOT_BATCH_DEVICE_MAX,
  IOT_COMPARE_OPS, IOT_EVENT_BATCH_MAX, IOT_EVENT_LEVELS, IOT_PROPERTY_TYPES,
  IOT_TELEMETRY_BATCH_MAX, IOT_VALIDATION_MODES,
} from './constants';

/** 物模型标识符：字母开头，字母/数字/下划线 */
const identifierSchema = z.string().min(1, '标识符不能为空').max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '标识符需以字母开头，仅支持字母、数字、下划线');

// ─── 产品 ─────────────────────────────────────────────────────────────────────
export const createIotProductSchema = z.object({
  name: z.string().min(1, '产品名称不能为空').max(128),
  description: z.string().max(2000).nullable().optional(),
  validationMode: z.enum(IOT_VALIDATION_MODES).default('loose'),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateIotProductSchema = createIotProductSchema.partial();

// ─── 物模型：参数定义（服务/事件内嵌复用）────────────────────────────────────
export const iotParamDefSchema = z.object({
  identifier: identifierSchema,
  name: z.string().min(1, '参数名称不能为空').max(64),
  dataType: z.enum(IOT_PROPERTY_TYPES),
  required: z.boolean().optional(),
  unit: z.string().max(16).nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  enumOptions: z.record(z.string().min(1).max(64), z.string().min(1).max(64)).nullable().optional(),
});

// ─── 物模型：属性 ─────────────────────────────────────────────────────────────
export const createIotPropertySchema = z.object({
  identifier: identifierSchema,
  name: z.string().min(1, '属性名称不能为空').max(64),
  dataType: z.enum(IOT_PROPERTY_TYPES),
  accessMode: z.enum(IOT_ACCESS_MODES).default('r'),
  unit: z.string().max(16).nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  enumOptions: z.record(z.string().min(1).max(64), z.string().min(1).max(64)).nullable().optional(),
  featured: z.boolean().default(false),
  sort: z.number().int().min(0).max(9999).default(0),
  description: z.string().max(256).nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.dataType === 'enum' && (!val.enumOptions || Object.keys(val.enumOptions).length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['enumOptions'], message: '枚举类型必须提供取值映射' });
  }
  if (val.minValue != null && val.maxValue != null && val.minValue > val.maxValue) {
    ctx.addIssue({ code: 'custom', path: ['maxValue'], message: '量程上限不能小于下限' });
  }
});

/** 标识符一经声明不可变更（遥测/影子键随之漂移） */
export const updateIotPropertySchema = z.object({
  name: z.string().min(1).max(64).optional(),
  dataType: z.enum(IOT_PROPERTY_TYPES).optional(),
  accessMode: z.enum(IOT_ACCESS_MODES).optional(),
  unit: z.string().max(16).nullable().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  enumOptions: z.record(z.string().min(1).max(64), z.string().min(1).max(64)).nullable().optional(),
  featured: z.boolean().optional(),
  sort: z.number().int().min(0).max(9999).optional(),
  description: z.string().max(256).nullable().optional(),
});

// ─── 物模型：服务 ─────────────────────────────────────────────────────────────
export const createIotServiceSchema = z.object({
  identifier: identifierSchema,
  name: z.string().min(1, '服务名称不能为空').max(64),
  params: z.array(iotParamDefSchema).max(20).default([]),
  danger: z.boolean().default(false),
  sort: z.number().int().min(0).max(9999).default(0),
  description: z.string().max(256).nullable().optional(),
});

export const updateIotServiceSchema = createIotServiceSchema.omit({ identifier: true }).partial();

// ─── 物模型：事件 ─────────────────────────────────────────────────────────────
export const createIotEventSchema = z.object({
  identifier: identifierSchema,
  name: z.string().min(1, '事件名称不能为空').max(64),
  level: z.enum(IOT_EVENT_LEVELS).default('info'),
  params: z.array(iotParamDefSchema).max(20).default([]),
  sort: z.number().int().min(0).max(9999).default(0),
  description: z.string().max(256).nullable().optional(),
});

export const updateIotEventSchema = createIotEventSchema.omit({ identifier: true }).partial();

// ─── 物模型：TSL 导入（全量替换）────────────────────────────────────────────
export const importIotTslSchema = z.object({
  properties: z.array(createIotPropertySchema).max(100).default([]),
  services: z.array(createIotServiceSchema).max(100).default([]),
  events: z.array(createIotEventSchema).max(100).default([]),
});

// ─── 设备 ─────────────────────────────────────────────────────────────────────
export const createIotDeviceSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1, '设备名称不能为空').max(128),
  /** 留空自动生成；仅字母数字与连字符 */
  sn: z.string().min(4).max(64).regex(/^[0-9A-Za-z-]+$/, 'SN 仅支持字母、数字、连字符').optional(),
  firmwareVersion: z.string().max(32).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).nullable().optional(),
  groupIds: z.array(z.number().int().positive()).max(50).optional(),
});

/** SN 一经接入不可变更 */
export const updateIotDeviceSchema = createIotDeviceSchema.omit({ sn: true }).partial();

// ─── 指令与期望属性 ───────────────────────────────────────────────────────────
export const sendIotCommandSchema = z.object({
  service: identifierSchema,
  params: z.record(z.string(), z.unknown()).nullable().optional(),
  /** 超时秒数，默认 300 */
  ttlSeconds: z.number().int().min(10).max(86400).optional(),
});

const metricValueSchema = z.union([z.number(), z.string().max(256), z.boolean()]);

/** 设置期望属性（仅 rw 属性，服务端按物模型校验） */
export const setIotDesiredSchema = z.object({
  desired: z.record(z.string().min(1).max(64), metricValueSchema)
    .refine((v) => Object.keys(v).length > 0, '至少设置一个期望属性'),
});

// ─── 批量操作 ─────────────────────────────────────────────────────────────────
export const iotBatchCommandSchema = z.object({
  /** 与 groupId 至少提供其一；同时提供时取并集 */
  deviceIds: z.array(z.number().int().positive()).max(IOT_BATCH_DEVICE_MAX).optional(),
  groupId: z.number().int().positive().optional(),
  service: identifierSchema,
  params: z.record(z.string(), z.unknown()).nullable().optional(),
  ttlSeconds: z.number().int().min(10).max(86400).optional(),
}).refine((v) => (v.deviceIds?.length ?? 0) > 0 || v.groupId !== undefined, {
  message: '请选择目标设备或设备分组',
  path: ['deviceIds'],
});

export const iotBatchDesiredSchema = z.object({
  deviceIds: z.array(z.number().int().positive()).max(IOT_BATCH_DEVICE_MAX).optional(),
  groupId: z.number().int().positive().optional(),
  desired: z.record(z.string().min(1).max(64), metricValueSchema)
    .refine((v) => Object.keys(v).length > 0, '至少设置一个期望属性'),
}).refine((v) => (v.deviceIds?.length ?? 0) > 0 || v.groupId !== undefined, {
  message: '请选择目标设备或设备分组',
  path: ['deviceIds'],
});

// ─── 告警规则 ─────────────────────────────────────────────────────────────────
export const createIotAlarmRuleSchema = z.object({
  name: z.string().min(1, '规则名称不能为空').max(128),
  productId: z.number().int().positive(),
  deviceId: z.number().int().positive().nullable().optional(),
  ruleType: z.enum(IOT_ALARM_RULE_TYPES),
  propertyIdentifier: identifierSchema.nullable().optional(),
  operator: z.enum(IOT_COMPARE_OPS).nullable().optional(),
  threshold: z.number().nullable().optional(),
  consecutiveCount: z.number().int().min(1).max(60).default(1),
  offlineMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  eventIdentifier: identifierSchema.nullable().optional(),
  level: z.enum(IOT_ALARM_LEVELS).default('warning'),
  notifyUserIds: z.array(z.number().int().positive()).max(50).default([]),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
}).superRefine((val, ctx) => {
  if (val.ruleType === 'threshold') {
    if (!val.propertyIdentifier) ctx.addIssue({ code: 'custom', path: ['propertyIdentifier'], message: '阈值规则必须指定监控属性' });
    if (!val.operator) ctx.addIssue({ code: 'custom', path: ['operator'], message: '阈值规则必须指定比较符' });
    if (val.threshold == null) ctx.addIssue({ code: 'custom', path: ['threshold'], message: '阈值规则必须指定阈值' });
  }
  if (val.ruleType === 'offline' && val.offlineMinutes == null) {
    ctx.addIssue({ code: 'custom', path: ['offlineMinutes'], message: '离线规则必须指定离线时长（分钟）' });
  }
  if (val.ruleType === 'event' && !val.eventIdentifier) {
    ctx.addIssue({ code: 'custom', path: ['eventIdentifier'], message: '事件规则必须指定触发事件' });
  }
});

export const updateIotAlarmRuleSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  deviceId: z.number().int().positive().nullable().optional(),
  propertyIdentifier: identifierSchema.nullable().optional(),
  operator: z.enum(IOT_COMPARE_OPS).nullable().optional(),
  threshold: z.number().nullable().optional(),
  consecutiveCount: z.number().int().min(1).max(60).optional(),
  offlineMinutes: z.number().int().min(1).max(10080).nullable().optional(),
  eventIdentifier: identifierSchema.nullable().optional(),
  level: z.enum(IOT_ALARM_LEVELS).optional(),
  notifyUserIds: z.array(z.number().int().positive()).max(50).optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

// ─── 设备分组 ─────────────────────────────────────────────────────────────────
export const createIotDeviceGroupSchema = z.object({
  name: z.string().min(1, '分组名称不能为空').max(64),
  description: z.string().max(256).nullable().optional(),
  deviceIds: z.array(z.number().int().positive()).max(IOT_BATCH_DEVICE_MAX).default([]),
});

export const updateIotDeviceGroupSchema = createIotDeviceGroupSchema.partial();

// ─── 设备侧（ingest / WS 帧载荷）──────────────────────────────────────────────
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

export const iotEventItemSchema = z.object({
  identifier: identifierSchema,
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  reportedAt: z.string().max(32).optional(),
});

export const iotEventIngestSchema = z.object({
  items: z.array(iotEventItemSchema).min(1).max(IOT_EVENT_BATCH_MAX),
});

export const iotCommandAckSchema = z.object({
  success: z.boolean(),
  response: z.record(z.string(), z.unknown()).nullable().optional(),
  errorMsg: z.string().max(256).optional(),
});

// ─── 类型导出 ─────────────────────────────────────────────────────────────────
export type CreateIotProductInput = z.infer<typeof createIotProductSchema>;

export type UpdateIotProductInput = z.infer<typeof updateIotProductSchema>;

export type CreateIotPropertyInput = z.infer<typeof createIotPropertySchema>;

export type UpdateIotPropertyInput = z.infer<typeof updateIotPropertySchema>;

export type CreateIotServiceInput = z.infer<typeof createIotServiceSchema>;

export type UpdateIotServiceInput = z.infer<typeof updateIotServiceSchema>;

export type CreateIotEventInput = z.infer<typeof createIotEventSchema>;

export type UpdateIotEventInput = z.infer<typeof updateIotEventSchema>;

export type ImportIotTslInput = z.infer<typeof importIotTslSchema>;

export type CreateIotDeviceInput = z.infer<typeof createIotDeviceSchema>;

export type UpdateIotDeviceInput = z.infer<typeof updateIotDeviceSchema>;

export type SendIotCommandInput = z.infer<typeof sendIotCommandSchema>;

export type SetIotDesiredInput = z.infer<typeof setIotDesiredSchema>;

export type IotBatchCommandInput = z.infer<typeof iotBatchCommandSchema>;

export type IotBatchDesiredInput = z.infer<typeof iotBatchDesiredSchema>;

export type CreateIotAlarmRuleInput = z.infer<typeof createIotAlarmRuleSchema>;

export type UpdateIotAlarmRuleInput = z.infer<typeof updateIotAlarmRuleSchema>;

export type CreateIotDeviceGroupInput = z.infer<typeof createIotDeviceGroupSchema>;

export type UpdateIotDeviceGroupInput = z.infer<typeof updateIotDeviceGroupSchema>;

export type IotTelemetryIngestInput = z.infer<typeof iotTelemetryIngestSchema>;

export type IotEventIngestInput = z.infer<typeof iotEventIngestSchema>;

export type IotCommandAckInput = z.infer<typeof iotCommandAckSchema>;
