import { useMutation } from '@tanstack/react-query';
import type { WorkflowDataSource, WorkflowDataSourceOption } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowDataSourceListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: workflowDataSourceKeys,
  useList: useWorkflowDataSourceList,
  useSave: useSaveWorkflowDataSource,
  useDelete: useDeleteWorkflowDataSources,
} = createCrudQueries<WorkflowDataSource, WorkflowDataSourceListParams, Record<string, unknown>>({
  resource: 'workflow-data-sources',
  // 保留原有嵌套 key：运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播失效
  keyPrefix: ['workflow', 'data-sources'],
  path: '/api/workflows/data-sources',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export function useTestWorkflowDataSource() {
  return useMutation({
    mutationFn: (id: number) =>
      request.get<WorkflowDataSourceOption[]>(`/api/workflows/data-sources/${id}/options`, { silent: true }).then(unwrap),
  });
}
