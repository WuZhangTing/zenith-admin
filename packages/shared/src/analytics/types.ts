import type { UserBehaviorEventType } from '../identity/types';

export interface PageStatItem {
  pagePath: string;
  pageTitle: string | null;
  visits: number;
  avgMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
}

export interface PageStats {
  items: PageStatItem[];
  totalVisits: number;
  avgDwellMs: number | null;
}

export interface FeatureStatItem {
  pagePath: string;
  elementKey: string;
  elementLabel: string | null;
  componentArea: string | null;
  count: number;
}

export interface FeatureStats {
  items: FeatureStatItem[];
  totalEvents: number;
}

/** 落点分箱：坐标为分箱中心的视口/容器百分比 */
export interface AnalyticsHeatmapPoint {
  x: number;
  y: number;
  value: number;
  /** 该分箱内出现次数最多的元素文案，用于回答「这一片点的是什么」 */
  topLabel: string | null;
  /** 该分箱内出现次数最多的元素 key，用于与挫败点击榜单关联 */
  topElementKey: string | null;
  /** 该分箱内出现次数最多的 UI 区域 */
  topArea: string | null;
  /** 落在该分箱的独立访客数 */
  uniqueUsers: number;
  /** 人均重复点击 = value / uniqueUsers；显著大于 1 说明少数人在反复点同一处 */
  repeatRate: number;
  /** 该分箱的主元素是否出现在挫败点击榜单中 */
  rage: boolean;
}

/** 点击热点元素（按 elementKey 聚合） */
export interface HeatmapElementItem {
  elementKey: string;
  elementLabel: string | null;
  componentArea: string | null;
  count: number;
  /** 点击过该元素的独立访客数 */
  uniqueUsers: number;
  /** 平均落点，便于把榜单条目对应回散点图位置 */
  avgX: number;
  avgY: number;
}

/** 挫败点击（rage click）热点元素 */
export interface HeatmapRageClickItem {
  elementKey: string | null;
  elementLabel: string | null;
  count: number;
  uniqueUsers: number;
  lastAt: string | null;
}

export interface HeatmapData {
  pagePath: string;
  componentArea: string;
  points: AnalyticsHeatmapPoint[];
  total: number;
  /** 产生点击的独立访客数（distinctId 去重） */
  uniqueUsers: number;
  /** 产生点击的会话数 */
  uniqueSessions: number;
  /** 人均点击次数 */
  avgClicksPerUser: number;
  /** 点击热点元素 TOP 榜 */
  topElements: HeatmapElementItem[];
  /** 该页面的挫败点击热点（不受区域筛选影响，rage click 事件不带区域） */
  rageClicks: HeatmapRageClickItem[];
}

export interface HeatmapPageListItem {
  pagePath: string;
  pageTitle: string | null;
  areas: string[];
}

// ─── 前端错误监控（Issue 模型）──────────────────────────────────────────────
export type FrontendErrorType =
  | 'js_error' | 'promise_rejection' | 'resource_error' | 'console_error'
  | 'http_error' | 'white_screen' | 'crash';

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info';

export type ErrorStatus = 'unresolved' | 'resolved' | 'ignored' | 'muted';

export type ErrorAlertCondition = 'new_error' | 'threshold' | 'spike';

/** 错误分组（Issue） */
export interface ErrorGroup {
  id: number;
  fingerprint: string;
  errorType: FrontendErrorType;
  level: ErrorLevel;
  message: string;
  status: ErrorStatus;
  assigneeId: number | null;
  assigneeName: string | null;
  release: string | null;
  note: string | null;
  count: number;
  affectedUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  /** 近 7 日每日发生次数（列表迷你趋势） */
  trend?: number[];
}

/** 单次错误事件 */
export interface ErrorEvent {
  id: number;
  groupId: number;
  fingerprint: string;
  errorType: FrontendErrorType;
  level: ErrorLevel;
  message: string;
  stack: string | null;
  sourceUrl: string | null;
  lineNo: number | null;
  colNo: number | null;
  pageUrl: string | null;
  release: string | null;
  userAgent: string | null;
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  deviceType: AnalyticsDeviceType | null;
  userId: number | null;
  username: string | null;
  sessionId: string | null;
  breadcrumbs: ErrorBreadcrumb[] | null;
  context: Record<string, unknown> | null;
  httpStatus: number | null;
  httpMethod: string | null;
  httpUrl: string | null;
  /** 事件来源平台 */
  source: AnalyticsEventSource;
  /** 应用标识 */
  appId: string;
  /** 采集环境 */
  environment: AnalyticsEnvironment;
  /** 会员身份（前台错误上报），与 userId（后台管理员）互斥 */
  memberId: number | null;
  createdAt: string;
}

export interface ErrorBreadcrumb {
  type: 'navigation' | 'click' | 'http' | 'console' | 'custom';
  message: string;
  level?: ErrorLevel;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorOverview {
  totalGroups: number;
  unresolved: number;
  totalOccurrences: number;
  affectedUsers: number;
  newToday: number;
  byType: { errorType: FrontendErrorType; groups: number; occurrences: number }[];
  byLevel: { level: ErrorLevel; groups: number; occurrences: number }[];
  trend: { date: string; occurrences: number; groups: number }[];
  topIssues: ErrorGroup[];
}

export interface SourceMapItem {
  id: number;
  release: string;
  fileName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorAlertRule {
  id: number;
  name: string;
  errorType: FrontendErrorType | null;
  level: ErrorLevel | null;
  condition: ErrorAlertCondition;
  thresholdCount: number;
  windowMinutes: number;
  channels: string[];
  webhookUrl: string | null;
  recipients: string[];
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorAlertLog {
  id: number;
  ruleId: number | null;
  ruleName: string;
  condition: ErrorAlertCondition;
  detail: string;
  channels: string[];
  source: string;
  createdAt: string;
}

// ─── 用户行为采集（埋点）──────────────────────────────────────────────────────
export type AnalyticsDeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

/** 事件来源平台：后台管理端 SPA / 会员前台 SPA / 服务端埋点 */
export type AnalyticsEventSource = 'web_admin' | 'web_member' | 'server';

/** 采集环境（与 DB varchar 列对应，取值受校验层约束，允许后续扩展） */
export type AnalyticsEnvironment = 'production' | 'staging' | 'development';

/** 身份归属类型：后台管理员 / 前台会员 / 匿名访客 */
export type AnalyticsIdentityType = 'admin' | 'member' | 'anonymous';

/** 单条上报事件（客户端 → 服务端） */
export interface TrackEventInput {
  /** 客户端生成的稳定事件 ID；旧离线队列可暂不携带。 */
  eventId?: string;
  sessionId: string;
  anonymousId?: string;
  distinctId?: string;
  eventType: UserBehaviorEventType;
  eventName?: string;
  pagePath: string;
  pageTitle?: string;
  elementKey?: string;
  elementLabel?: string;
  componentArea?: string;
  clickX?: number;
  clickY?: number;
  scrollDepth?: number;
  durationMs?: number;
  properties?: Record<string, unknown>;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  screenW?: number;
  screenH?: number;
  language?: string;
  metricName?: string;
  metricValue?: number;
  /** 客户端事件时间戳（epoch ms），离线重放时保留真实时间 */
  ts?: number;
  /** 事件来源平台；未携带时由服务端按接入方式默认推断（历史行为兼容 web_admin） */
  source?: AnalyticsEventSource;
  /** 应用标识（多 App 场景预留） */
  appId?: string;
  /** 采集环境 */
  environment?: AnalyticsEnvironment;
  /** 采集 SDK 版本 */
  sdkVersion?: string;
}

/** SDK 远程配置 */
export interface AnalyticsSettings {
  id: number;
  enabled: boolean;
  sampleRate: number;
  trackPageviews: boolean;
  trackClicks: boolean;
  trackPerformance: boolean;
  trackErrors: boolean;
  trackApi: boolean;
  maskInputs: boolean;
  respectDnt: boolean;
  anonymizeIp: boolean;
  blacklistPaths: string[];
  retentionDays: number;
  errorRetentionDays: number;
  sessionTimeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
}

/** SDK 公开配置（无需鉴权可获取的精简版） */
export interface AnalyticsPublicConfig {
  enabled: boolean;
  sampleRate: number;
  trackPageviews: boolean;
  trackClicks: boolean;
  trackPerformance: boolean;
  trackErrors: boolean;
  trackApi: boolean;
  maskInputs: boolean;
  respectDnt: boolean;
  blacklistPaths: string[];
  sessionTimeoutMinutes: number;
  siteId?: number;
  appId?: string;
}

export type AnalyticsEventMetaStatus = 'active' | 'deprecated' | 'blocked';

/** Tracking Plan 属性类型（阶段 1 支持的最小类型集） */
export type AnalyticsEventPropertyType = 'string' | 'number' | 'boolean' | 'datetime' | 'object' | 'array';

export interface AnalyticsEventPropertyDef {
  key: string;
  type: AnalyticsEventPropertyType;
  description?: string;
  /** 是否为必填属性（严格模式下用于质量校验） */
  required?: boolean;
  /** 枚举取值范围（仅对 string 类型有效） */
  enumValues?: string[];
  /** 是否含个人敏感信息，供采集/导出侧脱敏参考 */
  pii?: boolean;
}

export interface AnalyticsEventMeta {
  id: number;
  eventName: string;
  displayName: string | null;
  category: string | null;
  description: string | null;
  propertySchema: AnalyticsEventPropertyDef[] | null;
  status: AnalyticsEventMetaStatus;
  eventCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  /** Tracking Plan 契约版本号，结构性变更时递增 */
  version: number;
  /** 契约负责人（平台侧用户） */
  ownerId: number | null;
  ownerName: string | null;
  /** 严格模式：开启后对不符合 propertySchema 的属性做质量记录 */
  strictMode: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 行为分析（聚合结果）──────────────────────────────────────────────────────
export interface AnalyticsOverview {
  pv: number;
  uv: number;
  sessions: number;
  events: number;
  newUsers: number;
  avgSessionMs: number;
  bounceRate: number;
  avgPagesPerSession: number;
  pvDelta: number;
  uvDelta: number;
  sessionsDelta: number;
  bounceRateDelta: number;
  activeNow: number;
}

export interface TrendSeries {
  dates: string[];
  series: { key: string; name: string; data: number[] }[];
  compare?: { dates: string[]; series: { key: string; name: string; data: number[] }[] };
}

export interface FunnelStepInput {
  eventType?: UserBehaviorEventType;
  eventName?: string;
  pagePath?: string;
  elementKey?: string;
  label: string;
  /** 该步骤的属性过滤（最多 5 条，AND 语义） */
  properties?: AnalyticsSegmentPropertyFilter[];
}

export interface FunnelStepResult {
  label: string;
  users: number;
  conversionRate: number;
  stepConversionRate: number;
  dropoff: number;
  /** 相对上一步的平均转化耗时（毫秒），首步为 null */
  averageConversionMs: number | null;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  totalUsers: number;
  overallConversionRate: number;
}

/** 漏斗查询：有序转化（严格步骤先后顺序 + 转化窗口） */
export interface FunnelQuery {
  days: number;
  steps: FunnelStepInput[];
  /** 转化窗口（小时），首步到末步必须在该窗口内完成，默认 72，范围 1~720 */
  conversionWindowHours?: number;
  /** 仅统计指定分群内成员（先按分群成员过滤 distinctId 再计算漏斗） */
  segmentId?: number;
}

/** 留存计算口径：first_seen = 全历史真实首访；window_first = 当前统计窗口内首次出现 */
export type AnalyticsRetentionMode = 'first_seen' | 'window_first';

export interface RetentionResult {
  cohorts: {
    cohortDate: string;
    cohortSize: number;
    values: (number | null)[];
  }[];
  periods: number[];
  mode: AnalyticsRetentionMode;
}

export interface PathNode { id: string; label: string; value: number; step: number }

export interface PathLink { source: string; target: string; value: number; step: number }

export interface PathResult { nodes: PathNode[]; links: PathLink[]; maxStep: number }

export interface AnalyticsSavedReport {
  id: number;
  name: string;
  reportType: string;
  config: Record<string, unknown>;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
}

export interface DimensionBreakdownItem { name: string; value: number; percent: number }

export interface DimensionBreakdown {
  dimension: string;
  total: number;
  items: DimensionBreakdownItem[];
}

export interface DimensionCross {
  dim1: string;
  dim2: string;
  columns: string[];
  rows: { name: string; total: number; values: number[] }[];
}

export interface PerfStatItem {
  metricName: string;
  count: number;
  avg: number | null;
  p75: number | null;
  p90: number | null;
  p99: number | null;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface PerfStats {
  items: PerfStatItem[];
}

export interface RealtimeStats {
  activeUsers: number;
  pageViewsLast30Min: number;
  eventsLastMinute: number;
  topPages: { pagePath: string; pageTitle: string | null; active: number }[];
  recentEvents: {
    eventType: UserBehaviorEventType;
    eventName: string | null;
    pagePath: string;
    username: string | null;
    createdAt: string;
  }[];
  perMinute: { minute: string; events: number }[];
}

export interface EventListItem {
  id: number;
  userId: number | null;
  username: string | null;
  eventType: UserBehaviorEventType;
  eventName: string | null;
  pagePath: string;
  pageTitle: string | null;
  elementKey: string | null;
  elementLabel: string | null;
  componentArea: string | null;
  durationMs: number | null;
  browser: string | null;
  os: string | null;
  deviceType: AnalyticsDeviceType | null;
  region: string | null;
  sessionId: string | null;
  createdAt: string;
  memberId: number | null;
  source: AnalyticsEventSource;
  appId: string;
  environment: AnalyticsEnvironment;
}

export interface EventDetail extends EventListItem {
  distinctId: string | null;
  anonymousId: string | null;
  scrollDepth: number | null;
  properties: Record<string, unknown> | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  browserVersion: string | null;
  osVersion: string | null;
  screenW: number | null;
  screenH: number | null;
  language: string | null;
  userAgent: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  metricName: string | null;
  metricValue: number | null;
  sdkVersion: string | null;
}

export interface AnalyticsRollupItem {
  statDate: string;
  pv: number;
  uv: number;
  sessions: number;
  events: number;
  bounceSessions: number;
  totalDwellMs: number;
}

// ─── 行为中心阶段 1：租户级事件启停覆盖 ───────────────────────────────────────
export type AnalyticsEventOverrideStatus = 'enabled' | 'disabled';

export interface AnalyticsEventOverride {
  id: number;
  tenantId: number;
  eventName: string;
  status: AnalyticsEventOverrideStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 行为中心阶段 2：站点模型 ──────────────────────────────────────────────────

export interface AnalyticsSite {
  id: number;
  tenantId: number | null;
  tenantName?: string | null;
  siteKey: string;
  name: string;
  appId: string;
  allowedOrigins: string[] | null;
  dailyEventQuota: number | null;
  todayUsage: number | null;
  status: AnalyticsEventOverrideStatus;
  remark: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 行为中心阶段 1：埋点质量日聚合 ────────────────────────────────────────────
export type AnalyticsQualityIssueType = 'missing_required' | 'type_mismatch' | 'invalid_enum' | 'event_disabled' | 'origin_rejected' | 'quota_exceeded';

export interface AnalyticsQualityDaily {
  id: number;
  tenantId: number;
  statDate: string;
  eventName: string;
  issueType: AnalyticsQualityIssueType;
  count: number;
  sample: Record<string, unknown> | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 埋点质量看板查询结果：按日/事件/问题类型明细 + 汇总 */
export interface AnalyticsQualityQueryResult {
  items: AnalyticsQualityDaily[];
  totals: Array<{ issueType: AnalyticsQualityIssueType; count: number }>;
  totalCount: number;
}

// ─── 行为中心阶段 1：事件调试流 ────────────────────────────────────────────────
export interface AnalyticsDebugEvent {
  id: number;
  eventId: string | null;
  eventType: UserBehaviorEventType;
  eventName: string | null;
  source: AnalyticsEventSource;
  appId: string;
  environment: AnalyticsEnvironment;
  distinctId: string | null;
  memberId: number | null;
  userId: number | null;
  pagePath: string;
  properties: Record<string, unknown> | null;
  createdAt: string;
  /** 当日该事件命中的质量问题类型（去重） */
  issueTypes: AnalyticsQualityIssueType[];
}

// ─── 行为中心阶段 1：统一用户画像 ──────────────────────────────────────────────
export interface AnalyticsUserProfile {
  id: number;
  tenantId: number | null;
  distinctId: string;
  identityType: AnalyticsIdentityType;
  userId: number | null;
  memberId: number | null;
  displayName: string | null;
  properties: Record<string, unknown> | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 行为中心阶段 1：用户分群 ──────────────────────────────────────────────────
/** 分群条件比较运算符 */
export type AnalyticsSegmentCompareOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export interface AnalyticsSegmentPropertyFilter {
  key: string;
  op: AnalyticsSegmentCompareOp;
  value: unknown;
}

/** 事件型条件：过滤最近 N 天内触发过指定事件（可选属性过滤 / 最小次数）的用户 */
export interface AnalyticsSegmentEventCondition {
  type: 'event';
  eventName: string;
  /** 统计窗口（天） */
  days: number;
  /** 最小触发次数，默认 1 */
  minCount?: number;
  properties?: AnalyticsSegmentPropertyFilter[];
}

/** 属性型条件：过滤画像属性（identityType / userId / memberId / properties.xxx） */
export interface AnalyticsSegmentAttributeCondition {
  type: 'attribute';
  /** 'identityType' | 'userId' | 'memberId' | `property.<key>` */
  field: string;
  op: AnalyticsSegmentCompareOp;
  value: unknown;
}

/** 分群条件：本阶段仅支持 event / attribute 两种原子条件，不支持 cohort 嵌套 */
export type AnalyticsSegmentCondition = AnalyticsSegmentEventCondition | AnalyticsSegmentAttributeCondition;

export interface AnalyticsSegmentRule {
  operator: 'AND' | 'OR';
  /** 条件数组，长度限制 1~10 */
  conditions: AnalyticsSegmentCondition[];
}

export interface AnalyticsUserSegment {
  id: number;
  tenantId: number | null;
  name: string;
  description: string | null;
  rules: AnalyticsSegmentRule;
  status: AnalyticsEventOverrideStatus;
  estimatedSize: number;
  snapshotAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 分群成员物化快照（定时任务重算） */
export interface AnalyticsSegmentMember {
  id: number;
  segmentId: number;
  tenantId: number | null;
  distinctId: string;
  identityType: AnalyticsIdentityType;
  userId: number | null;
  memberId: number | null;
  snapshotAt: string;
}

// ─── 行为中心阶段 2：A/B 实验 ─────────────────────────────────────────────────
export type AnalyticsExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface AnalyticsExperimentVariant {
  key: string;
  name: string;
  weight: number;
}

export interface AnalyticsExperiment {
  id: number;
  tenantId: number | null;
  tenantName?: string | null;
  expKey: string;
  name: string;
  description: string | null;
  status: AnalyticsExperimentStatus;
  trafficAllocation: number;
  variants: AnalyticsExperimentVariant[];
  metricEventName: string;
  startAt: string | null;
  endAt: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsExperimentAssignment {
  expKey: string;
  variantKey: string;
}

export interface AnalyticsExperimentReportVariant {
  variantKey: string;
  exposures: number;
  conversions: number;
  conversionRate: number;
}

export interface AnalyticsExperimentReport {
  experimentId: number;
  expKey: string;
  metricEventName: string;
  variants: AnalyticsExperimentReportVariant[];
}

// ─── 行为中心阶段 2：分群触达 ──────────────────────────────────────────────────
export type AnalyticsCampaignChannel = 'email' | 'in_app' | 'webhook';

export type AnalyticsCampaignStatus = 'draft' | 'running' | 'completed' | 'failed';

export interface AnalyticsSegmentCampaign {
  id: number;
  tenantId: number | null;
  segmentId: number;
  segmentName?: string | null;
  name: string;
  channel: AnalyticsCampaignChannel;
  templateId: number | null;
  webhookUrl: string | null;
  status: AnalyticsCampaignStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 行为中心阶段 1：通用事件分析工作台 ────────────────────────────────────────
/** 事件分析可分组维度白名单：禁止任意列/原始 SQL，仅允许以下预置维度 */
export type AnalyticsEventQueryGroupByField =
  | 'date' | 'eventName' | 'pagePath' | 'source' | 'appId' | 'environment'
  | 'browser' | 'os' | 'deviceType' | 'region';

/** 统计指标：事件次数 / 去重用户数（distinctId） */
export type AnalyticsEventQueryMetric = 'events' | 'uv';

export interface AnalyticsEventQueryInput {
  /** 自定义区间起止日（YYYY-MM-DD），优先于 days */
  startDate?: string;
  endDate?: string;
  /** 未提供 startDate/endDate 时，最近 N 天，默认 30 */
  days?: number;
  /** 事件名过滤（最多 20 个，OR 语义） */
  eventNames?: string[];
  source?: AnalyticsEventSource;
  appId?: string;
  environment?: AnalyticsEnvironment;
  deviceType?: AnalyticsDeviceType;
  /** 事件属性过滤（最多 10 条，AND 语义） */
  propertyFilters?: AnalyticsSegmentPropertyFilter[];
  /** 仅统计指定分群内成员 */
  segmentId?: number;
  /** 分组维度（1~2 维，来自白名单） */
  groupBy?: AnalyticsEventQueryGroupByField[];
  metric?: AnalyticsEventQueryMetric;
  /** 结果行数上限，默认 100，最大 200 */
  limit?: number;
}

export interface AnalyticsEventQueryRow {
  dimensions: Record<string, string>;
  value: number;
}

export interface AnalyticsEventQueryResult {
  rows: AnalyticsEventQueryRow[];
  total: number;
  queryMeta: {
    metric: AnalyticsEventQueryMetric;
    groupBy: AnalyticsEventQueryGroupByField[];
    startDate: string;
    endDate: string;
  };
}
