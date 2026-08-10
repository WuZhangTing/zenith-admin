import { http } from 'msw';
import { ok, pageParams } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockLoginLogs } from '@/mocks/data/logs';

/** 从登录日志派生统计数据，避免硬编码与列表数据脱节 */
function buildLoginLogStats(days: number) {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const toTime = (s: string) => new Date(s.replace(' ', 'T')).getTime();
  const logs = mockLoginLogs.filter((l) => (l.eventType ?? 'login') === 'login' && toTime(l.createdAt) >= cutoff);

  const successCount = logs.filter((l) => l.status === 'success').length;
  const failCount = logs.length - successCount;
  const uniqueUsers = new Set(logs.map((l) => l.username)).size;

  const countBy = <T,>(arr: T[], keyFn: (x: T) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const x of arr) {
      const k = keyFn(x);
      if (k == null) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };

  const dailyMap = new Map<string, { date: string; count: number; successCount: number; failCount: number }>();
  for (const l of logs) {
    const date = l.createdAt.slice(0, 10);
    const d = dailyMap.get(date) ?? { date, count: 0, successCount: 0, failCount: 0 };
    d.count++;
    if (l.status === 'success') d.successCount++;
    else d.failCount++;
    dailyMap.set(date, d);
  }
  const dailyStats = [...dailyMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  const hourMap = new Map<number, number>();
  for (const l of logs) {
    const hour = Number(l.createdAt.slice(11, 13)) || 0;
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }
  const hourlyStats = [...hourMap.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour);

  return {
    summary: { total: logs.length, successCount, failCount, uniqueUsers },
    dailyStats,
    userStats: countBy(logs, (l) => l.username).slice(0, 10).map((x) => ({ username: x.key, count: x.count })),
    ipStats: countBy(logs, (l) => l.ip).slice(0, 10).map((x) => ({ ip: x.key, count: x.count })),
    ipFailStats: countBy(logs.filter((l) => l.status === 'fail'), (l) => l.ip).slice(0, 10).map((x) => ({ ip: x.key, count: x.count })),
    browserStats: countBy(logs, (l) => l.browser).map((x) => ({ browser: x.key, count: x.count })),
    osStats: countBy(logs, (l) => l.os).map((x) => ({ os: x.key, count: x.count })),
    hourlyStats,
  };
}

export const loginLogsHandlers = [
  http.get('/api/login-logs', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const username = url.searchParams.get('username') ?? '';
    const eventType = url.searchParams.get('eventType') ?? '';
    const status = url.searchParams.get('status') ?? '';

    let list = mockLoginLogs.filter((log) => {
      if (username && !log.username.includes(username)) return false;
      if (eventType && log.eventType !== eventType) return false;
      if (status && log.status !== status) return false;
      return true;
    });
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  // 登录日志统计（页面加载时自动拉取，缺失会导致 401 → 跳转登录页）
  http.get('/api/login-logs/stats', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 30;
    return ok(buildLoginLogStats(days));
  }),

  http.delete('/api/login-logs/clean', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 180;
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const deleted = removeWhere(
      mockLoginLogs,
      (log) => new Date(log.createdAt) < cutoff,
    );
    return ok(null, `共删除 ${deleted} 条登录日志`);
  }),
];
