import { http } from 'msw';
import { ok, notFound, paginate, nextIdFrom } from '@/mocks/utils/handlers';
import { mockDateTime, mockDateTimeOffset } from '../utils/date';

/** N 分钟前的时间字符串 */
const minsAgo = (m: number) => mockDateTimeOffset(-m * 60 * 1000);

interface MockRule {
  id: number; name: string; metric: string; operator: string; threshold: number;
  durationMinutes: number; level: string; channels: string[]; webhookUrl: string | null;
  recipientUserIds: number[]; recipientEmails: string[]; silenceMinutes: number; enabled: boolean; state: string;
  lastTriggeredAt: string | null; lastValue: number | null; createdAt: string; updatedAt: string;
}

const rules: MockRule[] = [
  {
    id: 1, name: 'CPU 使用率过高', metric: 'cpu', operator: 'gt', threshold: 85, durationMinutes: 5,
    level: 'warning', channels: ['inapp', 'email'], webhookUrl: null, recipientUserIds: [1], recipientEmails: ['ops@example.com'],
    silenceMinutes: 30, enabled: true, state: 'ok', lastTriggeredAt: minsAgo(120), lastValue: 23,
    createdAt: minsAgo(7 * 24 * 60), updatedAt: minsAgo(60),
  },
  {
    id: 2, name: '磁盘空间不足', metric: 'disk', operator: 'gte', threshold: 90, durationMinutes: 0,
    level: 'critical', channels: ['inapp', 'webhook'], webhookUrl: 'https://example.com/alert', recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 60, enabled: true, state: 'firing', lastTriggeredAt: minsAgo(15), lastValue: 92,
    createdAt: minsAgo(10 * 24 * 60), updatedAt: minsAgo(15),
  },
  {
    id: 3, name: '内存使用率告警', metric: 'memory', operator: 'gt', threshold: 80, durationMinutes: 3,
    level: 'warning', channels: ['inapp'], webhookUrl: null, recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 30, enabled: false, state: 'ok', lastTriggeredAt: null, lastValue: 41,
    createdAt: minsAgo(3 * 24 * 60), updatedAt: minsAgo(3 * 24 * 60),
  },
  {
    id: 4, name: '支付失败率飙升', metric: 'paymentFailureRate', operator: 'gte', threshold: 20, durationMinutes: 5,
    level: 'critical', channels: ['inapp', 'email'], webhookUrl: null, recipientUserIds: [1], recipientEmails: ['pay-oncall@example.com'],
    silenceMinutes: 30, enabled: true, state: 'firing', lastTriggeredAt: minsAgo(8), lastValue: 31.4,
    createdAt: minsAgo(20 * 24 * 60), updatedAt: minsAgo(8),
  },
  {
    id: 5, name: '对账差异待处理', metric: 'paymentReconDiff', operator: 'gte', threshold: 1, durationMinutes: 0,
    level: 'warning', channels: ['inapp'], webhookUrl: null, recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 720, enabled: true, state: 'firing', lastTriggeredAt: minsAgo(200), lastValue: 3,
    createdAt: minsAgo(20 * 24 * 60), updatedAt: minsAgo(200),
  },
  {
    id: 6, name: '支付事件派发积压', metric: 'paymentEventBacklog', operator: 'gte', threshold: 20, durationMinutes: 0,
    level: 'critical', channels: ['inapp', 'webhook'], webhookUrl: 'https://example.com/alert', recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 60, enabled: true, state: 'ok', lastTriggeredAt: null, lastValue: 2,
    createdAt: minsAgo(20 * 24 * 60), updatedAt: minsAgo(45),
  },
  {
    id: 7, name: '单应用错误率异常', metric: 'openApiAppErrorRate', operator: 'gte', threshold: 50, durationMinutes: 10,
    level: 'warning', channels: ['inapp'], webhookUrl: null, recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 60, enabled: true, state: 'ok', lastTriggeredAt: minsAgo(1440), lastValue: 12.5,
    createdAt: minsAgo(15 * 24 * 60), updatedAt: minsAgo(30),
  },
  {
    id: 8, name: '流程作业出现死信', metric: 'workflowDeadLetter', operator: 'gte', threshold: 1, durationMinutes: 0,
    level: 'warning', channels: ['inapp'], webhookUrl: null, recipientUserIds: [1], recipientEmails: [],
    silenceMinutes: 120, enabled: true, state: 'ok', lastTriggeredAt: null, lastValue: 0,
    createdAt: minsAgo(12 * 24 * 60), updatedAt: minsAgo(90),
  },
];

const events = [
  { id: 5, ruleId: 4, ruleName: '支付失败率飙升', metric: 'paymentFailureRate', level: 'critical', operator: 'gte', threshold: 20, value: 31.4, status: 'firing', message: '支付失败率 当前 31.4%，已满足条件 ≥ 20%（持续 5 分钟）', triggeredAt: minsAgo(8), resolvedAt: null },
  { id: 4, ruleId: 5, ruleName: '对账差异待处理', metric: 'paymentReconDiff', level: 'warning', operator: 'gte', threshold: 1, value: 3, status: 'firing', message: '对账差异待处理 当前 3 项，已满足条件 ≥ 1 项', triggeredAt: minsAgo(200), resolvedAt: null },
  { id: 3, ruleId: 2, ruleName: '磁盘空间不足', metric: 'disk', level: 'critical', operator: 'gte', threshold: 90, value: 92, status: 'firing', message: '磁盘使用率 当前 92%，已满足条件 ≥ 90%', triggeredAt: minsAgo(15), resolvedAt: null },
  { id: 2, ruleId: 1, ruleName: 'CPU 使用率过高', metric: 'cpu', level: 'warning', operator: 'gt', threshold: 85, value: 88, status: 'resolved', message: 'CPU 使用率 当前 88%，已满足条件 > 85%（持续 5 分钟）', triggeredAt: minsAgo(120), resolvedAt: minsAgo(110) },
  { id: 1, ruleId: 7, ruleName: '单应用错误率异常', metric: 'openApiAppErrorRate', level: 'warning', operator: 'gte', threshold: 50, value: 63.2, status: 'resolved', message: '单应用最高错误率 当前 63.2%，已满足条件 ≥ 50%（持续 10 分钟）', triggeredAt: minsAgo(1440), resolvedAt: minsAgo(1400) },
];

export const monitorAlertsHandlers = [
  http.get('/api/monitor-alerts/events', ({ request }) => {
    const url = new URL(request.url);
    const sp = url.searchParams;
    let filtered = [...events];
    const metric = sp.get('metric'); const level = sp.get('level'); const status = sp.get('status');
    if (metric) filtered = filtered.filter((e) => e.metric === metric);
    if (level) filtered = filtered.filter((e) => e.level === level);
    if (status) filtered = filtered.filter((e) => e.status === status);
    return ok(paginate(filtered, url, 20), 'success');
  }),

  http.get('/api/monitor-alerts', ({ request }) =>
    ok(paginate(rules, new URL(request.url), 20), 'success')),

  http.post('/api/monitor-alerts', async ({ request }) => {
    const body = await request.json() as Partial<MockRule>;
    const now = mockDateTime();
    const rule: MockRule = {
      id: nextIdFrom(rules), name: body.name ?? '新规则', metric: body.metric ?? 'cpu', operator: body.operator ?? 'gt',
      threshold: body.threshold ?? 80, durationMinutes: body.durationMinutes ?? 0, level: body.level ?? 'warning',
      channels: body.channels ?? [], webhookUrl: body.webhookUrl ?? null,
      recipientUserIds: body.recipientUserIds ?? [], recipientEmails: body.recipientEmails ?? [],
      silenceMinutes: body.silenceMinutes ?? 30, enabled: body.enabled ?? true, state: 'ok',
      lastTriggeredAt: null, lastValue: null, createdAt: now, updatedAt: now,
    };
    rules.unshift(rule);
    return ok(rule, '创建成功');
  }),

  http.put('/api/monitor-alerts/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const rule = rules.find((r) => r.id === id);
    if (!rule) return notFound('告警规则不存在', { status: 404 });
    const body = await request.json() as Partial<MockRule>;
    Object.assign(rule, body, { updatedAt: mockDateTime() });
    if (body.enabled === false) {
      rule.state = 'ok';
      for (const event of events.filter((item) => item.ruleId === id && item.status === 'firing')) {
        event.status = 'resolved';
        event.resolvedAt = mockDateTime();
      }
    }
    return ok(rule, '更新成功');
  }),

  http.patch('/api/monitor-alerts/:id/enabled', async ({ params, request }) => {
    const id = Number(params.id);
    const rule = rules.find((r) => r.id === id);
    if (!rule) return notFound('告警规则不存在', { status: 404 });
    const body = await request.json() as { enabled: boolean };
    rule.enabled = body.enabled;
    if (!body.enabled) {
      rule.state = 'ok';
      for (const event of events.filter((item) => item.ruleId === id && item.status === 'firing')) {
        event.status = 'resolved';
        event.resolvedAt = mockDateTime();
      }
    }
    rule.updatedAt = mockDateTime();
    return ok(rule, '操作成功');
  }),

  http.delete('/api/monitor-alerts/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx >= 0) rules.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
