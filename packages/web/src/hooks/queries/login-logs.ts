import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { LoginLog, LoginLogStats } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface LoginLogListParams {
  page: number;
  pageSize: number;
  username?: string;
  eventType?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export interface LoginLogStatsParams {
  days: number;
}

export const loginLogKeys = {
  all: ['login-logs'] as const,
  lists: ['login-logs', 'list'] as const,
  list: (params: LoginLogListParams) => ['login-logs', 'list', params] as const,
  stats: ['login-logs', 'stats'] as const,
  statsDetail: (params: LoginLogStatsParams) => ['login-logs', 'stats', params] as const,
};

export function useLoginLogList(params: LoginLogListParams) {
  return useQuery({
    queryKey: loginLogKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<LoginLog>>(`/api/login-logs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useLoginLogStats(params: LoginLogStatsParams) {
  return useQuery({
    queryKey: loginLogKeys.statsDetail(params),
    queryFn: () => request.get<LoginLogStats>(`/api/login-logs/stats${toQueryString(params)}`).then(unwrap),
    // 切换统计周期时保留上一周期数据，由面板的 Spin 覆盖刷新，避免整屏回退骨架
    placeholderData: keepPreviousData,
  });
}

export function useCleanLoginLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => request.delete<null>(`/api/login-logs/clean${toQueryString({ days })}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: loginLogKeys.all }),
  });
}
