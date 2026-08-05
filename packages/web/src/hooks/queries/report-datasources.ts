import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReportDatasource } from '@zenith/shared/report';
import type { AsyncTask } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { useReportLookup } from './report-lookups';

export interface ReportDatasourceListParams extends CrudListParams {
  keyword?: string;
  type?: string;
  status?: string;
  ownerId?: number;
  folderId?: number;
}

export interface TestReportDatasourceConnectionInput {
  id?: number;
  type: string;
  config: Record<string, unknown>;
}

export const {
  keys: reportDatasourceKeys,
  useList: useReportDatasourceList,
  useDetail: useReportDatasourceDetail,
  useSave: useSaveReportDatasource,
  useDelete: useDeleteReportDatasources,
} = createCrudQueries<ReportDatasource, ReportDatasourceListParams, Record<string, unknown>>({
  resource: 'report-datasources',
  // 保留原有嵌套 key：报表域用 ['report'] 前缀组织所有资源
  keyPrefix: ['report', 'datasources'],
  path: '/api/report/datasources',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export function useReportDatasourceLookup(params: { keyword?: string; status?: 'enabled' | 'disabled'; limit?: number } = {}, enabled = true) {
  return useReportLookup('datasources', params, enabled);
}

export function useTestReportDatasourceConnection() {
  return useMutation({
    mutationFn: (values: TestReportDatasourceConnectionInput) =>
      request.post<{ ok: boolean; message: string; latencyMs?: number }>('/api/report/datasources/test', values, { silent: true }).then(unwrap),
  });
}

export function useRunReportDatasourceHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.post<AsyncTask>('/api/report/datasources/health-check', { ids }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportDatasourceKeys.all }),
  });
}

export function useBatchReportDatasourceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: 'enabled' | 'disabled' }) =>
      request.put<null>('/api/report/datasources/batch-status', { ids, status }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportDatasourceKeys.all }),
  });
}

export function useCloneReportDatasource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name?: string }) =>
      request.post<ReportDatasource>(`/api/report/datasources/${id}/clone`, name ? { name } : {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportDatasourceKeys.all }),
  });
}
