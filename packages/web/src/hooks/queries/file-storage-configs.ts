import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { CreateFileStorageConfigInput, FileStorageConfig, StorageBrowseResult } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface FileStorageConfigListParams {
  page: number;
  pageSize: number;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const fileStorageConfigKeys = {
  all: ['file-storage-configs'] as const,
  lists: ['file-storage-configs', 'list'] as const,
  list: (params: FileStorageConfigListParams) => ['file-storage-configs', 'list', params] as const,
  detail: (id: number | undefined) => ['file-storage-configs', 'detail', id] as const,
  defaultConfig: ['file-storage-configs', 'default'] as const,
  browseRoot: ['file-storage-configs', 'browse'] as const,
  browse: (configId: number | undefined, path: string) => ['file-storage-configs', 'browse', configId, path] as const,
};

export function useFileStorageConfigList(params: FileStorageConfigListParams) {
  return useQuery({
    queryKey: fileStorageConfigKeys.list(params),
    queryFn: () =>
      request.get<PaginatedResponse<FileStorageConfig>>(`/api/file-storage-configs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useFileStorageConfigDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: fileStorageConfigKeys.detail(id),
    queryFn: () => request.get<FileStorageConfig>(`/api/file-storage-configs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

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

export function useSaveFileStorageConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: CreateFileStorageConfigInput | Record<string, unknown> }) =>
      (id === undefined
        ? request.post<FileStorageConfig>('/api/file-storage-configs', values)
        : request.put<FileStorageConfig>(`/api/file-storage-configs/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.lists });
      // 改配置可能同时改变默认项标记；文件浏览结果与配置增删改无关，不动
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.defaultConfig });
    },
  });
}

export function useDeleteFileStorageConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/file-storage-configs/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: fileStorageConfigKeys.detail(id) });
      // 该配置下的浏览结果已无对应存储源
      qc.removeQueries({ queryKey: ['file-storage-configs', 'browse', id] });
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.lists });
      void qc.invalidateQueries({ queryKey: fileStorageConfigKeys.defaultConfig });
    },
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
