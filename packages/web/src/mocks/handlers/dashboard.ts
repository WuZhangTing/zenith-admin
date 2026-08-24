import { http } from 'msw';
import { ok } from '@/mocks/utils/handlers';
import { mockDate } from '@/mocks/utils/date';

function pastDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return mockDate(d);
  });
}

const dates = pastDates(7);

export const dashboardHandlers = [
  http.get('/api/dashboard/stats', () => {
    return ok({
      totalUsers: 12,
      onlineUsers: 3,
      todayLogins: 8,
      todayOperations: 45,
    }, 'success');
  }),

  http.get('/api/dashboard/charts', () => {
    const loginTrend = dates.map((date) => ({
      date,
      successCount: Math.floor(Math.random() * 12) + 2,
      failCount: Math.floor(Math.random() * 3),
    }));

    const operationTypes = [
      { module: '用户管理', count: 18 },
      { module: '角色管理', count: 12 },
      { module: '菜单管理', count: 7 },
      { module: '字典管理', count: 5 },
      { module: '系统配置', count: 3 },
    ];

    const userActivity = dates.map((date) => ({
      date,
      activeUsers: Math.floor(Math.random() * 6) + 1,
    }));

    return ok({ loginTrend, operationTypes, userActivity }, 'success');
  }),
];
