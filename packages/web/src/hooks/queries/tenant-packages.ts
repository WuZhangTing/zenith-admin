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
 * 分配套餐可见菜单。
 *
 * 刻意**不**失效下拉源：`menuIds` 只存在于套餐详情，列表与下拉源都不含它，
 * 失效下拉源纯属无谓回源（由 lookup-collateral.test.tsx 锁定）。
 * 但套餐白名单收紧会影响当前登录者的可访问范围，故需刷新用户权限。
 */
export function useAssignTenantPackageMenus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, menuIds }: { id: number; menuIds: number[] }) =>
      request.put<null>(`/api/tenant-packages/${id}/menus`, { menuIds }).then(unwrap),
    // menuIds 只存在于套餐详情，列表与下拉源都不含
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: tenantPackageKeys.detail(id) });
      invalidateCurrentUserAccess(qc);
    },
  });
}
