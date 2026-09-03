import type {
  IotAccessMode, IotAlarmLevel, IotAlarmRuleType, IotAlarmStatus, IotAutomationActionType,
  IotAutomationTarget, IotAutomationTrigger, IotCommandStatus, IotDeviceEventKind, IotEventLevel,
  IotForwardSource, IotLogLevel, IotNodeType,
  IotOtaDeviceStatus, IotOtaTaskStatus, IotPropertyType, IotScheduleAction, IotScheduleType, IotValidationMode,
} from './constants';

export type IotMetricValue = number | string | boolean;

// ─── 产品与物模型 ─────────────────────────────────────────────────────────────
export interface IotProduct {
  id: number;
  name: string;
  description: string | null;
  validationMode: IotValidationMode;
  status: 'enabled' | 'disabled';
  /** 是否已开启动态注册（密钥明文不下发） */
  registrationEnabled?: boolean;
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
  /** 遥测异常检测开关（数值型属性；3σ 基线判定） */
  anomalyEnabled: boolean;
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
  /** 设备形态：direct 直连 / gateway 网关 / sub 子设备 */
  nodeType: IotNodeType;
  /** 子设备所属网关（仅 nodeType = sub） */
  gatewayId: number | null;
  gatewayName?: string | null;
  /** 网关的子设备数（列表聚合返回） */
  subDeviceCount?: number;
  /** 地理位置（设备地图） */
  latitude: number | null;
  longitude: number | null;
  address: string | null;
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
  /** 升级策略：触发后 N 分钟未认领/未恢复 → 升级通知（null = 不升级） */
  escalateAfterMinutes: number | null;
  escalateUserIds: number[];
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
  acknowledgedAt: string | null;
  acknowledgedBy: number | null;
  acknowledgedByName?: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolveNote: string | null;
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

// ─── 遥测聚合（长窗口图表） ───────────────────────────────────────────────────
export interface IotTelemetryAggPoint {
  /** 小时桶起点 YYYY-MM-DD HH:mm:ss */
  bucket: string;
  minValue: number;
  maxValue: number;
  avgValue: number;
  count: number;
}

// ─── 固件与 OTA ───────────────────────────────────────────────────────────────
export interface IotFirmware {
  id: number;
  productId: number;
  productName?: string | null;
  version: string;
  fileId: string | null;
  fileName: string;
  size: number;
  sha256: string;
  releaseNotes: string | null;
  status: 'enabled' | 'disabled';
  /** 升级任务数（列表聚合返回） */
  taskCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotOtaTask {
  id: number;
  title: string;
  firmwareId: number;
  productId: number;
  productName?: string | null;
  firmwareVersion: string;
  status: IotOtaTaskStatus;
  timeoutMinutes: number;
  /** 灰度批次大小（null = 全量一批） */
  batchSize: number | null;
  /** 当前已放量到的批次号 */
  currentBatch: number;
  /** 总批次数（列表聚合返回） */
  totalBatches?: number;
  /** 失败率熔断阈值（百分比；null = 不熔断） */
  failureThreshold: number | null;
  totalCount: number;
  succeededCount: number;
  failedCount: number;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotOtaTaskDevice {
  id: number;
  taskId: number;
  deviceId: number;
  deviceName?: string | null;
  deviceSn?: string | null;
  online?: boolean;
  status: IotOtaDeviceStatus;
  progress: number;
  fromVersion: string | null;
  /** 灰度批次号 */
  batchIndex: number;
  errorMsg: string | null;
  notifiedAt: string | null;
  finishedAt: string | null;
}

/** 设备侧 OTA 升级载荷（WS ota:upgrade 帧 / 心跳响应捎带） */
export interface IotOtaPayload {
  taskId: number;
  version: string;
  fileName: string;
  size: number;
  sha256: string;
  /** 设备侧带签名参数请求该地址下载固件 */
  downloadPath: string;
}

// ─── 总览仪表盘 ───────────────────────────────────────────────────────────────
export interface IotDashboardStats {
  deviceTotal: number;
  onlineCount: number;
  /** 0-100 */
  onlineRate: number;
  telemetryToday: number;
  firingWarning: number;
  firingCritical: number;
  /** 存在待确认期望值的设备数 */
  pendingDesiredDevices: number;
  productTotal: number;
}

export interface IotOnlineTrendPoint {
  /** YYYY-MM-DD HH:mm:ss */
  time: string;
  total: number;
  online: number;
}

export interface IotAlarmTrendPoint {
  /** YYYY-MM-DD */
  date: string;
  warning: number;
  critical: number;
}

export interface IotProductDistributionItem {
  name: string;
  value: number;
}

export interface IotDashboard {
  stats: IotDashboardStats;
  onlineTrend: IotOnlineTrendPoint[];
  alarmTrend: IotAlarmTrendPoint[];
  productDistribution: IotProductDistributionItem[];
  recentAlarms: IotAlarm[];
  recentEvents: Array<IotDeviceEvent & { deviceName?: string | null }>;
}

// ─── 场景联动 ─────────────────────────────────────────────────────────────────
export interface IotAutomationAction {
  type: IotAutomationActionType;
  target?: IotAutomationTarget;
  targetDeviceId?: number | null;
  targetGroupId?: number | null;
  service?: string | null;
  params?: Record<string, unknown> | null;
  desired?: Record<string, IotMetricValue> | null;
  userIds?: number[] | null;
  workflowDefinitionId?: number | null;
  formData?: Record<string, unknown> | null;
}

export interface IotAutomation {
  id: number;
  name: string;
  productId: number;
  productName?: string | null;
  deviceId: number | null;
  deviceName?: string | null;
  triggerType: IotAutomationTrigger;
  propertyIdentifier: string | null;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | null;
  threshold: number | null;
  eventIdentifier: string | null;
  decisionRuleKey: string | null;
  cooldownSeconds: number;
  actions: IotAutomationAction[];
  status: 'enabled' | 'disabled';
  /** 近 24h 执行次数（列表聚合返回） */
  recentRunCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotAutomationRun {
  id: number;
  automationId: number;
  automationName: string;
  deviceId: number;
  deviceName?: string | null;
  deviceSn?: string | null;
  triggerContext: Record<string, unknown>;
  results: Array<{ type: string; target?: string; success: boolean; message?: string }>;
  success: boolean;
  createdAt: string;
}

// ─── 五期：网关拓扑 ───────────────────────────────────────────────────────────
export interface IotTopologyChild {
  id: number;
  sn: string;
  name: string;
  status: 'enabled' | 'disabled';
  online: boolean;
  /** 活跃告警数（拓扑节点红点） */
  firingAlarmCount: number;
  lastSeenAt: string | null;
}

export interface IotDeviceTopology {
  gateway: { id: number; sn: string; name: string; online: boolean };
  children: IotTopologyChild[];
}

// ─── 五期：数据流转 ───────────────────────────────────────────────────────────
export interface IotForwardRule {
  id: number;
  name: string;
  source: IotForwardSource;
  productId: number | null;
  productName?: string | null;
  groupId: number | null;
  groupName?: string | null;
  url: string;
  /** 是否配置了签名密钥（密钥本体不回显） */
  hasSecret: boolean;
  headers: Record<string, string> | null;
  status: 'enabled' | 'disabled';
  consecutiveFailures: number;
  autoDisabledAt: string | null;
  /** 近 24h 投递数（列表聚合返回） */
  recentDeliveryCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotForwardLog {
  id: number;
  ruleId: number;
  ruleName: string;
  source: IotForwardSource;
  deviceId: number | null;
  payload: Record<string, unknown>;
  status: 'succeeded' | 'failed';
  responseStatus: number | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

// ─── 五期：设备日志 ───────────────────────────────────────────────────────────
export interface IotDeviceLog {
  id: number;
  deviceId: number;
  level: IotLogLevel;
  tag: string | null;
  content: string;
  reportedAt: string;
}

// ─── 六期：维护窗口 ───────────────────────────────────────────────────────────
export interface IotMaintenanceWindow {
  id: number;
  name: string;
  productId: number | null;
  productName?: string | null;
  groupId: number | null;
  groupName?: string | null;
  deviceId: number | null;
  deviceName?: string | null;
  startAt: string;
  endAt: string;
  reason: string | null;
  /** 当前是否生效中（列表计算返回） */
  active?: boolean;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 六期：设备计划任务 ───────────────────────────────────────────────────────
export interface IotSchedule {
  id: number;
  name: string;
  scheduleType: IotScheduleType;
  cronExpression: string | null;
  runAt: string | null;
  productId: number;
  productName?: string | null;
  groupId: number | null;
  groupName?: string | null;
  deviceId: number | null;
  deviceName?: string | null;
  actionType: IotScheduleAction;
  service: string | null;
  params: Record<string, unknown> | null;
  desired: Record<string, IotMetricValue> | null;
  status: 'enabled' | 'disabled';
  nextRunAt: string | null;
  lastRunAt: string | null;
  /** 近 24h 执行次数（列表聚合返回） */
  recentRunCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IotScheduleRun {
  id: number;
  scheduleId: number;
  scheduleName: string;
  deviceCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ deviceId: number; sn: string; error: string }>;
  createdAt: string;
}

// ─── 六期：动态注册白名单 ─────────────────────────────────────────────────────
export interface IotWhitelistEntry {
  id: number;
  productId: number;
  productName?: string | null;
  sn: string;
  used: boolean;
  usedAt: string | null;
  deviceId: number | null;
  deviceName?: string | null;
  remark: string | null;
  createdAt: string;
}
