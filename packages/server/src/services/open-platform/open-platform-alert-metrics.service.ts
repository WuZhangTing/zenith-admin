/**
 * 开放平台域告警指标源：供监控告警评估器（monitor-alert）实时采集的派生指标。
 *
 * 开放平台调用日志是平台级数据；Webhook 指标只统计外部订阅，排除 CMS 内部订阅，
 * 因此这组指标恒为平台级口径，不随规则所属租户变化——对应 MONITOR_METRIC_META 中的 scope: 'global'。
 *
 * 注：单应用配额耗尽已由 `open-quota-alerts.service.ts` 按 80% / 95% 双阈值实时预警并直达应用负责人，
 * 本文件只补充「平台侧需要有人值守」的聚合健康指标，两者互补而非重复。
 */
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { openApiCallLogs, appWebhookDeliveries, appWebhookSubscriptions } from '../../db/schema';
import { ratePercent } from '../../lib/alert-metrics';

/** 比率型指标的统计窗口 */
const RECENT_WINDOW_MS = 60 * 60_000;

/**
 * 单应用错误率的最小样本量。
 * 不设门槛时，一个只调了 1 次且失败的沙箱应用会把指标顶到 100%，规则将永久处于告警态。
 */
const MIN_APP_SAMPLE_SIZE = 20;

export interface OpenPlatformAlertMetrics {
  /** 近 60 分钟开放 API 整体错误率（%） */
  openApiErrorRate: number;
  /** 近 60 分钟单应用错误率的最大值（%，仅统计达到最小样本量的应用） */
  openApiAppErrorRate: number;
  /** 近 60 分钟应用事件 Webhook 投递失败率（%） */
  openWebhookFailureRate: number;
  /** 因连续投递失败被自动停用的订阅数 */
  openWebhookDisabledSubs: number;
}

/** 近 60 分钟内错误率最高的单个应用（样本量不足的应用不参与，无合格应用时返回 0）。 */
async function getWorstAppErrorRate(recentCutoff: Date): Promise<number> {
  const [row] = await db
    .select({
      errorRate: sql<number>`(count(*) filter (where ${openApiCallLogs.success} = false))::float * 100 / count(*)`,
    })
    .from(openApiCallLogs)
    .where(gte(openApiCallLogs.createdAt, recentCutoff))
    .groupBy(openApiCallLogs.clientId)
    .having(sql`count(*) >= ${MIN_APP_SAMPLE_SIZE}`)
    // 按输出第一列排序，避免 drizzle 在 SELECT 与 ORDER BY 两处对聚合表达式渲染不一致
    .orderBy(sql`1 desc`)
    .limit(1);
  return row ? Math.round(Number(row.errorRate) * 10) / 10 : 0;
}

/** 采集开放平台域告警指标（平台级口径）。 */
export async function getOpenPlatformAlertMetrics(): Promise<OpenPlatformAlertMetrics> {
  const recentCutoff = new Date(Date.now() - RECENT_WINDOW_MS);

  const [apiTotal, apiFailed, worstAppErrorRate, hookSuccess, hookFailed, disabledSubs] = await Promise.all([
    db.$count(openApiCallLogs, gte(openApiCallLogs.createdAt, recentCutoff)),
    db.$count(openApiCallLogs, and(gte(openApiCallLogs.createdAt, recentCutoff), eq(openApiCallLogs.success, false))),
    getWorstAppErrorRate(recentCutoff),
    db.$count(appWebhookDeliveries, and(
      gte(appWebhookDeliveries.createdAt, recentCutoff),
      eq(appWebhookDeliveries.status, 'success'),
      isNotNull(appWebhookDeliveries.clientId),
      sql`exists (select 1 from ${appWebhookSubscriptions} s where s.id = ${appWebhookDeliveries.subscriptionId} and s.internal = false)`,
    )),
    db.$count(appWebhookDeliveries, and(
      gte(appWebhookDeliveries.createdAt, recentCutoff),
      eq(appWebhookDeliveries.status, 'failed'),
      isNotNull(appWebhookDeliveries.clientId),
      sql`exists (select 1 from ${appWebhookSubscriptions} s where s.id = ${appWebhookDeliveries.subscriptionId} and s.internal = false)`,
    )),
    db.$count(appWebhookSubscriptions, and(isNotNull(appWebhookSubscriptions.autoDisabledAt), eq(appWebhookSubscriptions.internal, false))),
  ]);

  return {
    openApiErrorRate: ratePercent(apiFailed, apiTotal),
    openApiAppErrorRate: worstAppErrorRate,
    openWebhookFailureRate: ratePercent(hookFailed, hookSuccess + hookFailed),
    openWebhookDisabledSubs: disabledSubs,
  };
}
