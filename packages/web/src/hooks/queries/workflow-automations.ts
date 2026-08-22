import type { WorkflowAutomation, WorkflowAutomationRun } from '@zenith/shared/workflow';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowAutomationListParams extends CrudListParams {
  definitionId?: number;
  trigger?: string;
  status?: string;
}

export const {
  keys: workflowAutomationKeys,
  useList: useWorkflowAutomationList,
  useDetail: useWorkflowAutomationDetail,
  useSave: useSaveWorkflowAutomation,
  useDelete: useDeleteWorkflowAutomations,
} = createCrudQueries<WorkflowAutomation, WorkflowAutomationListParams, Record<string, unknown>>({
  resource: 'workflow-automations',
  // 保留原有嵌套 key：多处运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播，
  // 改成扁平的 ['workflow-automations'] 会让本域悄悄脱离该失效范围
  keyPrefix: ['workflow', 'automations'],
  path: '/api/workflows/automations',
  deleteMode: 'single',
});

export interface WorkflowAutomationRunListParams {
  ruleId?: number;
  instanceId?: number;
  status?: 'success' | 'failed' | 'skipped';
  page?: number;
  pageSize?: number;
}

interface WorkflowAutomationRunListResult {
  list: WorkflowAutomationRun[];
  total: number;
  page: number;
  pageSize: number;
}

/** 自动化动作执行记录（打开执行记录抽屉时启用） */
export function useWorkflowAutomationRunList(params: WorkflowAutomationRunListParams, enabled = true) {
  return useQuery({
    queryKey: ['workflow', 'automations', 'runs', params] as const,
    queryFn: () =>
      request
        .get<WorkflowAutomationRunListResult>(`/api/workflows/automations/runs${toQueryString(params)}`)
        .then(unwrap),
    enabled,
  });
}
