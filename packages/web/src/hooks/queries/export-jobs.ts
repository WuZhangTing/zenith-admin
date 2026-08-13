import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { ExportEntityMeta, ExportJob, ExportJobCreateResult, ExportJobDownload } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface ExportJobListParams {
  page: number;
  pageSize: number;
  entity?: string;
  status?: string;
  format?: string;
  keyword?: string;
}

export const exportJobKeys = {
  all: ['export-jobs'] as const,
  entities: ['export-jobs', 'entities'] as const,
  lists: ['export-jobs', 'list'] as const,
  list: (params: ExportJobListParams) => ['export-jobs', 'list', params] as const,
  downloads: (id: number | undefined) => ['export-jobs', 'downloads', id] as const,
};

export function useExportEntities() {
  return useQuery({
    queryKey: exportJobKeys.entities,
    queryFn: () => request.get<ExportEntityMeta[]>('/api/export-jobs/entities', { silent: true }).then(unwrap),
  });
}

export function useExportJobList(params: ExportJobListParams) {
  return useQuery({
    queryKey: exportJobKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<ExportJob>>(`/api/export-jobs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.list.some((item) => item.status === 'pending' || item.status === 'running') ? 5000 : false;
    },
  });
}

export function useExportJobDownloads(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: exportJobKeys.downloads(id),
    queryFn: () => request.get<ExportJobDownload[]>(`/api/export-jobs/${id}/downloads`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCancelExportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<ExportJob>(`/api/export-jobs/${id}/cancel`).then(unwrap),
    // 仅改任务状态；`entities`（可导出实体元数据）与本次操作无关
    onSuccess: () => qc.invalidateQueries({ queryKey: exportJobKeys.lists }),
  });
}

export function useRetryExportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<ExportJob>(`/api/export-jobs/${id}/retry`).then(unwrap),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: exportJobKeys.lists });
      // 重试会重新产出文件，该任务的下载记录随之变化
      void qc.invalidateQueries({ queryKey: exportJobKeys.downloads(id) });
    },
  });
}

export function useRerunExportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (record: ExportJob) =>
      request.post<ExportJobCreateResult>('/api/export-jobs', {
        entity: record.entity,
        format: record.format,
        query: record.query ?? {},
        columns: record.columns ?? undefined,
        raw: record.raw,
        watermark: record.watermark,
        executionMode: record.executionMode,
      }).then(unwrap),
    // 另起一条新任务，原任务的下载记录不变
    onSuccess: () => qc.invalidateQueries({ queryKey: exportJobKeys.lists }),
  });
}

export function useDeleteExportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/export-jobs/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      // 任务已不存在，其下载记录必须移除而非失效，否则会去请求一个必然 404 的资源
      qc.removeQueries({ queryKey: exportJobKeys.downloads(id) });
      void qc.invalidateQueries({ queryKey: exportJobKeys.lists });
    },
  });
}

export function useBatchDeleteExportJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => request.delete<null>(`/api/export-jobs/${id}`, { silent: true }).then(unwrap))),
    onSuccess: (_data, ids) => {
      for (const id of ids) qc.removeQueries({ queryKey: exportJobKeys.downloads(id) });
      void qc.invalidateQueries({ queryKey: exportJobKeys.lists });
    },
  });
}
