import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DataMaskConfig, SensitiveField } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { useAllRoles } from './roles';

export interface DataMaskListParams extends CrudListParams {
  keyword?: string;
  maskType?: string;
  enabled?: string;
}

const crud = createCrudQueries<DataMaskConfig, DataMaskListParams>({
  resource: 'data-mask',
  path: '/api/data-mask-configs',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export const dataMaskKeys = crud.keys;

export const useDataMaskList = crud.useList;
export const useDataMaskDetail = crud.useDetail;
export const useSaveDataMask = crud.useSave;
export const useDeleteDataMasks = crud.useDelete;

/**
 * 角色选项。数据实际归属 roles 域，复用其共享 lookup，
 * 避免以 dataMaskKeys 为键导致角色增删改后没有来源失效它。
 */
export function useDataMaskRoleOptions() {
  const rolesQuery = useAllRoles();
  const data = useMemo(
    () => (rolesQuery.data ?? []).map((r) => ({ value: r.code, label: r.name })),
    [rolesQuery.data],
  );
  return { data, isFetching: rolesQuery.isFetching, isSuccess: rolesQuery.isSuccess };
}

export function useScanDataMaskFields() {
  return useMutation({
    mutationFn: () => request.get<SensitiveField[]>('/api/data-mask-configs/scan').then(unwrap),
  });
}

export function useBatchCreateDataMask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<Partial<DataMaskConfig>>) =>
      request.post<{ created: number; skipped: number }>('/api/data-mask-configs/batch-create', { items }).then(unwrap),
    // 批量创建的 id 未知，只需刷新列表
    onSuccess: () => qc.invalidateQueries({ queryKey: dataMaskKeys.lists }),
  });
}
