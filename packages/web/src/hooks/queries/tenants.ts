import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { Tenant, TenantStats } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface TenantListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export const tenantKeys = {
  all: ['tenants'] as const,
  lists: ['tenants', 'list'] as const,
  list: (params: TenantListParams) => ['tenants', 'list', params] as const,
  detail: (id: number | undefined) => ['tenants', 'detail', id] as const,
  stats: (id: number | undefined) => ['tenants', 'stats', id] as const,
  /** 全量启用租户下拉源（租户切换器、身份源配置等场景共享缓存） */
  allTenants: ['tenants', 'all-tenants'] as const,
};

export function allTenantsQueryOptions() {
  return queryOptions({
    queryKey: tenantKeys.allTenants,
    queryFn: () => request.get<Tenant[]>('/api/tenants/all', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useAllTenants(options?: { enabled?: boolean }) {
  return useQuery({
    ...allTenantsQueryOptions(),
    enabled: options?.enabled ?? true,
  });
}

/** 切换当前查看的租户——换发 token 后整页重载，故不做缓存失效 */
export function useSwitchTenant() {
  return useMutation({
    mutationFn: (tenantId: number | null) =>
      request.post<{ accessToken: string; refreshToken: string }>('/api/auth/switch-tenant', { tenantId }).then(unwrap),
  });
}

export function useTenantList(params: TenantListParams) {
  return useQuery({
    queryKey: tenantKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<Tenant>>(`/api/tenants${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useTenantDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: tenantKeys.detail(id),
    queryFn: () => request.get<Tenant>(`/api/tenants/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useTenantStats(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: tenantKeys.stats(id),
    queryFn: () => request.get<TenantStats>(`/api/tenants/${id}/stats`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<Tenant> }) =>
      (id === undefined ? request.post<Tenant>('/api/tenants', values) : request.put<Tenant>(`/api/tenants/${id}`, values)).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKeys.all }),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/tenants/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantKeys.all }),
  });
}
