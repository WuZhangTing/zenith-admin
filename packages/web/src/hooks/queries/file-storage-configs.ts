import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFileStorageConfigInput, FileStorageConfig, StorageBrowseResult } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface FileStorageConfigListParams extends CrudListParams {
  status?: string;
  startTime?: string;
  endTime?: string;
}

/** 改配置可能同时改变默认项标记；文件浏览结果与配置增删改无关，不动 */
const DEFAULT_CONFIG_KEY = ['file-storage-configs', 'default'] as const;

const crud = createCrudQueries<FileStorageConfig, FileStorageConfigListParams, CreateFileStorageConfigInput | Record<string, unknown>>({
  resource: 'file-storage-configs',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: DEFAULT_CONFIG_KEY }),
  onDeleted: (qc, ids) => {
    // 该配置下的浏览结果已无对应存储源
    for (const id of ids) qc.removeQueries({ queryKey: ['file-storage-configs', 'browse', id] });
    void qc.invalidateQueries({ queryKey: DEFAULT_CONFIG_KEY });
  },
});

export const fileStorageConfigKeys = {
  ...crud.keys,
  defaultConfig: DEFAULT_CONFIG_KEY,
  browseRoot: ['file-storage-configs', 'browse'] as const,
  browse: (configId: number | undefined, path: string) => ['file-storage-configs', 'browse', configId, path] as const,
};

export const useFileStorageConfigList = crud.useList;
export const useFileStorageConfigDetail = crud.useDetail;
export const useSaveFileStorageConfig = crud.useSave;
export const useDeleteFileStorageConfigs = crud.useDelete;

export function useDefaultFileStorageConfig() {
  return useQuery({
    queryKey: fileStorageConfigKeys.defaultConfig,
    queryFn: () => request.get<FileStorageConfig | null>('/api/file-storage-configs/default').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useStorageBrowse(configId: number | undefined, path: string, enabled = true) {
  return useQuery({
    queryKey: fileStorageConfigKeys.browse(configId, path),
    queryFn: () =>
      request
        .get<StorageBrowseResult>(`/api/files/browse${toQueryString({ storageConfigId: configId, path })}`)
        .then(unwrap),
    enabled: enabled && configId !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useSetDefaultFileStorageConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.put<FileStorageConfig>(`/api/file-storage-configs/${id}/default`).then(unwrap),
    // 默认项切换会同时改变旧默认项，故刷新整个列表
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.lists });
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.defaultConfig });
    },
  });
}

export function useTestFileStorageConfig() {
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<null>('/api/file-storage-configs/test', values)
        : request.post<null>(`/api/file-storage-configs/${id}/test`, values)
      ).then(unwrap),
  });
}
