import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { DataMaskConfig, SensitiveField } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { useAllRoles } from './roles';

export interface DataMaskListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  maskType?: string;
  enabled?: string;
}

export const dataMaskKeys = {
  all: ['data-mask'] as const,
  lists: ['data-mask', 'list'] as const,
  list: (params: DataMaskListParams) => ['data-mask', 'list', params] as const,
  detail: (id: number | undefined) => ['data-mask', 'detail', id] as const,
};

export function useDataMaskList(params: DataMaskListParams) {
  return useQuery({
    queryKey: dataMaskKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<DataMaskConfig>>(`/api/data-mask-configs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useDataMaskDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: dataMaskKeys.detail(id),
    queryFn: () => request.get<DataMaskConfig>(`/api/data-mask-configs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

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

export function useSaveDataMask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<DataMaskConfig> }) =>
      (id === undefined
        ? request.post<DataMaskConfig>('/api/data-mask-configs', values)
        : request.put<DataMaskConfig>(`/api/data-mask-configs/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: dataMaskKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: dataMaskKeys.lists });
    },
  });
}

export function useDeleteDataMask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/data-mask-configs/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: dataMaskKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: dataMaskKeys.lists });
    },
  });
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
