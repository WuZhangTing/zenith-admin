import type {
  IotAccessMode, IotAlarmLevel, IotAlarmRuleType, IotAlarmStatus, IotCommandStatus,
  IotDeviceEventKind, IotEventLevel, IotPropertyType, IotValidationMode,
} from './constants';

export type IotMetricValue = number | string | boolean;

// ─── 产品与物模型 ─────────────────────────────────────────────────────────────
export interface IotProduct {
  id: number;
  name: string;
  description: string | null;
  validationMode: IotValidationMode;
  status: 'enabled' | 'disabled';
  /** 关联设备数（列表聚合返回） */
  deviceCount?: number;
  /** 物模型三元组规模（列表聚合返回） */
  propertyCount?: number;
  serviceCount?: number;
  eventCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 服务/事件的参数定义（jsonb 内嵌） */
export interface IotParamDef {
  identifier: string;
  name: string;
  dataType: IotPropertyType;
  required?: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  /** enum 类型的取值映射：{ 值: 显示名 } */
  enumOptions?: Record<string, string> | null;
}

export interface IotProductProperty {
  id: number;
  productId: number;
  identifier: string;
  name: string;
  dataType: IotPropertyType;
  accessMode: IotAccessMode;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  enumOptions: Record<string, string> | null;
  featured: boolean;
  sort: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotProductService {
  id: number;
  productId: number;
  identifier: string;
  name: string;
  params: IotParamDef[];
  danger: boolean;
  sort: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotProductEvent {
  id: number;
  productId: number;
  identifier: string;
  name: string;
  level: IotEventLevel;
  params: IotParamDef[];
  sort: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 物模型完整视图（TSL 导入导出与设备详情共用） */
export interface IotThingModel {
  properties: IotProductProperty[];
  services: IotProductService[];
  events: IotProductEvent[];
}

// ─── 设备 ─────────────────────────────────────────────────────────────────────
export interface IotDevice {
  id: number;
  sn: string;
  /** 接入密钥（管理端可见，用于设备侧签名） */
  secret: string;
  productId: number;
  productName?: string | null;
  name: string;
  status: 'enabled' | 'disabled';
  /** 实时在线态（Redis TTL 键，运行态字段） */
  online: boolean;
  firmwareVersion: string | null;
  activatedAt: string | null;
  lastSeenAt: string | null;
  /** 影子 reported 快照（列表/详情展示，O(1) 读） */
  reported?: Record<string, IotMetricValue> | null;
  /** 影子 desired 待确认增量 */
  desired?: Record<string, IotMetricValue> | null;
  /** 所属分组（列表聚合返回） */
  groupIds?: number[];
  groupNames?: string[];
  remark: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 设备影子 */
export interface IotDeviceShadow {
  deviceId: number;
  reported: Record<string, IotMetricValue>;
  reportedAt: string | null;
  desired: Record<string, IotMetricValue>;
  desiredVersion: number;
  desiredAt: string | null;
  online: boolean;
  updatedAt: string;
}

export interface IotDeviceEvent {
  id: number;
  deviceId: number;
  kind: IotDeviceEventKind;
  identifier: string;
  name: string;
  level: IotEventLevel;
  payload: Record<string, unknown> | null;
  reportedAt: string;
}

export interface IotTelemetryPoint {
  id: number;
  metrics: Record<string, IotMetricValue>;
  /** YYYY-MM-DD HH:mm:ss */
  reportedAt: string;
}

// ─── 指令 ─────────────────────────────────────────────────────────────────────
export interface IotCommand {
  id: number;
  deviceId: number;
  service: string;
  params: Record<string, unknown> | null;
  status: IotCommandStatus;
  expireAt: string;
  sentAt: string | null;
  ackedAt: string | null;
  response: Record<string, unknown> | null;
  errorMsg: string | null;
  createdBy?: number | null;
  createdAt: string;
}

/** 设备侧指令载荷（WS command:exec 帧 / HTTP 拉取响应） */
export interface IotCommandPayload {
  commandId: number;
  service: string;
  params: Record<string, unknown> | null;
  expireAt: string;
}

/** 设备侧期望属性载荷（WS shadow:desired 帧 / 心跳响应捎带） */
export interface IotDesiredPayload {
  version: number;
  desired: Record<string, IotMetricValue>;
}

// ─── 告警 ─────────────────────────────────────────────────────────────────────
export interface IotAlarmRule {
  id: number;
  name: string;
  productId: number;
  productName?: string | null;
  deviceId: number | null;
  deviceName?: string | null;
  ruleType: IotAlarmRuleType;
  propertyIdentifier: string | null;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | null;
  threshold: number | null;
  consecutiveCount: number;
  offlineMinutes: number | null;
  eventIdentifier: string | null;
  level: IotAlarmLevel;
  notifyUserIds: number[];
  status: 'enabled' | 'disabled';
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotAlarm {
  id: number;
  ruleId: number | null;
  ruleName: string;
  deviceId: number;
  deviceName?: string | null;
  deviceSn?: string | null;
  ruleType: IotAlarmRuleType;
  level: IotAlarmLevel;
  status: IotAlarmStatus;
  message: string;
  context: Record<string, unknown> | null;
  firedAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  createdAt: string;
}

// ─── 设备分组 ─────────────────────────────────────────────────────────────────
export interface IotDeviceGroup {
  id: number;
  name: string;
  description: string | null;
  /** 组内设备数（列表聚合返回） */
  deviceCount?: number;
  /** 组内设备 id（详情返回） */
  deviceIds?: number[];
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}
