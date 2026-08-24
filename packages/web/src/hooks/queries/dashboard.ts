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
 * 公告不在此列：顶栏公告铃铛与工作台公告卡片读的是同一份 `/api/announcements/published`，
 * 曾各自用 `['dashboard','announcements']` 与 `announcementKeys.published` 存两份缓存，
 * 导致从顶栏标记已读后工作台仍显示未读圆点。现统一复用 `announcements.ts` 的域 hook。
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
