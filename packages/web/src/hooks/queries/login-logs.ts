import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { QueryOf } from '@zenith/shared/core';
import { loginLogContract } from '@zenith/shared/identity';
import { api, useApiMutation } from '@/lib/contract-query';

export type LoginLogListParams = NonNullable<QueryOf<typeof loginLogContract.list>>;

export type LoginLogStatsParams = NonNullable<QueryOf<typeof loginLogContract.stats>>;

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
    queryFn: () => api(loginLogContract.list, { query: params }),
    placeholderData: keepPreviousData,
  });
}

export function useLoginLogStats(params: LoginLogStatsParams) {
  return useQuery({
    queryKey: loginLogKeys.statsDetail(params),
    queryFn: () => api(loginLogContract.stats, { query: params }),
    // 切换统计周期时保留上一周期数据，由面板的 Spin 覆盖刷新，避免整屏回退骨架
    placeholderData: keepPreviousData,
  });
}

export function useCleanLoginLogs() {
  return useApiMutation(loginLogContract.clean, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: loginLogKeys.all }),
  });
}
