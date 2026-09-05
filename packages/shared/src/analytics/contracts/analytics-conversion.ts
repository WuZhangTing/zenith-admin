import * as z from 'zod';
import { paginated } from '../../core/api-schemas';
import {
  ANALYTICS_ACQUISITION_DIMENSIONS,
  ANALYTICS_ATTRIBUTION_MODELS,
  ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS,
  ANALYTICS_EVENT_QUERY_METRICS,
  ANALYTICS_IDENTITY_TYPES,
  ANALYTICS_RETENTION_MODES,
  ANALYTICS_RETENTION_PERIOD_TYPES,
} from '../constants';
import { analyticsComparisonSchema } from '../validation';

// ─── 序列元信息（漏斗 / 留存共用）────────────────────────────────────────────

/** 序列稳定标识：维度原始值 / `segment:{id}` / `__overall__`；无对比时为单条 `__overall__` 序列 */
const analyticsSeriesMetaShape = {
  key: z.string(),
  label: z.string().meta({ description: '展示名：维度值（空值为「未知」）/ 分群名 / 「全部用户」' }),
};

export const analyticsSeriesMetaSchema = z.object(analyticsSeriesMetaShape).meta({ id: 'AnalyticsSeriesMeta' });

export type AnalyticsSeriesMeta = z.infer<typeof analyticsSeriesMetaSchema>;

// ─── 漏斗 ─────────────────────────────────────────────────────────────────────

export const funnelStepResultSchema = z.object({
  label: z.string(),
  users: z.int(),
  conversionRate: z.number(),
  stepConversionRate: z.number(),
  dropoff: z.int(),
  averageConversionMs: z.number().nullable().meta({ description: '相对上一步的平均转化耗时（毫秒），首步为 null' }),
}).meta({ id: 'FunnelStepResult' });

export type FunnelStepResult = z.infer<typeof funnelStepResultSchema>;

export const funnelSeriesSchema = z.object({
  ...analyticsSeriesMetaShape,
  steps: z.array(funnelStepResultSchema),
  totalUsers: z.int(),
  overallConversionRate: z.number(),
}).meta({ id: 'FunnelSeries' });

export type FunnelSeries = z.infer<typeof funnelSeriesSchema>;

export const funnelResultSchema = z.object({
  series: z.array(funnelSeriesSchema).meta({ description: '始终为数组：无对比时长度为 1' }),
  comparison: analyticsComparisonSchema,
}).meta({ id: 'FunnelResult' });

export type FunnelResult = z.infer<typeof funnelResultSchema>;

// ─── 留存 ─────────────────────────────────────────────────────────────────────

export const retentionCohortSchema = z.object({
  cohortDate: z.string(),
  cohortSize: z.int(),
  values: z.array(z.number().nullable()),
}).meta({ id: 'RetentionCohort' });

export type RetentionCohort = z.infer<typeof retentionCohortSchema>;

export const retentionSeriesSchema = z.object({
  ...analyticsSeriesMetaShape,
  cohorts: z.array(retentionCohortSchema),
  averages: z.array(z.number().nullable()).meta({ description: '全部队列的加权平均留存率' }),
  totalUsers: z.int(),
}).meta({ id: 'RetentionSeries' });

export type RetentionSeries = z.infer<typeof retentionSeriesSchema>;

export const retentionResultSchema = z.object({
  series: z.array(retentionSeriesSchema),
  periods: z.array(z.int()),
  mode: z.enum(ANALYTICS_RETENTION_MODES),
  periodType: z.enum(ANALYTICS_RETENTION_PERIOD_TYPES),
  days: z.int().meta({ description: '实际回溯天数（服务端按粒度收敛后的值）' }),
  comparison: analyticsComparisonSchema,
}).meta({ id: 'RetentionResult' });

export type RetentionResult = z.infer<typeof retentionResultSchema>;

// ─── 获客与归因 ───────────────────────────────────────────────────────────────

export const analyticsAcquisitionRowSchema = z.object({
  key: z.string().meta({ description: '维度原始值（空值归一为空串）' }),
  label: z.string(),
  users: z.int(),
  newUsers: z.int(),
  sessions: z.int(),
  conversions: z.int().meta({ description: '完成转化事件的用户数（未指定转化事件时为 0）' }),
  conversionRate: z.number().meta({ description: 'conversions / users，百分比' }),
}).meta({ id: 'AnalyticsAcquisitionRow' });

export type AnalyticsAcquisitionRow = z.infer<typeof analyticsAcquisitionRowSchema>;

export const analyticsAcquisitionResultSchema = z.object({
  rows: z.array(analyticsAcquisitionRowSchema),
  dimension: z.enum(ANALYTICS_ACQUISITION_DIMENSIONS),
  model: z.enum(ANALYTICS_ATTRIBUTION_MODELS),
  conversionEvent: z.string().nullable(),
  totalUsers: z.int(),
  totalConversions: z.int(),
  startDate: z.string(),
  endDate: z.string(),
}).meta({ id: 'AnalyticsAcquisitionResult' });

export type AnalyticsAcquisitionResult = z.infer<typeof analyticsAcquisitionResultSchema>;

// ─── 图表下钻用户 ─────────────────────────────────────────────────────────────

export const analyticsDrillUserSchema = z.object({
  distinctId: z.string(),
  identityType: z.enum(ANALYTICS_IDENTITY_TYPES),
  userId: z.int().nullable(),
  memberId: z.int().nullable(),
  displayName: z.string().nullable(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
}).meta({ id: 'AnalyticsDrillUser' });

export type AnalyticsDrillUser = z.infer<typeof analyticsDrillUserSchema>;

export const analyticsDrillUsersResultSchema = paginated(analyticsDrillUserSchema).extend({
  matchedUsers: z.int().meta({ description: '命中的用户总数，可能大于可翻页范围' }),
}).meta({ id: 'AnalyticsDrillUsersResult' });

export type AnalyticsDrillUsersResult = z.infer<typeof analyticsDrillUsersResultSchema>;

// ─── 通用事件分析工作台 ───────────────────────────────────────────────────────

export const analyticsEventQueryRowSchema = z.object({
  dimensions: z.record(z.string(), z.string()),
  value: z.number(),
}).meta({ id: 'AnalyticsEventQueryRow' });

export type AnalyticsEventQueryRow = z.infer<typeof analyticsEventQueryRowSchema>;

export const analyticsEventQueryResultSchema = paginated(analyticsEventQueryRowSchema).extend({
  queryMeta: z.object({
    metric: z.enum(ANALYTICS_EVENT_QUERY_METRICS),
    metricProperty: z.string().nullable(),
    groupBy: z.array(z.enum(ANALYTICS_EVENT_QUERY_GROUP_BY_FIELDS)),
    startDate: z.string(),
    endDate: z.string(),
  }),
}).meta({ id: 'AnalyticsEventQueryResult' });

export type AnalyticsEventQueryResult = z.infer<typeof analyticsEventQueryResultSchema>;

// ─── 保存的分析报表 ───────────────────────────────────────────────────────────

export const analyticsSavedReportSchema = z.object({
  id: z.int(),
  name: z.string(),
  reportType: z.string(),
  config: z.record(z.string(), z.unknown()),
  createdBy: z.int().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
}).meta({ id: 'AnalyticsSavedReport' });

export type AnalyticsSavedReport = z.infer<typeof analyticsSavedReportSchema>;

export const analyticsSavedReportListSchema = z.object({
  list: z.array(analyticsSavedReportSchema),
}).meta({ id: 'AnalyticsSavedReportList' });

export type AnalyticsSavedReportList = z.infer<typeof analyticsSavedReportListSchema>;
