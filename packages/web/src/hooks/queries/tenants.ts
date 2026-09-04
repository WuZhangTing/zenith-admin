import { useMutation, useQuery } from '@tanstack/react-query';
import { tenantContract } from '@zenith/shared/identity';
import { apiQueryOptions, createResourceQueries } from '@/lib/contract-query';
import { unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export const {
  keys: tenantKeys,
  useList: useTenantList,
  useDetail: useTenantDetail,
  useSave: useSaveTenant,
  useDelete: useDeleteTenants,
  useLookup: useAllTenants,
} = createResourceQueries(tenantContract);

export function useTenantStats(id: number | undefined, enabled = true) {
  return useQuery(apiQueryOptions(tenantContract.stats, { params: { id: id ?? 0 } }, { enabled: enabled && id !== undefined }));
}

/** 切换当前查看的租户——换发 token 后整页重载，故不做缓存失效 */
export function useSwitchTenant() {
  return useMutation({
    mutationFn: (tenantId: number | null) =>
      request.post<{ accessToken: string; refreshToken: string }>('/api/auth/switch-tenant', { tenantId }).then(unwrap),
  });
}
