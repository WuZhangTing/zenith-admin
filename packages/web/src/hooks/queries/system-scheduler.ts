import { keepPreviousData } from '@tanstack/react-query';
import { resourceKeyOf, type QueryOf } from '@zenith/shared/core';
import { systemSchedulerContract } from '@zenith/shared/platform';
import { contractKey, useApiMutation, useApiQuery } from '@/lib/contract-query';

export type SystemSchedulerRunListParams = NonNullable<QueryOf<typeof systemSchedulerContract.runs>>;

export type SystemSchedulerNodeListParams = NonNullable<QueryOf<typeof systemSchedulerContract.nodes>>;

const resource = resourceKeyOf(systemSchedulerContract.basePath);

/** 与 `contractKey` 同构：`[资源键, 操作名, input?]`，前缀可直接用于失效 */
export const systemSchedulerKeys = {
  all: [resource] as const,
  tasks: contractKey(systemSchedulerContract.tasks),
  runs: [resource, systemSchedulerContract.runs.name] as const,
  runList: (params: SystemSchedulerRunListParams) => contractKey(systemSchedulerContract.runs, { query: params }),
  runDetail: (id: number) => contractKey(systemSchedulerContract.runDetail, { params: { id } }),
  nodes: [resource, systemSchedulerContract.nodes.name] as const,
  nodeList: (params: SystemSchedulerNodeListParams) => contractKey(systemSchedulerContract.nodes, { query: params }),
};

export function useSystemSchedulerTasks() {
  return useApiQuery(systemSchedulerContract.tasks);
}

export function useSystemSchedulerRuns(params: SystemSchedulerRunListParams, enabled = true) {
  return useApiQuery(systemSchedulerContract.runs, { query: params }, { enabled, placeholderData: keepPreviousData });
}

export function useSystemSchedulerRunDetail(id: number | undefined, enabled = true) {
  return useApiQuery(systemSchedulerContract.runDetail, { params: { id: id ?? 0 } }, { enabled: enabled && id !== undefined });
}

export function useSystemSchedulerNodes(params: SystemSchedulerNodeListParams, enabled = true) {
  return useApiQuery(systemSchedulerContract.nodes, { query: params }, { enabled, placeholderData: keepPreviousData });
}

/** 手动执行会新增运行日志并改写任务的最近运行状态，整个调度域一并失效 */
export function useRunSystemSchedulerTask() {
  return useApiMutation(systemSchedulerContract.runTask, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: systemSchedulerKeys.all }),
  });
}

export function useSaveSystemSchedulerTaskConfig() {
  return useApiMutation(systemSchedulerContract.updateTaskConfig, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: systemSchedulerKeys.all }),
  });
}

export function useAcknowledgeSystemSchedulerAlert() {
  return useApiMutation(systemSchedulerContract.acknowledgeAlert, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: systemSchedulerKeys.all }),
  });
}

export function useCleanupSystemSchedulerRuns() {
  return useApiMutation(systemSchedulerContract.cleanupRuns, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: systemSchedulerKeys.all }),
  });
}
