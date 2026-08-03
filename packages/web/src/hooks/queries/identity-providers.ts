import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { IdentityProviderConnectionTestResult, IdentityProviderSyncResult, LdapDirectoryUser, TenantIdentityProvider } from '@zenith/shared/identity';
import { toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';
import { useAllTenants } from './tenants';

export interface IdentityProviderListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  type?: string;
  status?: string;
  tenantId?: string;
}

export const identityProviderKeys = {
  all: ['identity-providers'] as const,
  lists: ['identity-providers', 'list'] as const,
  list: (params: IdentityProviderListParams) => ['identity-providers', 'list', params] as const,
  detail: (id: number | undefined) => ['identity-providers', 'detail', id] as const,
};

export function useIdentityProviderList(params: IdentityProviderListParams) {
  return useQuery({
    queryKey: identityProviderKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<TenantIdentityProvider>>(`/api/identity-providers${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useIdentityProviderDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: identityProviderKeys.detail(id),
    queryFn: () => request.get<TenantIdentityProvider>(`/api/identity-providers/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

/**
 * 身份源配置页的租户下拉——直接复用 tenants 域的共享 lookup，
 * 避免同一端点在两个 key 下各存一份（租户切换器常驻 AdminLayout，会同时在线）。
 */
export function useIdentityProviderTenants() {
  return useAllTenants();
}

export function useSaveIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<TenantIdentityProvider>('/api/identity-providers', values)
        : request.put<TenantIdentityProvider>(`/api/identity-providers/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: identityProviderKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: identityProviderKeys.lists });
      // 租户下拉源与身份源配置无关，不动
    },
  });
}

export function useDeleteIdentityProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/identity-providers/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: identityProviderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: identityProviderKeys.lists });
    },
  });
}

export function useTestIdentityProviderConnection() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<IdentityProviderConnectionTestResult>(`/api/identity-providers/${id}/test`, {}, { silent: true }).then(unwrap),
  });
}

export function useSearchLdapDirectoryUsers() {
  return useMutation({
    mutationFn: ({ id, keyword }: { id: number; keyword?: string }) =>
      request.get<LdapDirectoryUser[]>(`/api/identity-providers/${id}/ldap/users${toQueryString({ limit: 20, keyword })}`, { silent: true }).then(unwrap),
  });
}

export function useSyncIdentityProviderDirectory() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<IdentityProviderSyncResult>(`/api/identity-providers/${id}/sync`, { limit: 500 }, { silent: true }).then(unwrap),
  });
}
