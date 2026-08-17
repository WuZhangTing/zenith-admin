import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { OAuth2Client, OAuth2ClientCreated, OpenApiDebugEndpoint, OpenApiDebugResult, OpenAppQuotaUsage } from '@zenith/shared/open-platform';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export interface MyAppListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  environment?: OAuth2Client['environment'];
  reviewStatus?: OAuth2Client['reviewStatus'];
}

export const developerAppKeys = {
  all: ['developer-apps'] as const,
  lists: ['developer-apps', 'list'] as const,
  list: (params: MyAppListParams) => ['developer-apps', 'list', params] as const,
  detail: (id: number | undefined) => ['developer-apps', 'detail', id] as const,
  quota: (id: number | undefined) => ['developer-apps', 'quota', id] as const,
  debugEndpoints: ['developer-apps', 'debug-endpoints'] as const,
};

/** 可调试的开放 API 端点目录（由服务端按实际路由派生，属低频字典型数据） */
export function useDebugEndpoints() {
  return useQuery({
    queryKey: developerAppKeys.debugEndpoints,
    queryFn: () => request.get<OpenApiDebugEndpoint[]>('/api/developer-apps/debug/endpoints', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useMyAppList(params: MyAppListParams) {
  return useQuery({
    queryKey: developerAppKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<OAuth2Client>>(
      `/api/developer-apps${toQueryString(params)}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useMyAppDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: developerAppKeys.detail(id),
    queryFn: () => request.get<OAuth2Client>(`/api/developer-apps/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveMyApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<OAuth2ClientCreated>('/api/developer-apps', values)
        : request.put<OAuth2Client>(`/api/developer-apps/${id}`, values)
      ).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: developerAppKeys.all }),
  });
}

export function useDeleteMyApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/developer-apps/${id}`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: developerAppKeys.all }),
  });
}

export function useSubmitMyApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<OAuth2Client>(`/api/developer-apps/${id}/submit`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: developerAppKeys.all }),
  });
}

export function useRotateMyAppSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<{
      clientId: string;
      clientSecret: string;
      previousValidUntil: string;
    }>(`/api/developer-apps/${id}/regenerate-secret`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: developerAppKeys.all }),
  });
}

export function useMyAppQuota(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: developerAppKeys.quota(id),
    queryFn: () => request.get<OpenAppQuotaUsage>(`/api/developer-apps/${id}/quota-usage`).then(unwrap),
    enabled: enabled && id !== undefined,
    refetchInterval: 10_000,
  });
}

export function useDebugMyApp() {
  return useMutation({
    mutationFn: ({ id, values }: {
      id: number;
      values: {
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        /** 端点路径由服务端端点目录校验，前端不再枚举 */
        path: string;
        query?: Record<string, string>;
        body?: unknown;
      };
    }) => request.post<OpenApiDebugResult>(`/api/developer-apps/${id}/debug`, values).then(unwrap),
  });
}
