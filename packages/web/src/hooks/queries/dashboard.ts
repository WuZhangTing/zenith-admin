import { useQuery } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export interface DashboardStats {
  totalUsers: number;
  onlineUsers: number;
  todayLogins: number;
  todayOperations: number;
}

export interface LoginTrendItem {
  date: string;
  successCount: number;
  failCount: number;
}

export interface OperationTypeItem {
  module: string;
  count: number;
  fill?: string;
}

export interface UserActivityItem {
  date: string;
  activeUsers: number;
}

export interface DashboardCharts {
  loginTrend: LoginTrendItem[];
  operationTypes: OperationTypeItem[];
  userActivity: UserActivityItem[];
}

/**
 * 工作台自有数据。
 *
 * 公告不在此列：顶栏公告铃铛与工作台公告卡片共用 `announcements.ts` 的 `usePublishedAnnouncements`，
 * 同一 query key 只存一份缓存，从顶栏标记已读后工作台的未读圆点随之消失。
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: ['dashboard', 'stats'] as const,
  charts: ['dashboard', 'charts'] as const,
};

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.stats,
    queryFn: () => request.get<DashboardStats>('/api/dashboard/stats', { silent: true }).then(unwrap),
    enabled,
  });
}

export function useDashboardCharts(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.charts,
    queryFn: () => request.get<DashboardCharts>('/api/dashboard/charts', { silent: true }).then(unwrap),
    enabled,
  });
}
