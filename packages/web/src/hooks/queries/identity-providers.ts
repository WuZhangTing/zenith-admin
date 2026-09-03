import { useMutation } from '@tanstack/react-query';
import type { IdentityProviderConnectionTestResult, IdentityProviderSyncResult, LdapDirectoryUser, TenantIdentityProvider } from '@zenith/shared/identity';
import { toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { useAllTenants } from './tenants';

export interface IdentityProviderListParams extends CrudListParams {
  keyword?: string;
  type?: string;
  status?: string;
  tenantId?: string;
}

export const {
  keys: identityProviderKeys,
  useList: useIdentityProviderList,
  useDetail: useIdentityProviderDetail,
  useSave: useSaveIdentityProvider,
  useDelete: useDeleteIdentityProviders,
} = createCrudQueries<TenantIdentityProvider, IdentityProviderListParams, Record<string, unknown>>({
  resource: 'identity-providers',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

/**
 * 身份源配置页的租户下拉——直接复用 tenants 域的共享 lookup，
 * 避免同一端点在两个 key 下各存一份（租户切换器常驻 AdminLayout，会同时在线）。
 */
export function useIdentityProviderTenants(options?: { enabled?: boolean }) {
  return useAllTenants(options);
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
