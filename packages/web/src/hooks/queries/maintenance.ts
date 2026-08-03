import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { MaintenanceLog } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  estimatedEndAt: string | null;
  startedAt: string | null;
  startedByName: string | null;
  updatedAt: string;
}

export interface MaintenanceLogListParams {
  page: number;
  pageSize: number;
}

export interface UpdateMaintenanceStatusInput {
  enabled: boolean;
  message?: string;
  estimatedEndAt?: string | null;
}

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  /** 管理端详情 GET /api/maintenance —— 需 system:maintenance:manage 权限 */
  status: ['maintenance', 'status'] as const,
  /** 公开探测 GET /api/maintenance/status —— 未登录/无权限用户也可访问 */
  publicStatus: ['maintenance', 'public-status'] as const,
  logs: ['maintenance', 'logs'] as const,
  logList: (params: MaintenanceLogListParams) => ['maintenance', 'logs', params] as const,
};

export function publicMaintenanceStatusQueryOptions() {
  return queryOptions({
    queryKey: maintenanceKeys.publicStatus,
    queryFn: () => request.get<MaintenanceStatus>('/api/maintenance/status', { silent: true }).then(unwrap),
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * 公开维护状态。全站维护遮罩、超管横幅共用这一份缓存——此前 App.tsx、
 * MaintenanceOverlay、useMaintenanceBanner 各自裸取一次，再靠 CustomEvent
 * 手工广播失效，等于手写了一遍 invalidateQueries。
 */
export function usePublicMaintenanceStatus(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    ...publicMaintenanceStatusQueryOptions(),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: maintenanceKeys.status,
    queryFn: () => request.get<MaintenanceStatus>('/api/maintenance').then(unwrap),
  });
}

export function useMaintenanceLogs(params: MaintenanceLogListParams) {
  return useQuery({
    queryKey: maintenanceKeys.logList(params),
    queryFn: () => request.get<PaginatedResponse<MaintenanceLog>>(`/api/maintenance/logs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateMaintenanceStatusInput) => request.put<MaintenanceStatus>('/api/maintenance', values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: maintenanceKeys.all }),
  });
}
