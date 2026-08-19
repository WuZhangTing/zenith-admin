import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TenantPackage } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { invalidateCurrentUserAccess } from './menus';

export interface TenantPackageListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

/** 下拉源只返回精简字段 */
export interface TenantPackageOption {
  id: number;
  name: string;
  status: string;
}

export const {
  keys: tenantPackageKeys,
  useList: useTenantPackageList,
  useDetail: useTenantPackageDetail,
  useSave: useSaveTenantPackage,
  useDelete: useDeleteTenantPackages,
  useLookup: useAllTenantPackages,
} = createCrudQueries<TenantPackage, TenantPackageListParams, Partial<TenantPackage>, TenantPackageOption>({
  resource: 'tenant-packages',
  lookup: true,
});

/**
 * 分配套餐可授权功能。
 *
 * 刻意**不**失效下拉源：`features` 不进入下拉源（仅列表/详情返回），
 * 失效下拉源纯属无谓回源（由 lookup-collateral.test.tsx 锁定）。
 * 但套餐功能收紧会影响当前登录者的可访问范围，故需刷新用户权限。
 */
export function useAssignTenantPackageFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, features }: { id: number; features: string[] }) =>
      request.put<null>(`/api/tenant-packages/${id}/features`, { features }).then(unwrap),
    // features 在列表行与详情中都返回，功能变更需同时刷新两者
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantPackageKeys.lists });
      void qc.invalidateQueries({ queryKey: tenantPackageKeys.detail(id) });
      invalidateCurrentUserAccess(qc);
    },
  });
}
