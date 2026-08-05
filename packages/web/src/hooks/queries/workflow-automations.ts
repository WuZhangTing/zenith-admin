import type { WorkflowAutomation } from '@zenith/shared/workflow';
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
