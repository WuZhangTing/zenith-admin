/**
 * 系统监控告警：规则 CRUD + 阈值评估器 + 多通道派发。
 * 评估器由 pg-boss 定时任务（默认每 30 秒）调用，针对指标即时值判定阈值，
 * 支持「持续 N 分钟超阈才触发」抑制毛刺，并在指标恢复后自动解除告警。
 *
 * 指标全集与标签/单位/租户口径由 `@zenith/shared/platform` 的 MONITOR_METRIC_META 单点定义，
 * 取值由 `monitor-history.service` 汇总各域的告警指标源；新增指标不需要改动本文件。
 */
import { and, eq, desc } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { monitorAlertRules, monitorAlertEvents } from '../../db/schema';
import type { MonitorAlertRuleRow, MonitorAlertEventRow } from '../../db/schema';
import type { CreateMonitorAlertRuleInput, UpdateMonitorAlertRuleInput, MonitorAlertEventQuery, MonitorMetric, MonitorAlertOperator } from '@zenith/shared/platform';
import { MONITOR_METRIC_META, formatMonitorMetricValue } from '@zenith/shared/platform';
import { tenantScope, currentCreateTenantId } from '../../lib/tenant';
import { mergeWhere } from '../../lib/where-helpers';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { getMetricSnapshotsByTenant } from './monitor-history.service';
import { validateAlertDelivery } from '../../lib/alert-validation';
import { dispatchAlertChannels } from '../../lib/alert-dispatch';
import type { DbExecutor } from '../../db/types';

const OPERATOR_SYMBOL: Record<MonitorAlertOperator, string> = { gt: '>', gte: '≥', lt: '<', lte: '≤' };

function metricLabel(metric: MonitorMetric): string {
  return MONITOR_METRIC_META[metric]?.label ?? metric;
}

function compare(value: number, op: MonitorAlertOperator, threshold: number): boolean {
  switch (op) {
    case 'gt': return value > threshold;
    case 'gte': return value >= threshold;
    case 'lt': return value < threshold;
    case 'lte': return value <= threshold;
    default: return false;
  }
}

async function resolveActiveRuleEvents(executor: DbExecutor, ruleId: number, resolvedAt: Date): Promise<void> {
  await executor
    .update(monitorAlertEvents)
    .set({ status: 'resolved', resolvedAt })
    .where(and(eq(monitorAlertEvents.ruleId, ruleId), eq(monitorAlertEvents.status, 'firing')));
}

// ─── 映射 ────────────────────────────────────────────────────────────────
export function mapRule(row: MonitorAlertRuleRow) {
  return {
    id: row.id,
    name: row.name,
    metric: row.metric,
    operator: row.operator,
    threshold: row.threshold,
    durationMinutes: row.durationMinutes,
    level: row.level,
    channels: row.channels ?? [],
    webhookUrl: row.webhookUrl,
    recipients: row.recipients ?? [],
    silenceMinutes: row.silenceMinutes,
    enabled: row.enabled,
    state: row.state,
    lastTriggeredAt: formatNullableDateTime(row.lastTriggeredAt),
    lastValue: row.lastValue,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export function mapEvent(row: MonitorAlertEventRow) {
  return {
    id: row.id,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    metric: row.metric,
    level: row.level,
    operator: row.operator,
    threshold: row.threshold,
    value: row.value,
    status: row.status,
    message: row.message,
    triggeredAt: formatDateTime(row.triggeredAt),
    resolvedAt: formatNullableDateTime(row.resolvedAt),
  };
}

// ─── 规则 CRUD ───────────────────────────────────────────────────────────
export interface AlertRuleListQuery { page?: number; pageSize?: number }
export async function listRules(q: AlertRuleListQuery) {
  const page = Math.max(Number(q.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
  const where = tenantScope(monitorAlertRules);
  const [list, total] = await Promise.all([
    db.select().from(monitorAlertRules).where(where).orderBy(desc(monitorAlertRules.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
    db.$count(monitorAlertRules, where),
  ]);
  return { list: list.map(mapRule), total, page, pageSize };
}

export async function ensureRuleExists(id: number) {
  const [row] = await db.select().from(monitorAlertRules).where(mergeWhere(eq(monitorAlertRules.id, id), tenantScope(monitorAlertRules))).limit(1);
  if (!row) throw new HTTPException(404, { message: '告警规则不存在' });
  return row;
}

export async function getMonitorAlertRuleBeforeAudit(id: number) {
  return mapRule(await ensureRuleExists(id));
}

export async function createRule(input: CreateMonitorAlertRuleInput) {
  validateAlertDelivery({
    enabled: input.enabled ?? true,
    channels: input.channels ?? [],
    webhookUrl: input.webhookUrl ?? null,
    recipients: input.recipients ?? [],
  });
  const [row] = await db
    .insert(monitorAlertRules)
    .values({
      tenantId: currentCreateTenantId(),
      name: input.name,
      metric: input.metric,
      operator: input.operator ?? 'gt',
      threshold: input.threshold,
      durationMinutes: input.durationMinutes ?? 0,
      level: input.level ?? 'warning',
      channels: input.channels ?? [],
      webhookUrl: input.webhookUrl ?? null,
      recipients: input.recipients ?? [],
      silenceMinutes: input.silenceMinutes ?? 30,
      enabled: input.enabled ?? true,
    })
    .returning();
  return mapRule(row);
}

export async function updateRule(id: number, input: UpdateMonitorAlertRuleInput) {
  const current = await ensureRuleExists(id);
  validateAlertDelivery({
    enabled: input.enabled ?? current.enabled,
    channels: input.channels ?? current.channels ?? [],
    webhookUrl: input.webhookUrl === undefined ? current.webhookUrl : input.webhookUrl,
    recipients: input.recipients ?? current.recipients ?? [],
  });
  const resetLifecycle = input.enabled === false || (input.enabled === true && !current.enabled);
  const updateData: Partial<typeof monitorAlertRules.$inferInsert> = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.metric !== undefined ? { metric: input.metric } : {}),
    ...(input.operator !== undefined ? { operator: input.operator } : {}),
    ...(input.threshold !== undefined ? { threshold: input.threshold } : {}),
    ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    ...(input.channels !== undefined ? { channels: input.channels } : {}),
    ...(input.webhookUrl !== undefined ? { webhookUrl: input.webhookUrl } : {}),
    ...(input.recipients !== undefined ? { recipients: input.recipients } : {}),
    ...(input.silenceMinutes !== undefined ? { silenceMinutes: input.silenceMinutes } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(resetLifecycle ? { state: 'ok', breachingSince: null } : {}),
  };
  const update = async (executor: DbExecutor) => {
    const [row] = await executor
      .update(monitorAlertRules)
      .set(updateData)
      .where(eq(monitorAlertRules.id, id))
      .returning();
    return row;
  };

  if (!resetLifecycle) return mapRule(await update(db));

  return db.transaction(async (tx) => {
    const row = await update(tx);
    await resolveActiveRuleEvents(tx, id, new Date());
    return mapRule(row);
  });
}

export async function deleteRule(id: number) {
  await ensureRuleExists(id);
  await db.delete(monitorAlertRules).where(eq(monitorAlertRules.id, id));
}

export async function setRuleEnabled(id: number, enabled: boolean) {
  const current = await ensureRuleExists(id);
  validateAlertDelivery({
    enabled,
    channels: current.channels ?? [],
    webhookUrl: current.webhookUrl,
    recipients: current.recipients ?? [],
  });
  if (enabled && current.enabled) return mapRule(current);

  return db.transaction(async (tx) => {
    const resolvedAt = new Date();
    const [row] = await tx
      .update(monitorAlertRules)
      .set({ enabled, state: 'ok', breachingSince: null })
      .where(eq(monitorAlertRules.id, id))
      .returning();
    await resolveActiveRuleEvents(tx, id, resolvedAt);
    return mapRule(row);
  });
}

// ─── 告警记录列表 ─────────────────────────────────────────────────────────
export async function listEvents(q: MonitorAlertEventQuery) {
  const page = Math.max(Number(q.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(q.pageSize) || 20, 1), 100);
  const conds = [tenantScope(monitorAlertEvents)];
  if (q.metric) conds.push(eq(monitorAlertEvents.metric, q.metric));
  if (q.level) conds.push(eq(monitorAlertEvents.level, q.level));
  if (q.status) conds.push(eq(monitorAlertEvents.status, q.status));
  if (q.ruleId) conds.push(eq(monitorAlertEvents.ruleId, q.ruleId));
  const where = and(...conds.filter(Boolean));
  const [list, total] = await Promise.all([
    db.select().from(monitorAlertEvents).where(where).orderBy(desc(monitorAlertEvents.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
    db.$count(monitorAlertEvents, where),
  ]);
  return { list: list.map(mapEvent), total, page, pageSize };
}

// ─── 派发 ────────────────────────────────────────────────────────────────
async function dispatchAlert(rule: MonitorAlertRuleRow, message: string, recovered: boolean, triggeredAt: number): Promise<void> {
  const tag = recovered ? '已恢复' : '告警';
  await dispatchAlertChannels(
    {
      channels: rule.channels ?? [],
      webhookUrl: rule.webhookUrl,
      recipients: rule.recipients ?? [],
      tenantId: rule.tenantId,
    },
    {
      subject: `[监控${tag}] ${rule.name}`,
      html: `<h3>系统监控${tag}</h3><p><b>规则：</b>${rule.name}</p><p><b>详情：</b>${message}</p><p>请前往后台「监控告警 / 告警记录」查看处理。</p>`,
      title: `[监控${tag}] ${rule.name}`,
      content: message,
      inAppType: recovered ? 'success' : rule.level === 'critical' ? 'error' : rule.level === 'info' ? 'info' : 'warning',
      dedupeKey: `monitor-alert:${rule.id}:${recovered ? 'resolved' : 'firing'}:${triggeredAt}`,
      webhookBody: {
        type: recovered ? 'monitor_recovered' : 'monitor_alert',
        rule: rule.name,
        metric: rule.metric,
        level: rule.level,
        message,
        timestamp: formatDateTime(new Date(triggeredAt)),
      },
      logTag: 'MonitorAlert',
    },
  );
}

// ─── 评估器（cron）─────────────────────────────────────────────────────────
export async function evaluateMonitorAlerts(): Promise<{ evaluated: number; fired: number; resolved: number }> {
  const rules = await db.select().from(monitorAlertRules).where(eq(monitorAlertRules.enabled, true));
  if (rules.length === 0) return { evaluated: 0, fired: 0, resolved: 0 };

  // 按规则所属租户取快照：业务指标按租户过滤，宿主机 / 平台级指标共享同一次取数
  const snapshots = await getMetricSnapshotsByTenant(rules.map((rule) => rule.tenantId));
  const now = Date.now();
  let evaluated = 0;
  let fired = 0;
  let resolved = 0;

  for (const rule of rules) {
    const snapshot = snapshots.get(rule.tenantId);
    // 该租户本轮取数失败：跳过而不是按 0 处理，避免把采集故障误判成「指标已恢复」
    if (!snapshot) continue;
    evaluated += 1;

    const metric = rule.metric as MonitorMetric;
    const value = snapshot[metric] ?? 0;
    const breaching = compare(value, rule.operator as MonitorAlertOperator, rule.threshold);
    const label = metricLabel(metric);
    const sym = OPERATOR_SYMBOL[rule.operator as MonitorAlertOperator];

    if (breaching) {
      const breachingSince = rule.breachingSince ?? new Date(now);
      const sustainedMs = now - breachingSince.getTime();
      const durationOk = rule.durationMinutes <= 0 || sustainedMs >= rule.durationMinutes * 60_000;

      if (rule.state !== 'firing' && durationOk) {
        // 触发新告警
        const message = `${label} 当前 ${formatMonitorMetricValue(metric, value)}，已满足条件 ${sym} ${formatMonitorMetricValue(metric, rule.threshold)}`
          + (rule.durationMinutes > 0 ? `（持续 ${rule.durationMinutes} 分钟）` : '');
        await db.insert(monitorAlertEvents).values({
          tenantId: rule.tenantId,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          level: rule.level,
          operator: rule.operator,
          threshold: rule.threshold,
          value,
          status: 'firing',
          message,
          notified: (rule.channels ?? []).length > 0,
        });
        await db.update(monitorAlertRules)
          .set({ state: 'firing', breachingSince, lastTriggeredAt: new Date(now), lastValue: value })
          .where(eq(monitorAlertRules.id, rule.id));
        await dispatchAlert(rule, message, false, now);
        fired += 1;
      } else if (rule.state === 'firing') {
        // 已在告警中：静默期后重复通知
        const silenceMs = rule.silenceMinutes * 60_000;
        const shouldRenotify = rule.silenceMinutes > 0 && rule.lastTriggeredAt && now - rule.lastTriggeredAt.getTime() >= silenceMs;
        if (shouldRenotify) {
          const message = `${label} 持续告警，当前 ${formatMonitorMetricValue(metric, value)}（阈值 ${sym} ${formatMonitorMetricValue(metric, rule.threshold)}）`;
          await db.update(monitorAlertRules).set({ lastTriggeredAt: new Date(now), lastValue: value }).where(eq(monitorAlertRules.id, rule.id));
          await dispatchAlert(rule, message, false, now);
        } else {
          await db.update(monitorAlertRules).set({ lastValue: value }).where(eq(monitorAlertRules.id, rule.id));
        }
      } else {
        // 处于观察期（未达 duration）：仅记录起始时间与当前值
        await db.update(monitorAlertRules).set({ breachingSince, lastValue: value }).where(eq(monitorAlertRules.id, rule.id));
      }
    } else {
      // 未超阈
      if (rule.state === 'firing') {
        const message = `${label} 已恢复，当前 ${formatMonitorMetricValue(metric, value)}`;
        // 关闭该规则所有未恢复事件
        await db.update(monitorAlertEvents)
          .set({ status: 'resolved', resolvedAt: new Date(now) })
          .where(and(eq(monitorAlertEvents.ruleId, rule.id), eq(monitorAlertEvents.status, 'firing')));
        await db.update(monitorAlertRules)
          .set({ state: 'ok', breachingSince: null, lastValue: value })
          .where(eq(monitorAlertRules.id, rule.id));
        await dispatchAlert(rule, message, true, now);
        resolved += 1;
      } else if (rule.breachingSince !== null) {
        await db.update(monitorAlertRules).set({ breachingSince: null, lastValue: value }).where(eq(monitorAlertRules.id, rule.id));
      } else {
        await db.update(monitorAlertRules).set({ lastValue: value }).where(eq(monitorAlertRules.id, rule.id));
      }
    }
  }

  return { evaluated, fired, resolved };
}
