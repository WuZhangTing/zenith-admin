import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { WorkflowSchedule } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowScheduleListParams extends CrudListParams {
  definitionId?: number;
  status?: string;
}

export const {
  keys: workflowScheduleKeys,
  useList: useWorkflowScheduleList,
  useSave: useSaveWorkflowSchedule,
  useDelete: useDeleteWorkflowSchedules,
} = createCrudQueries<WorkflowSchedule, WorkflowScheduleListParams, Record<string, unknown>>({
  resource: 'workflow-schedules',
  // 保留原有嵌套 key：运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播失效
  keyPrefix: ['workflow', 'schedules'],
  path: '/api/workflows/schedules',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});

export function useRunWorkflowSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<WorkflowSchedule>(`/api/workflows/schedules/${id}/run`, {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow'] }),
  });
}
