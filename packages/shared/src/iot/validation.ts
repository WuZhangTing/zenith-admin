import { z } from 'zod';
import {
  IOT_ACCESS_MODES, IOT_ALARM_LEVELS, IOT_ALARM_RULE_TYPES, IOT_AUTOMATION_ACTION_MAX,
  IOT_AUTOMATION_ACTION_TYPES, IOT_AUTOMATION_DEFAULT_COOLDOWN_SECONDS, IOT_AUTOMATION_TARGETS,
  IOT_AUTOMATION_TRIGGERS, IOT_BATCH_DEVICE_MAX,
  IOT_COMPARE_OPS, IOT_EVENT_BATCH_MAX, IOT_EVENT_LEVELS, IOT_FIRMWARE_VERSION_PATTERN,
  IOT_FORWARD_SOURCES, IOT_GATEWAY_BATCH_MAX, IOT_LOG_BATCH_MAX, IOT_LOG_LEVELS, IOT_NODE_TYPES,
  IOT_OTA_DEFAULT_TIMEOUT_MINUTES, IOT_OTA_PROGRESS_STATUSES, IOT_PROPERTY_TYPES,
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
  /** 遥测异常检测（仅数值型属性生效） */
  anomalyEnabled: z.boolean().default(false),
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
  anomalyEnabled: z.boolean().optional(),
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
const iotDeviceBaseSchema = z.object({
  productId: z.number().int().positive(),
  name: z.string().min(1, '设备名称不能为空').max(128),
  /** 留空自动生成；仅字母数字与连字符 */
  sn: z.string().min(4).max(64).regex(/^[0-9A-Za-z-]+$/, 'SN 仅支持字母、数字、连字符').optional(),
  /** 设备形态：sub 必须指定 gatewayId */
  nodeType: z.enum(IOT_NODE_TYPES).default('direct'),
  gatewayId: z.number().int().positive().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  address: z.string().max(256).nullable().optional(),
  firmwareVersion: z.string().max(32).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).nullable().optional(),
  groupIds: z.array(z.number().int().positive()).max(50).optional(),
});

/** 形态/位置一致性（拓扑归属的存在性与防环由服务端校验） */
function refineIotDevice(v: { nodeType?: string; gatewayId?: number | null; latitude?: number | null; longitude?: number | null }, ctx: z.RefinementCtx) {
  if (v.nodeType === 'sub' && !v.gatewayId) {
    ctx.addIssue({ code: 'custom', path: ['gatewayId'], message: '子设备必须指定所属网关' });
  }
  if (v.nodeType && v.nodeType !== 'sub' && v.gatewayId) {
    ctx.addIssue({ code: 'custom', path: ['gatewayId'], message: '仅子设备可指定所属网关' });
  }
  if ((v.latitude == null) !== (v.longitude == null)) {
    ctx.addIssue({ code: 'custom', path: ['longitude'], message: '经纬度需成对填写' });
  }
}

export const createIotDeviceSchema = iotDeviceBaseSchema.superRefine(refineIotDevice);

/** SN 一经接入不可变更 */
export const updateIotDeviceSchema = iotDeviceBaseSchema.omit({ sn: true }).partial().superRefine(refineIotDevice);

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

// ─── 三期：固件与 OTA ─────────────────────────────────────────────────────────
export const createIotFirmwareSchema = z.object({
  productId: z.number().int().positive(),
  version: z.string().min(1, '版本号不能为空').max(32)
    .regex(IOT_FIRMWARE_VERSION_PATTERN, '版本号需为语义化格式，如 1.2.3 或 1.2.3-beta.1'),
  fileId: z.string().min(1, '请上传固件文件'),
  fileName: z.string().min(1).max(255),
  size: z.number().int().min(0),
  sha256: z.string().length(64, 'SHA256 需为 64 位十六进制').regex(/^[0-9a-f]+$/i, 'SHA256 需为十六进制'),
  releaseNotes: z.string().max(4000).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

/** 版本与文件一经创建不可变更（设备按版本判定升级结果） */
export const updateIotFirmwareSchema = z.object({
  releaseNotes: z.string().max(4000).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

export const createIotOtaTaskSchema = z.object({
  firmwareId: z.number().int().positive(),
  /** 三选一：显式设备 / 分组 / 产品下全部启用设备 */
  deviceIds: z.array(z.number().int().positive()).max(IOT_BATCH_DEVICE_MAX).optional(),
  groupId: z.number().int().positive().optional(),
  allDevices: z.boolean().optional(),
  timeoutMinutes: z.number().int().min(5).max(1440).default(IOT_OTA_DEFAULT_TIMEOUT_MINUTES),
}).refine((v) => (v.deviceIds?.length ?? 0) > 0 || v.groupId !== undefined || v.allDevices === true, {
  message: '请选择目标设备、分组或全部设备',
  path: ['deviceIds'],
});

/** 设备侧 OTA 进度回报（ingest / WS 帧共用） */
export const iotOtaProgressSchema = z.object({
  taskId: z.number().int().positive(),
  status: z.enum(IOT_OTA_PROGRESS_STATUSES),
  progress: z.number().int().min(0).max(100).optional(),
  errorMsg: z.string().max(256).optional(),
});

export type CreateIotFirmwareInput = z.infer<typeof createIotFirmwareSchema>;

export type UpdateIotFirmwareInput = z.infer<typeof updateIotFirmwareSchema>;

export type CreateIotOtaTaskInput = z.infer<typeof createIotOtaTaskSchema>;

export type IotOtaProgressInput = z.infer<typeof iotOtaProgressSchema>;

// ─── 四期：场景联动 ───────────────────────────────────────────────────────────
const automationActionSchema = z.object({
  type: z.enum(IOT_AUTOMATION_ACTION_TYPES),
  target: z.enum(IOT_AUTOMATION_TARGETS).optional(),
  targetDeviceId: z.number().int().positive().nullable().optional(),
  targetGroupId: z.number().int().positive().nullable().optional(),
  service: identifierSchema.nullable().optional(),
  params: z.record(z.string(), z.unknown()).nullable().optional(),
  desired: z.record(z.string().min(1).max(64), metricValueSchema).nullable().optional(),
  userIds: z.array(z.number().int().positive()).max(50).nullable().optional(),
  workflowDefinitionId: z.number().int().positive().nullable().optional(),
  formData: z.record(z.string(), z.unknown()).nullable().optional(),
}).superRefine((a, ctx) => {
  if ((a.type === 'command' || a.type === 'desired') && (a.target === 'device') && !a.targetDeviceId) {
    ctx.addIssue({ code: 'custom', path: ['targetDeviceId'], message: '指定设备目标必须选择设备' });
  }
  if ((a.type === 'command' || a.type === 'desired') && (a.target === 'group') && !a.targetGroupId) {
    ctx.addIssue({ code: 'custom', path: ['targetGroupId'], message: '指定分组目标必须选择分组' });
  }
  if (a.type === 'command' && !a.service) {
    ctx.addIssue({ code: 'custom', path: ['service'], message: '指令动作必须指定服务' });
  }
  if (a.type === 'desired' && (!a.desired || Object.keys(a.desired).length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['desired'], message: '期望属性动作至少设置一个属性' });
  }
  if (a.type === 'notify' && (!a.userIds || a.userIds.length === 0)) {
    ctx.addIssue({ code: 'custom', path: ['userIds'], message: '通知动作至少选择一个接收人' });
  }
  if (a.type === 'workflow' && !a.workflowDefinitionId) {
    ctx.addIssue({ code: 'custom', path: ['workflowDefinitionId'], message: '工作流动作必须指定流程定义' });
  }
});

export const createIotAutomationSchema = z.object({
  name: z.string().min(1, '联动名称不能为空').max(128),
  productId: z.number().int().positive(),
  deviceId: z.number().int().positive().nullable().optional(),
  triggerType: z.enum(IOT_AUTOMATION_TRIGGERS),
  propertyIdentifier: identifierSchema.nullable().optional(),
  operator: z.enum(IOT_COMPARE_OPS).nullable().optional(),
  threshold: z.number().nullable().optional(),
  eventIdentifier: identifierSchema.nullable().optional(),
  decisionRuleKey: z.string().max(64).nullable().optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).default(IOT_AUTOMATION_DEFAULT_COOLDOWN_SECONDS),
  actions: z.array(automationActionSchema).min(1, '至少配置一个动作').max(IOT_AUTOMATION_ACTION_MAX),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
}).superRefine((val, ctx) => {
  if (val.triggerType === 'property') {
    if (!val.propertyIdentifier) ctx.addIssue({ code: 'custom', path: ['propertyIdentifier'], message: '属性触发必须指定属性' });
    if (!val.operator) ctx.addIssue({ code: 'custom', path: ['operator'], message: '属性触发必须指定比较符' });
    if (val.threshold == null) ctx.addIssue({ code: 'custom', path: ['threshold'], message: '属性触发必须指定阈值' });
  }
  if (val.triggerType === 'event' && !val.eventIdentifier) {
    ctx.addIssue({ code: 'custom', path: ['eventIdentifier'], message: '事件触发必须指定物模型事件' });
  }
});

/** 触发类型与所属产品创建后不可变更 */
export const updateIotAutomationSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  deviceId: z.number().int().positive().nullable().optional(),
  propertyIdentifier: identifierSchema.nullable().optional(),
  operator: z.enum(IOT_COMPARE_OPS).nullable().optional(),
  threshold: z.number().nullable().optional(),
  eventIdentifier: identifierSchema.nullable().optional(),
  decisionRuleKey: z.string().max(64).nullable().optional(),
  cooldownSeconds: z.number().int().min(0).max(86400).optional(),
  actions: z.array(automationActionSchema).min(1).max(IOT_AUTOMATION_ACTION_MAX).optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

export type CreateIotAutomationInput = z.infer<typeof createIotAutomationSchema>;

export type UpdateIotAutomationInput = z.infer<typeof updateIotAutomationSchema>;

// ─── 五期：网关代理接入 ───────────────────────────────────────────────────────
/** 网关批量代理子设备遥测（网关身份鉴权，子设备免密） */
export const iotGatewayBatchSchema = z.object({
  items: z.array(z.object({
    subSn: z.string().min(4).max(64),
    metrics: z.record(z.string().min(1).max(64), z.union([z.number(), z.string().max(256), z.boolean()])),
    reportedAt: z.string().max(32).optional(),
  })).min(1).max(IOT_GATEWAY_BATCH_MAX),
});

export type IotGatewayBatchInput = z.infer<typeof iotGatewayBatchSchema>;

/** 网关代理子设备事件 */
export const iotGatewayEventSchema = z.object({
  subSn: z.string().min(4).max(64),
  identifier: identifierSchema,
  payload: z.record(z.string(), z.unknown()).nullable().optional(),
  reportedAt: z.string().max(32).optional(),
});

export type IotGatewayEventInput = z.infer<typeof iotGatewayEventSchema>;

// ─── 五期：设备日志上报 ───────────────────────────────────────────────────────
export const iotLogIngestSchema = z.object({
  items: z.array(z.object({
    level: z.enum(IOT_LOG_LEVELS).default('info'),
    tag: z.string().max(64).optional(),
    content: z.string().min(1).max(1024),
    reportedAt: z.string().max(32).optional(),
  })).min(1).max(IOT_LOG_BATCH_MAX),
});

export type IotLogIngestInput = z.infer<typeof iotLogIngestSchema>;

// ─── 五期：数据流转规则 ───────────────────────────────────────────────────────
export const createIotForwardRuleSchema = z.object({
  name: z.string().min(1, '规则名称不能为空').max(128),
  source: z.enum(IOT_FORWARD_SOURCES),
  productId: z.number().int().positive().nullable().optional(),
  groupId: z.number().int().positive().nullable().optional(),
  url: z.string().url('目的地需为合法 URL').max(512),
  /** 置空 = 不签名；创建/更新时明文提交，列表不回显 */
  secret: z.string().min(8, '签名密钥至少 8 位').max(128).nullable().optional(),
  headers: z.record(z.string().min(1).max(64), z.string().max(256)).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export type CreateIotForwardRuleInput = z.infer<typeof createIotForwardRuleSchema>;

/** source 创建后不可变更 */
export const updateIotForwardRuleSchema = createIotForwardRuleSchema.omit({ source: true }).partial();

export type UpdateIotForwardRuleInput = z.infer<typeof updateIotForwardRuleSchema>;
