import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateReportPrintTemplateInput, ReportPrintRenderResult, ReportPrintTemplate, UpdateReportPrintTemplateInput } from '@zenith/shared/report';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { useReportLookup } from './report-lookups';

export interface ReportPrintTemplateListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  ownerId?: number;
  folderId?: number;
}

export const {
  keys: reportPrintKeys,
  useList: useReportPrintTemplateList,
  useDetail: useReportPrintTemplateDetail,
  useSave: useSaveReportPrintTemplate,
  useDelete: useDeleteReportPrintTemplates,
} = createCrudQueries<ReportPrintTemplate, ReportPrintTemplateListParams, CreateReportPrintTemplateInput | UpdateReportPrintTemplateInput>({
  resource: 'report-print',
  // 保留原有嵌套 key：报表域用 ['report'] 前缀组织所有资源
  keyPrefix: ['report', 'print'],
  path: '/api/report/print',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export function useReportPrintTemplateLookup(params: { keyword?: string; status?: 'enabled' | 'disabled'; limit?: number } = {}, enabled = true) {
  return useReportLookup('print', params, enabled);
}

export function useRenderReportPrintTemplate() {
  return useMutation({
    mutationFn: ({ id, params, limit }: { id: number; params: Record<string, unknown>; limit: number }) =>
      request.post<ReportPrintRenderResult>(`/api/report/print/${id}/render`, { params, limit }, { silent: true }).then(unwrap),
  });
}

export function useBatchReportPrintTemplateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: 'enabled' | 'disabled' }) =>
      request.put<null>('/api/report/print/batch-status', { ids, status }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportPrintKeys.all }),
  });
}

export function useCloneReportPrintTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name?: string }) =>
      request.post<ReportPrintTemplate>(`/api/report/print/${id}/clone`, name ? { name } : {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportPrintKeys.all }),
  });
}
