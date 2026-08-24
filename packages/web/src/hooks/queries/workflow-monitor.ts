import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { WorkflowAnalytics, WorkflowCompensation, WorkflowCompensationDetail, WorkflowDefinition, WorkflowEngineActionKey, WorkflowEngineActionPreview, WorkflowEngineActionResult, WorkflowEngineHealthHistory, WorkflowEngineIntrospection, WorkflowHandoverPreview, WorkflowHandoverResult, WorkflowInstance, WorkflowInstanceTrace, WorkflowJob, WorkflowJobBatchResult, WorkflowJobChain, WorkflowJobExecution, WorkflowJobStatus, WorkflowJobSummaryItem, WorkflowJobType, WorkflowOverdueTask, WorkflowRecoveryBatchResult, WorkflowRuntimeDiagnostics, WorkflowTaskMonitorResult } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface WorkflowMonitorListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  categoryId?: number;
  definitionId?: number;
  initiatorKeyword?: string;
  priority?: string;
}

export interface WorkflowMonitorStats {
  total: number;
  running: number;
  suspended: number;
  returned: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  cancelled: number;
}

export interface WorkflowMonitorResponse {
  stats: WorkflowMonitorStats;
  list: WorkflowInstance[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowJobListParams {
  page: number;
  pageSize: number;
  jobType: WorkflowJobType;
  status?: WorkflowJobStatus;
  keyword?: string;
}

export interface WorkflowTaskMonitorParams {
  page: number;
  pageSize: number;
  status?: string;
  nodeType?: string;
  keyword?: string;
  assigneeKeyword?: string;
  definitionId?: number;
  instanceId?: number;
  startTime?: string;
  endTime?: string;
  stuckMinutes?: number;
}

export type WorkflowJobDetail = WorkflowJob & { executions: WorkflowJobExecution[] };

export interface FailureClusterJob {
  id: number;
  jobType: string;
  status: string;
  instanceId: number | null;
  instanceTitle: string | null;
  definitionName: string | null;
  nodeKey: string | null;
  attempts: number;
  maxAttempts: number;
  /** 最后领取该作业的 worker 节点（hostname:pid） */
  lockedBy: string | null;
  traceId: string | null;
  /** 完整原始错误 */
  lastError: string | null;
  /** 最近失败时间 */
  failedAt: string;
  createdAt: string;
}

export interface FailureCluster {
  dimension: 'reason' | 'jobType' | 'instance' | 'trace';
  key: string;
  label: string;
  count: number;
  jobTypes: string[];
  instanceId: number | null;
  traceId: string | null;
  reasonKeyword: string | null;
  /** 簇内最早失败时间 */
  firstAt: string | null;
  /** 簇内最近失败时间 */
  lastAt: string | null;
  /** 涉及的流程实例数 */
  instanceCount: number;
  /** 成员作业明细（按最近失败倒序，最多 10 条） */
  jobs: FailureClusterJob[];
}

export interface WorkflowJobReplayResult {
  total: number;
  success: number;
  skipped: number;
  matched: number;
  ratePerSecond: number;
  limit: number;
}

export interface WorkflowJobRuntimeStatus {
  activeWorkers: number;
  totalWorkers: number;
  workers: Array<{ nodeId: string; hostname: string | null; runningJobCount: number; lastHeartbeatAt: string | null; fresh: boolean }>;
  runningJobs: number;
  stuckRunningJobs: number;
  backlog: number;
  deadLetter: number;
  lastClaimedAt: string | null;
  failureRate: number;
  avgDurationMs: number | null;
  recentExecutions: number;
}

export interface WorkflowCompensationListParams {
  page: number;
  pageSize: number;
  status?: string;
}

export interface WorkflowEngineDiagnosticsParams {
  thresholdMinutes: number;
  historyHours: number;
}

export interface WorkflowRecoveryBatchInput {
  definitionId: number;
  nodeKey: string;
  olderThanMinutes?: number;
  reason?: string;
}

export const workflowMonitorKeys = {
  all: ['workflow'] as const,
  monitor: ['workflow', 'monitor'] as const,
  monitorLists: ['workflow', 'monitor', 'list'] as const,
  monitorList: (params: WorkflowMonitorListParams) => ['workflow', 'monitor', 'list', params] as const,
  taskMonitorLists: ['workflow', 'monitor', 'tasks'] as const,
  taskMonitorList: (params: WorkflowTaskMonitorParams) => ['workflow', 'monitor', 'tasks', params] as const,
  monitorDetail: (id: number | undefined) => ['workflow', 'monitor', 'detail', id] as const,
  definitionsOptions: ['workflow', 'definitions', 'options'] as const,
  definitionDetail: (id: number | undefined) => ['workflow', 'definitions', 'detail', id] as const,
  diagnostics: (id: number | undefined) => ['workflow', 'monitor', 'diagnostics', id] as const,
  trace: (id: number | undefined) => ['workflow', 'monitor', 'trace', id] as const,
  analytics: (definitionId: number | undefined) => ['workflow', 'monitor', 'analytics', definitionId] as const,
  overdue: (definitionId: number | undefined) => ['workflow', 'monitor', 'overdue', definitionId] as const,
  jobs: ['workflow', 'jobs'] as const,
  jobLists: ['workflow', 'jobs', 'list'] as const,
  jobList: (params: WorkflowJobListParams) => ['workflow', 'jobs', 'list', params] as const,
  jobDetail: (id: number | undefined) => ['workflow', 'jobs', 'detail', id] as const,
  jobChain: (traceId: string | undefined) => ['workflow', 'jobs', 'chain', traceId] as const,
  jobRuntimeStatus: ['workflow', 'jobs', 'runtime-status'] as const,
  jobSummary: ['workflow', 'jobs', 'summary'] as const,
  jobFailureClusters: (dimension: string | undefined) => ['workflow', 'jobs', 'failure-clusters', dimension] as const,
  compensations: ['workflow', 'monitor', 'compensations'] as const,
  compensationLists: ['workflow', 'monitor', 'compensations', 'list'] as const,
  compensationList: (params: WorkflowCompensationListParams) => ['workflow', 'monitor', 'compensations', 'list', params] as const,
  compensationDetail: (id: number | undefined) => ['workflow', 'monitor', 'compensations', 'detail', id] as const,
  engine: ['workflow', 'monitor', 'engine'] as const,
  engineDiagnostics: (params: WorkflowEngineDiagnosticsParams) => ['workflow', 'monitor', 'engine', 'diagnostics', params] as const,
};

export function useWorkflowMonitorList(params: WorkflowMonitorListParams) {
  return useQuery({
    queryKey: workflowMonitorKeys.monitorList(params),
    queryFn: () => request.get<WorkflowMonitorResponse>(`/api/workflows/instances/all${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowTaskMonitorList(params: WorkflowTaskMonitorParams) {
  return useQuery({
    queryKey: workflowMonitorKeys.taskMonitorList(params),
    queryFn: () => request.get<WorkflowTaskMonitorResult>(`/api/workflows/tasks/monitor${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowInstanceDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.monitorDetail(id),
    queryFn: () => request.get<WorkflowInstance>(`/api/workflows/instances/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useWorkflowDefinitionDetail(id: number | undefined, enabled = true, options?: { silent?: boolean }) {
  return useQuery({
    queryKey: workflowMonitorKeys.definitionDetail(id),
    queryFn: () => request.get<WorkflowDefinition>(`/api/workflows/definitions/${id}`, { silent: options?.silent }).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useWorkflowRuntimeDiagnostics(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.diagnostics(id),
    queryFn: () => request.get<WorkflowRuntimeDiagnostics>(`/api/workflows/instances/${id}/diagnostics`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useWorkflowInstanceTrace(instanceId: number, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.trace(instanceId),
    queryFn: () => request.get<WorkflowInstanceTrace>(`/api/workflows/instances/${instanceId}/trace`).then(unwrap),
    enabled,
  });
}

export function useWorkflowAnalytics(definitionId: number | undefined) {
  return useQuery({
    queryKey: workflowMonitorKeys.analytics(definitionId),
    queryFn: () => request.get<WorkflowAnalytics>(`/api/workflows/instances/analytics${toQueryString({ definitionId })}`).then(unwrap),
  });
}

export function useWorkflowOverdueTasks(definitionId: number | undefined) {
  return useQuery({
    queryKey: workflowMonitorKeys.overdue(definitionId),
    queryFn: () =>
      request.get<PaginatedResponse<WorkflowOverdueTask>>(`/api/workflows/instances/overdue${toQueryString({ pageSize: 50, definitionId })}`).then(unwrap),
  });
}

export function useWorkflowJobList(params: WorkflowJobListParams) {
  return useQuery({
    queryKey: workflowMonitorKeys.jobList(params),
    queryFn: () => request.get<PaginatedResponse<WorkflowJob>>(`/api/workflows/engine/jobs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowJobDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.jobDetail(id),
    queryFn: () => request.get<WorkflowJobDetail>(`/api/workflows/engine/jobs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useWorkflowJobChain(traceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.jobChain(traceId),
    queryFn: () => request.get<WorkflowJobChain>(`/api/workflows/engine/jobs/chain/${encodeURIComponent(traceId ?? '')}`).then(unwrap),
    enabled: enabled && !!traceId,
  });
}

export function useWorkflowJobRuntimeStatus() {
  return useQuery({
    queryKey: workflowMonitorKeys.jobRuntimeStatus,
    queryFn: () => request.get<WorkflowJobRuntimeStatus>('/api/workflows/engine/jobs/runtime-status').then(unwrap),
  });
}

export function useWorkflowJobSummary() {
  return useQuery({
    queryKey: workflowMonitorKeys.jobSummary,
    queryFn: () => request.get<WorkflowJobSummaryItem[]>('/api/workflows/engine/jobs/summary').then(unwrap),
  });
}

export function useWorkflowJobFailureClusters(dimension: string | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.jobFailureClusters(dimension),
    queryFn: () => request.get<FailureCluster[]>(`/api/workflows/engine/jobs/failure-clusters${toQueryString({ dimension })}`).then(unwrap),
    enabled: enabled && !!dimension,
  });
}

export function useWorkflowCompensationList(params: WorkflowCompensationListParams) {
  return useQuery({
    queryKey: workflowMonitorKeys.compensationList(params),
    queryFn: () => request.get<PaginatedResponse<WorkflowCompensation>>(`/api/workflows/compensation/list${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowCompensationDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowMonitorKeys.compensationDetail(id),
    queryFn: () => request.get<WorkflowCompensationDetail>(`/api/workflows/compensation/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useWorkflowEngineDiagnostics(params: WorkflowEngineDiagnosticsParams, refetchInterval: number | false) {
  return useQuery({
    queryKey: workflowMonitorKeys.engineDiagnostics(params),
    queryFn: async () => {
      const [introspection, history] = await Promise.all([
        request.get<WorkflowEngineIntrospection>(`/api/workflows/engine/introspection${toQueryString({ thresholdMinutes: params.thresholdMinutes })}`).then(unwrap),
        request.get<WorkflowEngineHealthHistory>(`/api/workflows/engine/health-history${toQueryString({ hours: params.historyHours })}`).then(unwrap),
      ]);
      return { introspection, history, fetchedAt: Date.now() };
    },
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

/**
 * 实例状态变更（挂起/恢复/终止/迁移等，URL 由调用方给出）。
 * 无法从 URL 反推具体实例，故失效整个监控子树；作业、补偿、引擎诊断不受影响。
 */
export function useWorkflowStateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, body, method = 'post' }: { url: string; body?: unknown; method?: 'post' | 'delete' }) =>
      (method === 'delete' ? request.delete<null>(url, body) : request.post<null>(url, body)).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowMonitorKeys.monitor }),
  });
}

export function useWorkflowMigratePreflight() {
  return useMutation({
    mutationFn: (id: number) =>
      request.get<{ migratable: boolean; fromVersion: number; toVersion: number; blocked: string[] }>(`/api/workflows/instances/${id}/migrate/preflight`).then(unwrap),
  });
}

export function useWorkflowJobBatchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ids }: { action: 'retry' | 'skip'; ids: number[] }) =>
      request.post<WorkflowJobBatchResult>(`/api/workflows/engine/jobs/batch-${action}`, { ids }).then(unwrap),
    // 作业重试/跳过只改变作业子树；流程定义下拉、实例监控列表不受影响
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowMonitorKeys.jobs }),
  });
}

export function useWorkflowJobActionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'retry' | 'skip' }) =>
      request.post<WorkflowJob>(`/api/workflows/engine/jobs/${id}/${action}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowMonitorKeys.jobs }),
  });
}

export function useWorkflowJobReplayPreview() {
  return useMutation({
    mutationFn: (body: object) => request.post<{ matched: number }>('/api/workflows/engine/jobs/replay-preview', body).then(unwrap),
  });
}

export function useWorkflowJobReplayDead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => request.post<WorkflowJobReplayResult>('/api/workflows/engine/jobs/replay-dead', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowMonitorKeys.jobs }),
  });
}

export function useWorkflowCompensationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: 'resolve' | 'resume' | 'retry' | 'note'; body?: unknown }) =>
      request.post<unknown>(`/api/workflows/compensation/${id}/${action}`, body ?? {}).then(unwrap),
    // 补偿处理只影响补偿子树
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowMonitorKeys.compensations }),
  });
}

export function useWorkflowEngineActionPreview() {
  return useMutation({
    mutationFn: ({ key, filter }: { key: WorkflowEngineActionKey; filter: { instanceId?: number; olderThanMinutes?: number; limit: number } }) =>
      request.post<WorkflowEngineActionPreview>(`/api/workflows/engine/actions/${key}/preview`, filter).then(unwrap),
  });
}

/**
 * 引擎维护动作（清理僵死实例、重投事件等）：影响面横跨实例与作业，
 * 但不涉及流程定义下拉，故失效监控与作业两棵子树。
 */
export function useWorkflowEngineAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, filter }: { key: WorkflowEngineActionKey; filter: { instanceId?: number; olderThanMinutes?: number; limit: number } }) =>
      request.post<WorkflowEngineActionResult>(`/api/workflows/engine/actions/${key}`, filter).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowMonitorKeys.monitor });
      void qc.invalidateQueries({ queryKey: workflowMonitorKeys.jobs });
    },
  });
}

export function useWorkflowBatchRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkflowRecoveryBatchInput) => request.post<WorkflowRecoveryBatchResult>('/api/workflows/instances/batch-skip-stuck', body).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowMonitorKeys.monitor });
      void qc.invalidateQueries({ queryKey: workflowMonitorKeys.jobs });
    },
  });
}

export function useWorkflowHandoverPreview() {
  return useMutation({
    mutationFn: (fromUserId: number) =>
      request.get<WorkflowHandoverPreview>(`/api/workflows/tasks/handover-preview${toQueryString({ fromUserId })}`).then(unwrap),
  });
}

export function useWorkflowHandover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { fromUserId: number; toUserId: number; disableDelegations?: boolean; comment?: string }) =>
      request.post<WorkflowHandoverResult>('/api/workflows/tasks/handover', body, {
        headers: { 'X-Idempotency-Key': `workflow-handover-${body.fromUserId}-${body.toUserId}` },
      }).then(unwrap),
    onSuccess: () => {
      // 交接改写任务归属：任务列表、实例、监控视图都要回源；可选地停用委托
      void qc.invalidateQueries({ queryKey: ['workflow', 'tasks'] });
      void qc.invalidateQueries({ queryKey: ['workflow', 'instances'] });
      void qc.invalidateQueries({ queryKey: ['workflow', 'delegations'] });
      void qc.invalidateQueries({ queryKey: workflowMonitorKeys.monitor });
    },
  });
}
