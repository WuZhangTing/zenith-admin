import { useMutation, useQuery } from '@tanstack/react-query';
import type { WorkflowConnector, WorkflowConnectorInvocation, WorkflowConnectorInvokeResult, WorkflowConnectorStats } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowConnectorListParams extends CrudListParams {
  keyword?: string;
  type?: string;
  status?: string;
}

/** 连接器监控（stats + 调用记录）随连接器增删改一并失效 */
const CONNECTOR_MONITOR_PREFIX = ['workflow', 'connectors', 'monitor'] as const;

const crud = createCrudQueries<WorkflowConnector, WorkflowConnectorListParams, Record<string, unknown>>({
  resource: 'workflow-connectors',
  // 保留原有嵌套 key：运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播失效
  keyPrefix: ['workflow', 'connectors'],
  path: '/api/workflows/connectors',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: CONNECTOR_MONITOR_PREFIX }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: CONNECTOR_MONITOR_PREFIX }),
});

export const workflowConnectorKeys = {
  ...crud.keys,
  monitor: (id: number | null | undefined, days: number) => ['workflow', 'connectors', 'monitor', id ?? null, days] as const,
};

export const useWorkflowConnectorList = crud.useList;
export const useSaveWorkflowConnector = crud.useSave;
export const useDeleteWorkflowConnectors = crud.useDelete;

export function useWorkflowConnectorMonitor(id: number | null | undefined, days: number, enabled = true) {
  return useQuery({
    queryKey: workflowConnectorKeys.monitor(id, days),
    queryFn: async () => {
      const [stats, invocations] = await Promise.all([
        request.get<WorkflowConnectorStats>(`/api/workflows/connectors/${id}/stats${toQueryString({ days })}`, { silent: true }).then(unwrap),
        request.get<WorkflowConnectorInvocation[]>(`/api/workflows/connectors/${id}/invocations${toQueryString({ limit: 50 })}`, { silent: true }).then(unwrap),
      ]);
      return { stats, invocations };
    },
    enabled: enabled && !!id,
  });
}

export function useTestWorkflowConnector() {
  return useMutation({
    mutationFn: ({ id, path }: { id: number; path?: string }) =>
      request.post<WorkflowConnectorInvokeResult>(`/api/workflows/connectors/${id}/test`, path ? { path } : {}, { silent: true }).then(unwrap),
  });
}
