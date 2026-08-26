import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { OperationLog, OperationLogStats } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface OperationLogListParams {
  page: number;
  pageSize: number;
  username?: string;
  module?: string;
  description?: string;
  method?: string;
  path?: string;
  ip?: string;
  status?: string;
  /** 内容关键字：匹配请求体与操作前后快照 */
  content?: string;
  startTime?: string;
  endTime?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
}

export interface OperationLogStatsParams {
  days: number;
}

export const operationLogKeys = {
  all: ['operation-logs'] as const,
  lists: ['operation-logs', 'list'] as const,
  list: (params: OperationLogListParams) => ['operation-logs', 'list', params] as const,
  stats: ['operation-logs', 'stats'] as const,
  statsDetail: (params: OperationLogStatsParams) => ['operation-logs', 'stats', params] as const,
};

export function useOperationLogList(params: OperationLogListParams) {
  return useQuery({
    queryKey: operationLogKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<OperationLog>>(`/api/operation-logs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useOperationLogStats(params: OperationLogStatsParams) {
  return useQuery({
    queryKey: operationLogKeys.statsDetail(params),
    queryFn: () => request.get<OperationLogStats>(`/api/operation-logs/stats${toQueryString(params)}`).then(unwrap),
    // 切换统计周期时保留上一周期数据，由面板的 Spin 覆盖刷新，避免整屏回退骨架
    placeholderData: keepPreviousData,
  });
}

export function useCleanOperationLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => request.delete<null>(`/api/operation-logs/clean${toQueryString({ days })}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationLogKeys.all }),
  });
}
