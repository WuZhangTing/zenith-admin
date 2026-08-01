import { http } from 'msw';
import { ok, notFound } from '@/mocks/utils/handlers';
import { mockDateTime, mockDateTimeOffset } from '../utils/date';

/** N 分钟前的时间字符串 */
const minsAgo = (m: number) => mockDateTimeOffset(-m * 60 * 1000);

interface MockRule {
  id: number; name: string; metric: string; operator: string; threshold: number;
  durationMinutes: number; level: string; channels: string[]; webhookUrl: string | null;
  recipients: string[]; silenceMinutes: number; enabled: boolean; state: string;
  lastTriggeredAt: string | null; lastValue: number | null; createdAt: string; updatedAt: string;
}

let ruleSeq = 3;
const rules: MockRule[] = [
  {
    id: 1, name: 'CPU 使用率过高', metric: 'cpu', operator: 'gt', threshold: 85, durationMinutes: 5,
    level: 'warning', channels: ['inapp', 'email'], webhookUrl: null, recipients: ['ops@example.com'],
    silenceMinutes: 30, enabled: true, state: 'ok', lastTriggeredAt: minsAgo(120), lastValue: 23,
    createdAt: minsAgo(7 * 24 * 60), updatedAt: minsAgo(60),
  },
  {
    id: 2, name: '磁盘空间不足', metric: 'disk', operator: 'gte', threshold: 90, durationMinutes: 0,
    level: 'critical', channels: ['inapp', 'webhook'], webhookUrl: 'https://example.com/alert', recipients: [],
    silenceMinutes: 60, enabled: true, state: 'firing', lastTriggeredAt: minsAgo(15), lastValue: 92,
    createdAt: minsAgo(10 * 24 * 60), updatedAt: minsAgo(15),
  },
  {
    id: 3, name: '内存使用率告警', metric: 'memory', operator: 'gt', threshold: 80, durationMinutes: 3,
    level: 'warning', channels: ['inapp'], webhookUrl: null, recipients: [],
    silenceMinutes: 30, enabled: false, state: 'ok', lastTriggeredAt: null, lastValue: 41,
    createdAt: minsAgo(3 * 24 * 60), updatedAt: minsAgo(3 * 24 * 60),
  },
];

const events = [
  { id: 1, ruleId: 2, ruleName: '磁盘空间不足', metric: 'disk', level: 'critical', operator: 'gte', threshold: 90, value: 92, status: 'firing', message: '磁盘使用率 当前 92%，已满足条件 ≥ 90%', triggeredAt: minsAgo(15), resolvedAt: null },
  { id: 2, ruleId: 1, ruleName: 'CPU 使用率过高', metric: 'cpu', level: 'warning', operator: 'gt', threshold: 85, value: 88, status: 'resolved', message: 'CPU 使用率 当前 88%，已满足条件 > 85%（持续 5 分钟）', triggeredAt: minsAgo(120), resolvedAt: minsAgo(110) },
  { id: 3, ruleId: 1, ruleName: 'CPU 使用率过高', metric: 'cpu', level: 'warning', operator: 'gt', threshold: 85, value: 91, status: 'resolved', message: 'CPU 使用率 当前 91%，已满足条件 > 85%（持续 5 分钟）', triggeredAt: minsAgo(360), resolvedAt: minsAgo(355) },
];

function paginate<T>(list: T[], url: string) {
  const sp = new URL(url).searchParams;
  const page = Number(sp.get('page') ?? 1);
  const pageSize = Number(sp.get('pageSize') ?? 20);
  const start = (page - 1) * pageSize;
  return { list: list.slice(start, start + pageSize), total: list.length, page, pageSize };
}

export const monitorAlertsHandlers = [
  http.get('/api/monitor-alerts/events', ({ request }) => {
    const sp = new URL(request.url).searchParams;
    let filtered = [...events];
    const metric = sp.get('metric'); const level = sp.get('level'); const status = sp.get('status');
    if (metric) filtered = filtered.filter((e) => e.metric === metric);
    if (level) filtered = filtered.filter((e) => e.level === level);
    if (status) filtered = filtered.filter((e) => e.status === status);
    return ok(paginate(filtered, request.url), 'success');
  }),

  http.get('/api/monitor-alerts', ({ request }) =>
    ok(paginate(rules, request.url), 'success')),

  http.post('/api/monitor-alerts', async ({ request }) => {
    const body = await request.json() as Partial<MockRule>;
    ruleSeq += 1;
    const now = mockDateTime();
    const rule: MockRule = {
      id: ruleSeq, name: body.name ?? '新规则', metric: body.metric ?? 'cpu', operator: body.operator ?? 'gt',
      threshold: body.threshold ?? 80, durationMinutes: body.durationMinutes ?? 0, level: body.level ?? 'warning',
      channels: body.channels ?? [], webhookUrl: body.webhookUrl ?? null, recipients: body.recipients ?? [],
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
    return ok(rule, '更新成功');
  }),

  http.patch('/api/monitor-alerts/:id/enabled', async ({ params, request }) => {
    const id = Number(params.id);
    const rule = rules.find((r) => r.id === id);
    if (!rule) return notFound('告警规则不存在', { status: 404 });
    const body = await request.json() as { enabled: boolean };
    rule.enabled = body.enabled;
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
