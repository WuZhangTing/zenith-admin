import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MpMaterial, MpMaterialType } from '@zenith/shared/mp';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface MpMaterialListParams extends CrudListParams {
  type?: MpMaterialType;
  keyword?: string;
  accountId?: number;
}

export interface MpMaterialSyncResult {
  created: number;
  updated: number;
}

const {
  keys: mpMaterialKeys,
  useList: useCrudMpMaterialList,
  useSave: useSaveMpMaterial,
  useDelete: useDeleteMpMaterial,
} = createCrudQueries<MpMaterial, MpMaterialListParams, Record<string, unknown>>({
  resource: 'mp-materials',
  path: '/api/mp/materials',
  deleteMode: 'single',
});

export { mpMaterialKeys, useSaveMpMaterial, useDeleteMpMaterial };

export function useMpMaterialList(accountId: number | null | undefined, params: Omit<MpMaterialListParams, 'accountId'>) {
  return useCrudMpMaterialList({ ...params, accountId: accountId ?? undefined }, !!accountId);
}

export function useSyncMpMaterials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) => request.post<MpMaterialSyncResult>('/api/mp/materials/sync', { accountId }).then(unwrap),
    onSuccess: () => {
      // 同步只会改变素材列表，不会影响公众号配置或其他域缓存。
      void qc.invalidateQueries({ queryKey: mpMaterialKeys.lists });
    },
  });
}

export function useUploadMpMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<MpMaterial>('/api/mp/materials/upload', formData, { onProgress }).then(unwrap),
    onSuccess: (saved) => {
      // 上传会新增一条素材，刷新列表并精确刷新返回的素材详情缓存。
      void qc.invalidateQueries({ queryKey: mpMaterialKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: mpMaterialKeys.lists });
    },
  });
}
