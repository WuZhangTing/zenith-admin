import { z } from 'zod';
import { boundedJsonRecord, dateTimeStringSchema, partialForUpdate, validateAlertDelivery, webhookUrlSchema } from '../core/validation';
import { userBehaviorEventTypeEnum } from '../identity/validation';
import { ANALYTICS_ACQUISITION_DIMENSIONS, ANALYTICS_ATTRIBUTION_MODELS, ANALYTICS_BREAKDOWN_DIMENSIONS, ANALYTICS_BREADCRUMB_DATA_MAX_BYTES, ANALYTICS_CAMPAIGN_CHANNELS, ANALYTICS_COMPARE_MAX_SEGMENTS, ANALYTICS_DRILL_FUNNEL_OUTCOMES, ANALYTICS_DRILL_PAGE_SIZE_MAX, ANALYTICS_DRILL_RETENTION_OUTCOMES, ANALYTICS_ENVIRONMENTS, ANALYTICS_EVENT_PROPERTY_TYPES, ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS, ANALYTICS_EVENT_QUERY_METRICS, ANALYTICS_EVENT_SOURCES, ANALYTICS_EXPERIMENT_STATUSES, ANALYTICS_PROPERTIES_MAX_BYTES, ANALYTICS_PROPERTY_KEY_PATTERN, ANALYTICS_RETENTION_MAX_DAYS, ANALYTICS_RETENTION_MAX_PERIODS, ANALYTICS_RETENTION_MODES, ANALYTICS_RETENTION_PERIOD_TYPES, ANALYTICS_SEGMENT_COMPARE_OPS, SOURCE_MAP_MAX_BYTES, analyticsMetricRequiresProperty } from './constants';

const trackEventBaseSchema = z.object({
  eventId: z.uuid().optional(),
  sessionId: z.string().min(1).max(36),
  anonymousId: z.string().min(1).max(64).optional(),
  distinctId: z.string().min(1).max(64).optional(),
  eventName: z.string().max(128).optional(),
  pagePath: z.string().min(1).max(256),
  pageTitle: z.string().max(128).optional(),
  elementKey: z.string().max(128).optional(),
  elementLabel: z.string().max(128).optional(),
  componentArea: z.string().max(64).optional(),
  clickX: z.number().min(0).max(100).optional(),
  clickY: z.number().min(0).max(100).optional(),
  scrollDepth: z.number().int().min(0).max(100).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  properties: boundedJsonRecord('事件属性', 50, ANALYTICS_PROPERTIES_MAX_BYTES).optional(),
  referrer: z.string().max(512).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  screenW: z.number().int().min(0).max(100_000).optional(),
  screenH: z.number().int().min(0).max(100_000).optional(),
  language: z.string().max(16).optional(),
  metricName: z.string().max(32).optional(),
  metricValue: z.number().optional(),
  ts: z.number().int().positive().optional(),
  // 行为中心阶段 1：多端平台字段（均可选，未携带时由服务端按接入方式默认推断）
  source: z.enum(ANALYTICS_EVENT_SOURCES).optional(),
  appId: z.string().min(1).max(64).optional(),
  environment: z.enum(ANALYTICS_ENVIRONMENTS).optional(),
  sdkVersion: z.string().max(32).optional(),
});

export const trackEventInputSchema = z.discriminatedUnion('eventType', [
  trackEventBaseSchema.extend({ eventType: z.literal('page_view') }),
  trackEventBaseSchema.extend({ eventType: z.literal('page_leave') }),
  trackEventBaseSchema.extend({ eventType: z.literal('feature_use') }),
  trackEventBaseSchema.extend({ eventType: z.literal('area_click') }),
  trackEventBaseSchema.extend({ eventType: z.literal('api_request') }),
  trackEventBaseSchema.extend({
    eventType: z.literal('custom'),
    eventName: z.string().min(1).max(128),
  }),
  trackEventBaseSchema.extend({
    eventType: z.literal('perf'),
    metricName: z.string().min(1).max(32),
    metricValue: z.number(),
  }),
  trackEventBaseSchema.extend({
    eventType: z.literal('identify'),
    distinctId: z.string().min(1).max(64),
  }),
]);

export const batchTrackEventsSchema = z.object({
  events: z.array(trackEventInputSchema).min(1).max(100),
});

// ─── 错误上报 ─────────────────────────────────────────────────────────────────
export const errorBreadcrumbSchema = z.object({
  type: z.enum(['navigation', 'click', 'http', 'console', 'custom']),
  message: z.string().max(512),
  level: z.enum(['fatal', 'error', 'warning', 'info']).optional(),
  data: boundedJsonRecord('面包屑数据', 20, ANALYTICS_BREADCRUMB_DATA_MAX_BYTES, 4).optional(),
  timestamp: z.string().max(32),
});

// ─── 错误处理（后台）─────────────────────────────────────────────────────────
export const updateErrorGroupSchema = z.object({
  status: z.enum(['unresolved', 'resolved', 'ignored', 'muted']).optional(),
  level: z.enum(['fatal', 'error', 'warning', 'info']).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

const errorAlertRuleBaseSchema = z.object({
  name: z.string().min(1).max(128),
  errorType: z.enum(['js_error', 'promise_rejection', 'resource_error', 'console_error', 'http_error', 'white_screen', 'crash']).nullable().optional(),
  level: z.enum(['fatal', 'error', 'warning', 'info']).nullable().optional(),
  condition: z.enum(['new_error', 'threshold', 'spike']).default('threshold'),
  thresholdCount: z.number().int().min(1).max(100_000).default(10),
  windowMinutes: z.number().int().min(1).max(10_080).default(60),
  channels: z.array(z.enum(['email', 'webhook', 'inapp'])).default([]),
  webhookUrl: webhookUrlSchema.nullable().optional(),
  recipients: z.array(z.string().max(128)).default([]),
  enabled: z.boolean().default(true),
});

export const createErrorAlertRuleSchema = errorAlertRuleBaseSchema.superRefine(validateAlertDelivery);

export const updateErrorAlertRuleSchema = partialForUpdate(errorAlertRuleBaseSchema).superRefine((value, ctx) => {
  if (value.enabled === true && value.channels !== undefined) validateAlertDelivery(value, ctx);
});

// ─── 事件元数据（Tracking Plan）───────────────────────────────────────────────
export const analyticsEventPropertyDefSchema = z.object({
  key: z.string().min(1).max(64),
  type: z.enum(ANALYTICS_EVENT_PROPERTY_TYPES),
  description: z.string().max(256).optional(),
  required: z.boolean().optional(),
  enumValues: z.array(z.string().max(128)).max(50).optional(),
  pii: z.boolean().optional(),
});

// 同一事件的属性 schema 中，key 必须唯一（否则前后定义相互覆盖，采集/校验行为不可预期）
const analyticsPropertySchemaListSchema = z.array(analyticsEventPropertyDefSchema).max(100).superRefine((defs, ctx) => {
  const seen = new Set<string>();
  defs.forEach((def, index) => {
    if (seen.has(def.key)) {
      ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `属性 key「${def.key}」重复，同一事件的属性 schema 中 key 必须唯一` });
    }
    seen.add(def.key);
  });
});

export const createAnalyticsEventMetaSchema = z.object({
  eventName: z.string().min(1).max(128),
  displayName: z.string().max(128).nullable().optional(),
  category: z.string().max(64).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  propertySchema: analyticsPropertySchemaListSchema.nullable().optional(),
  status: z.enum(['active', 'deprecated', 'blocked']).default('active'),
  // Tracking Plan 契约负责人（版本号由服务端在结构性变更时自动递增，不作为客户端入参）
  ownerId: z.number().int().positive().nullable().optional(),
  ownerName: z.string().max(64).nullable().optional(),
  strictMode: z.boolean().default(false),
});

export const updateAnalyticsEventMetaSchema = partialForUpdate(createAnalyticsEventMetaSchema);

// ─── 行为中心阶段 1：租户级事件启停覆盖 ───────────────────────────────────────
export const createAnalyticsEventOverrideSchema = z.object({
  eventName: z.string().min(1).max(128),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  reason: z.string().max(500).nullable().optional(),
});

export const updateAnalyticsEventOverrideSchema = z.object({
  status: z.enum(['enabled', 'disabled']).optional(),
  reason: z.string().max(500).nullable().optional(),
});

// ─── 行为中心阶段 2：站点模型 ──────────────────────────────────────────────────
const analyticsOriginSchema = z.string().min(1).max(255).refine((value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.origin === value && url.pathname === '/' && url.search === '' && url.hash === '';
  } catch { return false; }
}, '来源必须是合法 origin，如 https://example.com 或 http://localhost:3000，不能包含路径或查询参数');

export const createAnalyticsSiteSchema = z.object({
  name: z.string().min(1).max(100),
  appId: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_-]*$/, 'appId 必须以小写字母开头，仅允许小写字母、数字、下划线和中划线'),
  allowedOrigins: z.array(analyticsOriginSchema).max(100).nullable().optional(),
  dailyEventQuota: z.number().int().positive().nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(500).nullable().optional(),
});

export const updateAnalyticsSiteSchema = partialForUpdate(createAnalyticsSiteSchema);

// ─── 行为中心阶段 1：用户分群 ──────────────────────────────────────────────────
export const analyticsSegmentPropertyFilterSchema = z.object({
  key: z.string().min(1).max(64),
  op: z.enum(ANALYTICS_SEGMENT_COMPARE_OPS),
  value: z.unknown(),
});

const analyticsSegmentEventConditionSchema = z.object({
  type: z.literal('event'),
  eventName: z.string().min(1).max(128),
  days: z.number().int().min(1).max(365),
  minCount: z.number().int().min(1).max(100_000).optional(),
  properties: z.array(analyticsSegmentPropertyFilterSchema).max(20).optional(),
});

const analyticsSegmentAttributeConditionSchema = z.object({
  type: z.literal('attribute'),
  // 'identityType' | 'userId' | 'memberId' | `property.<key>`
  field: z.string().min(1).max(128),
  op: z.enum(ANALYTICS_SEGMENT_COMPARE_OPS),
  value: z.unknown(),
});

export const analyticsSegmentConditionSchema = z.discriminatedUnion('type', [
  analyticsSegmentEventConditionSchema,
  analyticsSegmentAttributeConditionSchema,
]);

// 本阶段仅支持 event / attribute 两类原子条件，不支持 cohort 嵌套（无 type: 'segment'）
export const analyticsSegmentRuleSchema = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.array(analyticsSegmentConditionSchema).min(1).max(10),
});

export const createAnalyticsUserSegmentSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1000).nullable().optional(),
  rules: analyticsSegmentRuleSchema,
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateAnalyticsUserSegmentSchema = partialForUpdate(createAnalyticsUserSegmentSchema);

const analyticsWebhookUrlSchema = z.string().max(500).url('Webhook URL 格式不正确').refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}, 'Webhook URL 必须以 http:// 或 https:// 开头');

function refineAnalyticsCampaign(
  value: { channel?: (typeof ANALYTICS_CAMPAIGN_CHANNELS)[number]; templateId?: number | null; webhookUrl?: string | null },
  ctx: z.RefinementCtx,
) {
  if (value.channel === 'webhook') {
    if (!value.webhookUrl) {
      ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'Webhook 渠道必须填写 Webhook URL' });
    }
    return;
  }
  if (value.channel === 'email' || value.channel === 'in_app' || value.channel === 'sms') {
    if (!value.templateId) {
      ctx.addIssue({ code: 'custom', path: ['templateId'], message: '邮件/站内信/短信渠道必须选择模板' });
    }
  }
}

const analyticsCampaignBaseSchema = z.object({
  segmentId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  channel: z.enum(ANALYTICS_CAMPAIGN_CHANNELS),
  templateId: z.number().int().positive().nullable().optional(),
  webhookUrl: z.preprocess((value) => value === '' ? null : value, analyticsWebhookUrlSchema.nullable().optional()),
  landingUrl: z.preprocess((value) => value === '' ? null : value, z.url('落地页必须是合法 URL').max(2048).nullable().optional()),
});

export const createAnalyticsCampaignSchema = analyticsCampaignBaseSchema.superRefine(refineAnalyticsCampaign);

export const updateAnalyticsCampaignSchema = partialForUpdate(analyticsCampaignBaseSchema.omit({ segmentId: true })).superRefine(refineAnalyticsCampaign);

// ─── 行为中心阶段 2：A/B 实验 ──────────────────────────────────────────────────
const analyticsExperimentKeySchema = z.string().min(1).max(64).regex(/^[a-z][a-z0-9_-]*$/, '标识必须以小写字母开头，仅允许小写字母、数字、下划线和中划线');

export const analyticsExperimentVariantSchema = z.object({
  key: analyticsExperimentKeySchema,
  name: z.string().min(1).max(100),
  weight: z.number().int().min(0).max(100),
});

export const analyticsExperimentVariantsSchema = z.array(analyticsExperimentVariantSchema).min(2, '至少配置 2 个变体').max(6, '最多配置 6 个变体').superRefine((variants, ctx) => {
  const seen = new Set<string>();
  let total = 0;
  variants.forEach((variant, index) => {
    total += variant.weight;
    if (seen.has(variant.key)) {
      ctx.addIssue({ code: 'custom', path: [index, 'key'], message: `变体 key「${variant.key}」重复` });
    }
    seen.add(variant.key);
  });
  if (total !== 100) ctx.addIssue({ code: 'custom', path: ['weight'], message: '变体权重总和必须等于 100' });
});

function refineExperimentWindow(value: { startAt?: string | null; endAt?: string | null }, ctx: z.RefinementCtx) {
  if (value.startAt && value.endAt && value.endAt <= value.startAt) {
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: '结束时间必须晚于开始时间' });
  }
}

const analyticsExperimentBaseSchema = z.object({
  expKey: analyticsExperimentKeySchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  status: z.enum(ANALYTICS_EXPERIMENT_STATUSES).default('draft'),
  trafficAllocation: z.number().int().min(0).max(100).default(100),
  variants: analyticsExperimentVariantsSchema,
  metricEventName: z.string().min(1).max(128),
  startAt: dateTimeStringSchema.nullable().optional(),
  endAt: dateTimeStringSchema.nullable().optional(),
});

export const createAnalyticsExperimentSchema = analyticsExperimentBaseSchema.superRefine(refineExperimentWindow);

export const updateAnalyticsExperimentSchema = partialForUpdate(analyticsExperimentBaseSchema).superRefine(refineExperimentWindow);

// ─── 采集设置 ─────────────────────────────────────────────────────────────────
export const updateAnalyticsSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  sampleRate: z.number().min(0).max(1).optional(),
  trackPageviews: z.boolean().optional(),
  trackClicks: z.boolean().optional(),
  trackPerformance: z.boolean().optional(),
  trackErrors: z.boolean().optional(),
  trackApi: z.boolean().optional(),
  maskInputs: z.boolean().optional(),
  respectDnt: z.boolean().optional(),
  anonymizeIp: z.boolean().optional(),
  blacklistPaths: z.array(z.string().max(256)).optional(),
  /** 错误忽略规则：正则字符串数组，命中 message 的错误上报直接丢弃 */
  errorIgnorePatterns: z.array(z.string().min(1).max(500)).max(50).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  errorRetentionDays: z.number().int().min(1).max(3650).optional(),
  sessionTimeoutMinutes: z.number().int().min(1).max(1440).optional(),
  trackReplay: z.boolean().optional(),
  replaySessionSampleRate: z.number().min(0).max(1).optional(),
  replayOnError: z.boolean().optional(),
  replayMaskAllText: z.boolean().optional(),
  replayBlockSelector: z.string().max(256).optional(),
  replayRetentionDays: z.number().int().min(1).max(3650).optional(),
});

// ─── 会话回放 ─────────────────────────────────────────────────────────────────
/** 回放分片上报 meta（multipart 的 meta 字段，与二进制 gz 数据同包提交） */
export const replaySegmentMetaSchema = z.object({
  /** 回放会话 ID（客户端生成 UUID，首分片 upsert 会话） */
  replayId: z.string().uuid(),
  /** tracker 会话 ID */
  sessionId: z.string().min(1).max(36),
  seq: z.number().int().min(0).max(600),
  mode: z.enum(['buffer', 'stream']),
  triggers: z.array(z.object({
    type: z.enum(['error', 'sampled', 'manual', 'rage_click', 'white_screen']),
    at: z.string(),
    refId: z.string().max(128).optional(),
  })).max(50),
  /** 会话起点（客户端毫秒时间戳） */
  startedAt: z.number(),
  /** 分片时间范围（客户端毫秒时间戳） */
  fromTs: z.number(),
  toTs: z.number(),
  eventCount: z.number().int().min(0),
  hasFullSnapshot: z.boolean(),
  /** 分片内翻页/点击计数（会话行聚合） */
  pageCount: z.number().int().min(0).default(0),
  clickCount: z.number().int().min(0).default(0),
  /** 会话是否随本分片收尾（unload 终包标记） */
  final: z.boolean().default(false),
  entryPageUrl: z.string().max(512).optional(),
  sdkVersion: z.string().max(32).optional(),
  source: z.enum(ANALYTICS_EVENT_SOURCES).optional(),
  appId: z.string().min(1).max(64).optional(),
  environment: z.enum(ANALYTICS_ENVIRONMENTS).optional(),
});

export type ReplaySegmentMetaInput = z.infer<typeof replaySegmentMetaSchema>;

// ─── 阶段 2：统一对比轴（breakdown 维度 / 群组对比）──────────────────────────
export const analyticsBreakdownDimensionSchema = z.enum(ANALYTICS_BREAKDOWN_DIMENSIONS);

/**
 * 判别联合而非可选字段组合：`{ dimension?, segmentIds? }` 这类写法允许两者同时出现，
 * 服务端就必须在运行时再决定优先级，前后端极易理解不一致。判别联合把「二选一」
 * 焊死在类型层。
 */
export const analyticsComparisonSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('dimension'), dimension: analyticsBreakdownDimensionSchema }),
  z.object({
    type: z.literal('segments'),
    segmentIds: z.array(z.number().int().positive()).min(1).max(ANALYTICS_COMPARE_MAX_SEGMENTS),
  }),
]);

// ─── 漏斗 / 路径分析查询 ──────────────────────────────────────────────────────
export const funnelStepSchema = z.object({
  eventType: userBehaviorEventTypeEnum.optional(),
  eventName: z.string().min(1).max(128).optional(),
  pagePath: z.string().min(1).max(256).optional(),
  elementKey: z.string().min(1).max(128).optional(),
  label: z.string().min(1).max(64),
  /** 该步骤的属性过滤（最多 5 条，AND 语义） */
  properties: z.array(analyticsSegmentPropertyFilterSchema).max(5).optional(),
}).refine(
  (step) => step.eventType !== undefined || step.eventName !== undefined || step.pagePath !== undefined || step.elementKey !== undefined,
  { message: '漏斗步骤至少需要一个事件或页面条件' },
);

export const funnelQuerySchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  steps: z.array(funnelStepSchema).min(2).max(10),
  /** 转化窗口（小时）：首步到末步必须在该窗口内完成，默认 72 */
  conversionWindowHours: z.number().int().min(1).max(720).default(72),
  comparison: analyticsComparisonSchema.default({ type: 'none' }),
});

// ─── 留存分析查询 ─────────────────────────────────────────────────────────────
export const analyticsRetentionModeSchema = z.enum(ANALYTICS_RETENTION_MODES);

export const analyticsRetentionPeriodTypeSchema = z.enum(ANALYTICS_RETENTION_PERIOD_TYPES);

export const retentionQuerySchema = z.object({
  // 上限按 periodType 在服务端二次收敛：周/月留存需要远超 60 天的回溯窗口
  days: z.number().int().min(1).max(ANALYTICS_RETENTION_MAX_DAYS).optional(),
  mode: analyticsRetentionModeSchema.default('first_seen'),
  periodType: analyticsRetentionPeriodTypeSchema.default('day'),
  maxPeriods: z.number().int().min(1).max(ANALYTICS_RETENTION_MAX_PERIODS).optional(),
  comparison: analyticsComparisonSchema.default({ type: 'none' }),
});

// ─── 阶段 2：获客与归因报表 ───────────────────────────────────────────────────
export const analyticsAttributionModelSchema = z.enum(ANALYTICS_ATTRIBUTION_MODELS);

export const analyticsAcquisitionDimensionSchema = z.enum(ANALYTICS_ACQUISITION_DIMENSIONS);

export const analyticsAcquisitionQuerySchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  dimension: analyticsAcquisitionDimensionSchema.default('channel'),
  model: analyticsAttributionModelSchema.default('last_touch'),
  /** 转化事件名；留空则只看流量结构，不算转化 */
  conversionEvent: z.string().min(1).max(128).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

// ─── 阶段 2：图表下钻用户列表 ─────────────────────────────────────────────────
const analyticsDrillFunnelContextSchema = z.object({
  type: z.literal('funnel'),
  days: z.number().int().min(1).max(365).default(30),
  steps: z.array(funnelStepSchema).min(2).max(10),
  conversionWindowHours: z.number().int().min(1).max(720).default(72),
  comparison: analyticsComparisonSchema.default({ type: 'none' }),
  seriesKey: z.string().max(256).optional(),
  stepIndex: z.number().int().min(0).max(9),
  outcome: z.enum(ANALYTICS_DRILL_FUNNEL_OUTCOMES),
}).refine((ctx) => ctx.stepIndex < ctx.steps.length, { message: 'stepIndex 超出漏斗步骤范围' })
  // 首步没有「上一步」，流失口径无从定义；放行会静默返回空列表，用户以为没人流失
  .refine((ctx) => !(ctx.outcome === 'dropped' && ctx.stepIndex === 0), { message: '首步不存在流失用户' });

const analyticsDrillRetentionContextSchema = z.object({
  type: z.literal('retention'),
  days: z.number().int().min(1).max(ANALYTICS_RETENTION_MAX_DAYS).optional(),
  mode: analyticsRetentionModeSchema.default('first_seen'),
  periodType: analyticsRetentionPeriodTypeSchema.default('day'),
  comparison: analyticsComparisonSchema.default({ type: 'none' }),
  seriesKey: z.string().max(256).optional(),
  cohortDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodIndex: z.number().int().min(0).max(ANALYTICS_RETENTION_MAX_PERIODS - 1),
  outcome: z.enum(ANALYTICS_DRILL_RETENTION_OUTCOMES),
});

export const analyticsDrillUsersSchema = z.object({
  context: z.discriminatedUnion('type', [analyticsDrillFunnelContextSchema, analyticsDrillRetentionContextSchema]),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(ANALYTICS_DRILL_PAGE_SIZE_MAX).default(20),
});

// ─── 行为中心阶段 1：通用事件分析工作台 ────────────────────────────────────────
const analyticsEventQueryDeviceTypeEnum = z.enum(['desktop', 'mobile', 'tablet', 'bot', 'unknown']);

export const analyticsEventQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(1).max(365).default(30),
  eventNames: z.array(z.string().min(1).max(128)).max(20).optional(),
  source: z.enum(ANALYTICS_EVENT_SOURCES).optional(),
  appId: z.string().max(64).optional(),
  environment: z.enum(ANALYTICS_ENVIRONMENTS).optional(),
  deviceType: analyticsEventQueryDeviceTypeEnum.optional(),
  propertyFilters: z.array(analyticsSegmentPropertyFilterSchema).max(10).optional(),
  segmentId: z.number().int().positive().optional(),
  groupBy: z.array(z.enum(ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS)).min(1).max(2).default(['date']),
  metric: z.enum(ANALYTICS_EVENT_QUERY_METRICS).default('events'),
  /** 数值属性 key，与属性过滤共用白名单正则，杜绝 jsonb 路径注入 */
  metricProperty: z.string().regex(ANALYTICS_PROPERTY_KEY_PATTERN, '属性 key 只允许字母数字下划线点横线，长度 1~64').optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
}).refine(
  // 缺 metricProperty 时若静默退化成事件计数，用户会拿着「事件次数」当成「金额求和」读
  (input) => !analyticsMetricRequiresProperty(input.metric) || !!input.metricProperty,
  { message: '该指标需要指定数值属性字段', path: ['metricProperty'] },
);

export const sourceMapUploadSchema = z.object({
  release: z.string().min(1).max(64),
  fileName: z.string().min(1).max(256),
  content: z.string().min(1).max(SOURCE_MAP_MAX_BYTES)
    .refine((value) => new TextEncoder().encode(value).byteLength <= SOURCE_MAP_MAX_BYTES, 'Source Map 超出 20MB 大小限制'),
});

export type TrackEventInputZod = z.infer<typeof trackEventInputSchema>;

export type UpdateErrorGroupInput = z.infer<typeof updateErrorGroupSchema>;

export type CreateErrorAlertRuleInput = z.infer<typeof createErrorAlertRuleSchema>;

export type UpdateErrorAlertRuleInput = z.infer<typeof updateErrorAlertRuleSchema>;

export type CreateAnalyticsEventMetaInput = z.infer<typeof createAnalyticsEventMetaSchema>;

export type UpdateAnalyticsEventMetaInput = z.infer<typeof updateAnalyticsEventMetaSchema>;

export type CreateAnalyticsEventOverrideInput = z.infer<typeof createAnalyticsEventOverrideSchema>;

export type UpdateAnalyticsEventOverrideInput = z.infer<typeof updateAnalyticsEventOverrideSchema>;

export type CreateAnalyticsSiteInput = z.infer<typeof createAnalyticsSiteSchema>;

export type UpdateAnalyticsSiteInput = z.infer<typeof updateAnalyticsSiteSchema>;

export type CreateAnalyticsExperimentInput = z.infer<typeof createAnalyticsExperimentSchema>;

export type UpdateAnalyticsExperimentInput = z.infer<typeof updateAnalyticsExperimentSchema>;

export type AnalyticsSegmentConditionInput = z.infer<typeof analyticsSegmentConditionSchema>;

export type AnalyticsSegmentRuleInput = z.infer<typeof analyticsSegmentRuleSchema>;

export type CreateAnalyticsUserSegmentInput = z.infer<typeof createAnalyticsUserSegmentSchema>;

export type UpdateAnalyticsUserSegmentInput = z.infer<typeof updateAnalyticsUserSegmentSchema>;

export type CreateAnalyticsCampaignInput = z.infer<typeof createAnalyticsCampaignSchema>;

export type UpdateAnalyticsCampaignInput = z.infer<typeof updateAnalyticsCampaignSchema>;

export type UpdateAnalyticsSettingsInput = z.infer<typeof updateAnalyticsSettingsSchema>;

export type FunnelQueryInput = z.infer<typeof funnelQuerySchema>;

export type RetentionQueryInput = z.infer<typeof retentionQuerySchema>;

export type AnalyticsEventQueryValidatedInput = z.infer<typeof analyticsEventQuerySchema>;

export type SourceMapUploadInput = z.infer<typeof sourceMapUploadSchema>;
