import { COMMON_STATUS_LABELS, COMMON_STATUS_OPTIONS } from '../core/constants';
import type { AnalyticsCampaignChannel, AnalyticsCampaignStatus, AnalyticsDeviceType, AnalyticsEnvironment, AnalyticsEventOverrideStatus, AnalyticsEventSource, AnalyticsExperimentStatus, AnalyticsIdentityType } from './types';

export const SOURCE_MAP_MAX_BYTES = 20 * 1024 * 1024;

export const ANALYTICS_PROPERTIES_MAX_BYTES = 16 * 1024;

export const ANALYTICS_CONTEXT_MAX_BYTES = 32 * 1024;

export const ANALYTICS_BREADCRUMB_DATA_MAX_BYTES = 4 * 1024;

/** 埋点配置版本号存储 key（localStorage），跨标签页广播采集配置已更新，触发其他标签重新拉取 */
export const ANALYTICS_CONFIG_VERSION_KEY = 'zenith_analytics_config_version';

export const ANALYTICS_SITE_KEY_HEADER = 'X-Analytics-Site-Key';

export const ANALYTICS_EXPERIMENT_EXPOSURE_EVENT = '$experiment_exposure';

// ─── 数据分析与报表 ────────────────────────────────────────────────────
export const ANALYTICS_DEVICE_TYPE_LABELS: Record<AnalyticsDeviceType, string> = {
  desktop: '桌面端',
  mobile: '移动端',
  tablet: '平板',
  bot: '爬虫/机器人',
  unknown: '未知',
};

export const ANALYTICS_DEVICE_TYPE_OPTIONS: Array<{ value: AnalyticsDeviceType; label: string }> =
  (Object.keys(ANALYTICS_DEVICE_TYPE_LABELS) as AnalyticsDeviceType[])
    .map((value) => ({ value, label: ANALYTICS_DEVICE_TYPE_LABELS[value] }));

// ─── 行为中心阶段 1：多端来源 / 环境 / 身份归属 ────────────────────────────────
export const ANALYTICS_EVENT_SOURCES: readonly AnalyticsEventSource[] = ['web_admin', 'web_member', 'server'] as const;

export const ANALYTICS_EVENT_SOURCE_LABELS: Record<AnalyticsEventSource, string> = {
  web_admin: '后台管理端',
  web_member: '会员前台',
  server: '服务端',
};

export const ANALYTICS_EVENT_SOURCE_OPTIONS: Array<{ value: AnalyticsEventSource; label: string }> =
  ANALYTICS_EVENT_SOURCES.map((value) => ({ value, label: ANALYTICS_EVENT_SOURCE_LABELS[value] }));

export const ANALYTICS_ENVIRONMENTS: readonly AnalyticsEnvironment[] = ['production', 'staging', 'development'] as const;

export const ANALYTICS_ENVIRONMENT_LABELS: Record<AnalyticsEnvironment, string> = {
  production: '生产环境',
  staging: '预发环境',
  development: '开发环境',
};

export const ANALYTICS_ENVIRONMENT_OPTIONS: Array<{ value: AnalyticsEnvironment; label: string }> =
  ANALYTICS_ENVIRONMENTS.map((value) => ({ value, label: ANALYTICS_ENVIRONMENT_LABELS[value] }));

export const ANALYTICS_IDENTITY_TYPES: readonly AnalyticsIdentityType[] = ['admin', 'member', 'anonymous'] as const;

export const ANALYTICS_IDENTITY_TYPE_LABELS: Record<AnalyticsIdentityType, string> = {
  admin: '后台管理员',
  member: '前台会员',
  anonymous: '匿名访客',
};

export const ANALYTICS_IDENTITY_TYPE_OPTIONS: Array<{ value: AnalyticsIdentityType; label: string }> =
  ANALYTICS_IDENTITY_TYPES.map((value) => ({ value, label: ANALYTICS_IDENTITY_TYPE_LABELS[value] }));

/** 事件覆盖 / 分群状态标签（enabled|disabled，与 COMMON_STATUS_LABELS 同源） */
export const ANALYTICS_EVENT_OVERRIDE_STATUS_LABELS: Record<AnalyticsEventOverrideStatus, string> = COMMON_STATUS_LABELS;

export const ANALYTICS_EVENT_OVERRIDE_STATUS_OPTIONS: Array<{ value: AnalyticsEventOverrideStatus; label: string }> =
  COMMON_STATUS_OPTIONS;

export const ANALYTICS_QUALITY_ISSUE_TYPES = ['missing_required', 'type_mismatch', 'invalid_enum', 'event_disabled', 'origin_rejected', 'quota_exceeded'] as const;

export const ANALYTICS_QUALITY_ISSUE_TYPE_LABELS: Record<(typeof ANALYTICS_QUALITY_ISSUE_TYPES)[number], string> = {
  missing_required: '缺失必填属性',
  type_mismatch: '属性类型不匹配',
  invalid_enum: '枚举取值非法',
  event_disabled: '事件已禁用',
  origin_rejected: '来源被拒绝',
  quota_exceeded: '站点配额超限',
};

export const ANALYTICS_QUALITY_ISSUE_TYPE_OPTIONS: Array<{ value: (typeof ANALYTICS_QUALITY_ISSUE_TYPES)[number]; label: string }> =
  ANALYTICS_QUALITY_ISSUE_TYPES.map((value) => ({ value, label: ANALYTICS_QUALITY_ISSUE_TYPE_LABELS[value] }));

export const ANALYTICS_EVENT_PROPERTY_TYPES = ['string', 'number', 'boolean', 'datetime', 'object', 'array'] as const;

export const ANALYTICS_EVENT_PROPERTY_TYPE_LABELS: Record<(typeof ANALYTICS_EVENT_PROPERTY_TYPES)[number], string> = {
  string: '字符串',
  number: '数字',
  boolean: '布尔值',
  datetime: '日期时间',
  object: '对象',
  array: '数组',
};

export const ANALYTICS_EVENT_PROPERTY_TYPE_OPTIONS: Array<{ value: (typeof ANALYTICS_EVENT_PROPERTY_TYPES)[number]; label: string }> =
  ANALYTICS_EVENT_PROPERTY_TYPES.map((value) => ({ value, label: ANALYTICS_EVENT_PROPERTY_TYPE_LABELS[value] }));

export const ANALYTICS_SEGMENT_COMPARE_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'] as const;

export const ANALYTICS_SEGMENT_COMPARE_OP_LABELS: Record<(typeof ANALYTICS_SEGMENT_COMPARE_OPS)[number], string> = {
  eq: '等于',
  neq: '不等于',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  in: '属于',
};

export const ANALYTICS_SEGMENT_COMPARE_OP_OPTIONS: Array<{ value: (typeof ANALYTICS_SEGMENT_COMPARE_OPS)[number]; label: string }> =
  ANALYTICS_SEGMENT_COMPARE_OPS.map((value) => ({ value, label: ANALYTICS_SEGMENT_COMPARE_OP_LABELS[value] }));

export const ANALYTICS_EXPERIMENT_STATUSES: readonly AnalyticsExperimentStatus[] = ['draft', 'running', 'paused', 'completed'] as const;

export const ANALYTICS_EXPERIMENT_STATUS_LABELS: Record<AnalyticsExperimentStatus, string> = {
  draft: '草稿',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
};

export const ANALYTICS_EXPERIMENT_STATUS_OPTIONS: Array<{ value: AnalyticsExperimentStatus; label: string }> =
  ANALYTICS_EXPERIMENT_STATUSES.map((value) => ({ value, label: ANALYTICS_EXPERIMENT_STATUS_LABELS[value] }));

export const ANALYTICS_CAMPAIGN_CHANNELS: readonly AnalyticsCampaignChannel[] = ['email', 'in_app', 'webhook'] as const;

export const ANALYTICS_CAMPAIGN_CHANNEL_LABELS: Record<AnalyticsCampaignChannel, string> = {
  email: '邮件',
  in_app: '站内信',
  webhook: 'Webhook',
};

export const ANALYTICS_CAMPAIGN_CHANNEL_OPTIONS: Array<{ value: AnalyticsCampaignChannel; label: string }> =
  ANALYTICS_CAMPAIGN_CHANNELS.map((value) => ({ value, label: ANALYTICS_CAMPAIGN_CHANNEL_LABELS[value] }));

export const ANALYTICS_CAMPAIGN_STATUSES: readonly AnalyticsCampaignStatus[] = ['draft', 'running', 'completed', 'failed'] as const;

export const ANALYTICS_CAMPAIGN_STATUS_LABELS: Record<AnalyticsCampaignStatus, string> = {
  draft: '草稿',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
};

export const ANALYTICS_CAMPAIGN_STATUS_OPTIONS: Array<{ value: AnalyticsCampaignStatus; label: string }> =
  ANALYTICS_CAMPAIGN_STATUSES.map((value) => ({ value, label: ANALYTICS_CAMPAIGN_STATUS_LABELS[value] }));

// ─── 行为中心阶段 1：通用事件分析工作台 ────────────────────────────────────────
export const ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS = [
  'date', 'eventName', 'pagePath', 'source', 'appId', 'environment', 'browser', 'os', 'deviceType', 'region',
] as const;

export const ANALYTICS_EVENT_QUERY_GROUP_BY_LABELS: Record<(typeof ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS)[number], string> = {
  date: '日期',
  eventName: '事件名称',
  pagePath: '页面路径',
  source: '来源端',
  appId: '应用',
  environment: '环境',
  browser: '浏览器',
  os: '操作系统',
  deviceType: '设备类型',
  region: '地区',
};

export const ANALYTICS_EVENT_QUERY_GROUP_BY_OPTIONS: Array<{ value: (typeof ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS)[number]; label: string }> =
  ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS.map((value) => ({ value, label: ANALYTICS_EVENT_QUERY_GROUP_BY_LABELS[value] }));

export const ANALYTICS_EVENT_QUERY_METRICS = ['events', 'uv'] as const;

export const ANALYTICS_EVENT_QUERY_METRIC_LABELS: Record<(typeof ANALYTICS_EVENT_QUERY_METRICS)[number], string> = {
  events: '事件次数',
  uv: '去重用户数',
};

export const ANALYTICS_EVENT_QUERY_METRIC_OPTIONS: Array<{ value: (typeof ANALYTICS_EVENT_QUERY_METRICS)[number]; label: string }> =
  ANALYTICS_EVENT_QUERY_METRICS.map((value) => ({ value, label: ANALYTICS_EVENT_QUERY_METRIC_LABELS[value] }));

// ─── 行为中心阶段 1：留存双口径 ────────────────────────────────────────────────
export const ANALYTICS_RETENTION_MODES = ['first_seen', 'window_first'] as const;

export const ANALYTICS_RETENTION_MODE_LABELS: Record<(typeof ANALYTICS_RETENTION_MODES)[number], string> = {
  first_seen: '真实首访（全历史）',
  window_first: '窗口内首现',
};

export const ANALYTICS_RETENTION_MODE_OPTIONS: Array<{ value: (typeof ANALYTICS_RETENTION_MODES)[number]; label: string }> =
  ANALYTICS_RETENTION_MODES.map((value) => ({ value, label: ANALYTICS_RETENTION_MODE_LABELS[value] }));

// ─── 行为中心阶段 1：服务端权威语义事件（首批：支付 / 工作流 / 会员关键操作）──────
// 命名约定：与来源事件总线类型同名（支付）或加 `workflow.` 前缀（工作流），会员业务事件用 `member.<域>.<动作>`。
// 业务域只应引用这些常量拼装 eventName，禁止裸字符串拼写，避免事件字典与实际上报口径漂移。
export const ANALYTICS_SERVER_PAYMENT_EVENT_NAMES = [
  'payment.succeeded', 'payment.closed', 'payment.failed', 'refund.succeeded', 'refund.failed',
] as const;

export const ANALYTICS_SERVER_WORKFLOW_EVENT_NAMES = [
  'workflow.instance.created', 'workflow.instance.approved', 'workflow.instance.rejected', 'workflow.instance.withdrawn',
  'workflow.node.entered', 'workflow.node.left',
  'workflow.task.created', 'workflow.task.assigned', 'workflow.task.approved', 'workflow.task.rejected',
  'workflow.task.skipped', 'workflow.task.transferred', 'workflow.task.addSigned', 'workflow.task.reduceSigned', 'workflow.task.urged',
] as const;

export const ANALYTICS_SERVER_MEMBER_EVENT_NAMES = [
  'member.registered', 'member.profile.updated',
  'member.points.earned', 'member.points.redeemed', 'member.points.adjusted', 'member.points.expired', 'member.points.refunded',
  'member.coupon.received', 'member.coupon.redeemed',
  'member.checkin.completed',
] as const;

export const ANALYTICS_CLIENT_SYSTEM_EVENT_NAMES = [ANALYTICS_EXPERIMENT_EXPOSURE_EVENT] as const;

export const ANALYTICS_SEMANTIC_EVENT_NAMES = [
  ...ANALYTICS_CLIENT_SYSTEM_EVENT_NAMES,
  ...ANALYTICS_SERVER_PAYMENT_EVENT_NAMES,
  ...ANALYTICS_SERVER_WORKFLOW_EVENT_NAMES,
  ...ANALYTICS_SERVER_MEMBER_EVENT_NAMES,
] as const;

export type AnalyticsSemanticEventName = (typeof ANALYTICS_SEMANTIC_EVENT_NAMES)[number];

/**
 * 具名事件常量表：业务调用点（会员 service / 支付 & 工作流订阅桥接）通过该对象引用 eventName，
 * 禁止裸字符串拼写；`satisfies` 约束保证每个值都落在 ANALYTICS_SEMANTIC_EVENT_NAMES 之内。
 */
export const ANALYTICS_EVENT_NAMES = {
  paymentSucceeded: 'payment.succeeded',
  paymentClosed: 'payment.closed',
  paymentFailed: 'payment.failed',
  refundSucceeded: 'refund.succeeded',
  refundFailed: 'refund.failed',
  memberRegistered: 'member.registered',
  memberProfileUpdated: 'member.profile.updated',
  memberPointsEarned: 'member.points.earned',
  memberPointsRedeemed: 'member.points.redeemed',
  memberPointsAdjusted: 'member.points.adjusted',
  memberPointsExpired: 'member.points.expired',
  memberPointsRefunded: 'member.points.refunded',
  memberCouponReceived: 'member.coupon.received',
  memberCouponRedeemed: 'member.coupon.redeemed',
  memberCheckinCompleted: 'member.checkin.completed',
} as const satisfies Record<string, AnalyticsSemanticEventName>;

/** member.points.* 系列事件按 `member-points.service.ts` 的 PointTxType 一一映射，避免拼写漂移 */
export const ANALYTICS_MEMBER_POINTS_EVENT_BY_TX_TYPE: Record<'earn' | 'redeem' | 'expire' | 'adjust' | 'refund', AnalyticsSemanticEventName> = {
  earn: ANALYTICS_EVENT_NAMES.memberPointsEarned,
  redeem: ANALYTICS_EVENT_NAMES.memberPointsRedeemed,
  expire: ANALYTICS_EVENT_NAMES.memberPointsExpired,
  adjust: ANALYTICS_EVENT_NAMES.memberPointsAdjusted,
  refund: ANALYTICS_EVENT_NAMES.memberPointsRefunded,
};

export const ANALYTICS_SEMANTIC_EVENT_LABELS: Record<AnalyticsSemanticEventName, string> = {
  [ANALYTICS_EXPERIMENT_EXPOSURE_EVENT]: '实验曝光',
  'payment.succeeded': '支付成功',
  'payment.closed': '支付关闭',
  'payment.failed': '支付失败',
  'refund.succeeded': '退款成功',
  'refund.failed': '退款失败',
  'workflow.instance.created': '流程发起',
  'workflow.instance.approved': '流程通过',
  'workflow.instance.rejected': '流程驳回',
  'workflow.instance.withdrawn': '流程撤回',
  'workflow.node.entered': '流程节点进入',
  'workflow.node.left': '流程节点离开',
  'workflow.task.created': '审批任务创建',
  'workflow.task.assigned': '审批任务分配',
  'workflow.task.approved': '审批任务通过',
  'workflow.task.rejected': '审批任务驳回',
  'workflow.task.skipped': '审批任务跳过',
  'workflow.task.transferred': '审批任务转办',
  'workflow.task.addSigned': '审批任务加签',
  'workflow.task.reduceSigned': '审批任务减签',
  'workflow.task.urged': '审批任务催办',
  'member.registered': '会员注册',
  'member.profile.updated': '会员资料更新',
  'member.points.earned': '积分获得',
  'member.points.redeemed': '积分消费',
  'member.points.adjusted': '积分调整',
  'member.points.expired': '积分过期',
  'member.points.refunded': '积分退回',
  'member.coupon.received': '优惠券领取',
  'member.coupon.redeemed': '优惠券核销',
  'member.checkin.completed': '签到完成',
};
