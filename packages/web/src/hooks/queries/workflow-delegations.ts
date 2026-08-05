import type { WorkflowDelegation } from '@zenith/shared/workflow';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowDelegationListParams extends CrudListParams {
  scope: 'mine' | 'all';
}

export const {
  keys: workflowDelegationKeys,
  useList: useWorkflowDelegationList,
  useSave: useSaveWorkflowDelegation,
  useDelete: useDeleteWorkflowDelegations,
} = createCrudQueries<WorkflowDelegation, WorkflowDelegationListParams, Record<string, unknown>>({
  resource: 'workflow-delegations',
  // 保留原有嵌套 key：运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播失效
  keyPrefix: ['workflow', 'delegations'],
  path: '/api/workflows/delegations',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
});
