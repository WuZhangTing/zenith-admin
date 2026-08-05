import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { MpAccount } from '@zenith/shared/mp';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface MpAccountListParams extends CrudListParams {
  keyword?: string;
  type?: string;
  status?: string;
}

export const {
  keys: mpAccountKeys,
  useList: useMpAccountList,
  useDetail: useMpAccountDetail,
  useSave: useSaveMpAccount,
  useDelete: useDeleteMpAccount,
} = createCrudQueries<MpAccount, MpAccountListParams, Record<string, unknown>>({
  resource: 'mp-accounts',
  path: '/api/mp/accounts',
  lookup: true,
  deleteMode: 'single',
});

export function useMpAccountOptions() {
  return useQuery({
    queryKey: mpAccountKeys.lookup,
    queryFn: () => request.get<PaginatedResponse<MpAccount>>('/api/mp/accounts?page=1&pageSize=100').then(unwrap),
  });
}

export function useSetDefaultMpAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/mp/accounts/${id}/default`).then(unwrap),
    onSuccess: () => {
      // 默认公众号会改变当前与原默认账号详情、列表中的 isDefault，并影响公众号下拉源。
      void qc.invalidateQueries({ queryKey: ['mp-accounts', 'detail'] });
      void qc.invalidateQueries({ queryKey: mpAccountKeys.lists });
      void qc.invalidateQueries({ queryKey: mpAccountKeys.lookup });
    },
  });
}

export function useTestMpAccount() {
  return useMutation({
    mutationFn: (id: number) => request.post<{ success: boolean; message: string }>(`/api/mp/accounts/${id}/test`).then(unwrap),
  });
}
