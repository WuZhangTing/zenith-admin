import { createLabelOptions } from '../core/enum-options';

// ─── 指令状态 ─────────────────────────────────────────────────────────────────
export const IOT_COMMAND_STATUSES = ['pending', 'delivered', 'acked', 'failed', 'expired'] as const;

export type IotCommandStatus = (typeof IOT_COMMAND_STATUSES)[number];

export const IOT_COMMAND_STATUS_LABELS: Record<IotCommandStatus, string> = {
  pending: '待下发',
  delivered: '已送达',
  acked: '执行成功',
  failed: '执行失败',
  expired: '已超时',
};

export const IOT_COMMAND_STATUS_OPTIONS = createLabelOptions(IOT_COMMAND_STATUSES, IOT_COMMAND_STATUS_LABELS);

// ─── 物模型：属性数据类型 ─────────────────────────────────────────────────────
export const IOT_PROPERTY_TYPES = ['number', 'string', 'boolean', 'enum'] as const;

export type IotPropertyType = (typeof IOT_PROPERTY_TYPES)[number];

export const IOT_PROPERTY_TYPE_LABELS: Record<IotPropertyType, string> = {
  number: '数值',
  string: '字符串',
  boolean: '布尔',
  enum: '枚举',
};

export const IOT_PROPERTY_TYPE_OPTIONS = createLabelOptions(IOT_PROPERTY_TYPES, IOT_PROPERTY_TYPE_LABELS);

// ─── 物模型：属性读写模式 ─────────────────────────────────────────────────────
export const IOT_ACCESS_MODES = ['r', 'rw'] as const;

export type IotAccessMode = (typeof IOT_ACCESS_MODES)[number];

export const IOT_ACCESS_MODE_LABELS: Record<IotAccessMode, string> = {
  r: '只读',
  rw: '读写',
};

export const IOT_ACCESS_MODE_OPTIONS = createLabelOptions(IOT_ACCESS_MODES, IOT_ACCESS_MODE_LABELS);

// ─── 物模型：事件级别 ─────────────────────────────────────────────────────────
export const IOT_EVENT_LEVELS = ['info', 'warn', 'fault'] as const;

export type IotEventLevel = (typeof IOT_EVENT_LEVELS)[number];

export const IOT_EVENT_LEVEL_LABELS: Record<IotEventLevel, string> = {
  info: '信息',
  warn: '告警',
  fault: '故障',
};

export const IOT_EVENT_LEVEL_OPTIONS = createLabelOptions(IOT_EVENT_LEVELS, IOT_EVENT_LEVEL_LABELS);

// ─── 遥测校验模式 ─────────────────────────────────────────────────────────────
export const IOT_VALIDATION_MODES = ['loose', 'strict'] as const;

export type IotValidationMode = (typeof IOT_VALIDATION_MODES)[number];

export const IOT_VALIDATION_MODE_LABELS: Record<IotValidationMode, string> = {
  loose: '宽松（校验已声明属性，未声明键放行）',
  strict: '严格（仅接受已声明属性）',
};

export const IOT_VALIDATION_MODE_OPTIONS = createLabelOptions(IOT_VALIDATION_MODES, IOT_VALIDATION_MODE_LABELS);

// ─── 设备事件流 ───────────────────────────────────────────────────────────────
export const IOT_DEVICE_EVENT_KINDS = ['lifecycle', 'model'] as const;

export type IotDeviceEventKind = (typeof IOT_DEVICE_EVENT_KINDS)[number];

export const IOT_DEVICE_EVENT_KIND_LABELS: Record<IotDeviceEventKind, string> = {
  lifecycle: '生命周期',
  model: '设备事件',
};

export const IOT_DEVICE_EVENT_KIND_OPTIONS = createLabelOptions(IOT_DEVICE_EVENT_KINDS, IOT_DEVICE_EVENT_KIND_LABELS);

/** 生命周期事件标识符 → 展示名 */
export const IOT_LIFECYCLE_EVENTS = {
  online: '设备上线',
  offline: '设备离线',
  activated: '设备激活',
  secret_reset: '密钥重置',
} as const;

export type IotLifecycleEventId = keyof typeof IOT_LIFECYCLE_EVENTS;

// ─── 告警 ─────────────────────────────────────────────────────────────────────
export const IOT_ALARM_RULE_TYPES = ['threshold', 'offline', 'event'] as const;

export type IotAlarmRuleType = (typeof IOT_ALARM_RULE_TYPES)[number];

export const IOT_ALARM_RULE_TYPE_LABELS: Record<IotAlarmRuleType, string> = {
  threshold: '属性阈值',
  offline: '设备离线',
  event: '事件触发',
};

export const IOT_ALARM_RULE_TYPE_OPTIONS = createLabelOptions(IOT_ALARM_RULE_TYPES, IOT_ALARM_RULE_TYPE_LABELS);

export const IOT_COMPARE_OPS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'] as const;

export type IotCompareOp = (typeof IOT_COMPARE_OPS)[number];

export const IOT_COMPARE_OP_LABELS: Record<IotCompareOp, string> = {
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  eq: '=',
  neq: '≠',
};

export const IOT_COMPARE_OP_OPTIONS = createLabelOptions(IOT_COMPARE_OPS, IOT_COMPARE_OP_LABELS);

export const IOT_ALARM_LEVELS = ['warning', 'critical'] as const;

export type IotAlarmLevel = (typeof IOT_ALARM_LEVELS)[number];

export const IOT_ALARM_LEVEL_LABELS: Record<IotAlarmLevel, string> = {
  warning: '警告',
  critical: '严重',
};

export const IOT_ALARM_LEVEL_OPTIONS = createLabelOptions(IOT_ALARM_LEVELS, IOT_ALARM_LEVEL_LABELS);

export const IOT_ALARM_STATUSES = ['firing', 'resolved'] as const;

export type IotAlarmStatus = (typeof IOT_ALARM_STATUSES)[number];

export const IOT_ALARM_STATUS_LABELS: Record<IotAlarmStatus, string> = {
  firing: '告警中',
  resolved: '已恢复',
};

export const IOT_ALARM_STATUS_OPTIONS = createLabelOptions(IOT_ALARM_STATUSES, IOT_ALARM_STATUS_LABELS);

// ─── 设备接入协议 ─────────────────────────────────────────────────────────────
/** 设备上报/WS 握手签名头（HMAC-SHA256(secret, `${sn}\n${ts}\n${body}`) 的 hex） */
export const IOT_SIGN_HEADER = 'X-IoT-Sign';

export const IOT_SN_HEADER = 'X-IoT-Sn';

export const IOT_TIMESTAMP_HEADER = 'X-IoT-Timestamp';

/** 签名时间窗（秒）：超过视为重放/时钟漂移，拒绝 */
export const IOT_SIGN_MAX_SKEW_SECONDS = 300;

/** 心跳在线 TTL（秒）：Redis 键存活即在线；设备建议 30s 心跳一次 */
export const IOT_ONLINE_TTL_SECONDS = 90;

/** 指令默认超时（秒） */
export const IOT_COMMAND_DEFAULT_TTL_SECONDS = 300;

/** 单次批量遥测上报最大条数 */
export const IOT_TELEMETRY_BATCH_MAX = 100;

/** 单次批量事件上报最大条数 */
export const IOT_EVENT_BATCH_MAX = 20;

/** 批量操作（指令/期望值）单次最大目标设备数 */
export const IOT_BATCH_DEVICE_MAX = 500;

// ─── WS 帧类型（设备网关双向协议）────────────────────────────────────────────
export const IOT_WS_FRAME_TYPES = {
  /** 设备 → 服务端 */
  heartbeat: 'heartbeat',
  telemetry: 'telemetry',
  event: 'event',
  commandAck: 'command:ack',
  /** 服务端 → 设备 */
  commandExec: 'command:exec',
  heartbeatAck: 'heartbeat:ack',
  /** 服务端 → 设备：期望属性变更（设备应用后通过属性上报回执，服务端按键收敛） */
  shadowDesired: 'shadow:desired',
} as const;
