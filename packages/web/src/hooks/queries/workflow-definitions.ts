import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowVersionDiff } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface WorkflowDefinitionListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  categoryId?: number;
}

export interface WorkflowDefinitionImportPayload {
  name: string;
  description?: string | null;
  categoryName?: string | null;
  flowData: unknown;
  form?: unknown;
}

export interface WorkflowVersionDiffParams {
  definitionId: number | null | undefined;
  left: number;
  right: number;
}

export const workflowDefinitionKeys = {
  all: ['workflow', 'definitions'] as const,
  lists: ['workflow', 'definitions', 'list'] as const,
  list: (params: WorkflowDefinitionListParams) => ['workflow', 'definitions', 'list', params] as const,
  published: ['workflow', 'definitions', 'published'] as const,
  detail: (id: number | null | undefined) => ['workflow', 'definitions', 'detail', id ?? null] as const,
  versions: (definitionId: number | null | undefined, params?: { page: number; pageSize: number }) =>
    ['workflow', 'definitions', 'versions', definitionId ?? null, params ?? null] as const,
  diff: (params: WorkflowVersionDiffParams) => ['workflow', 'definitions', 'diff', params] as const,
};

export function useWorkflowDefinitionList(params: WorkflowDefinitionListParams) {
  return useQuery({
    queryKey: workflowDefinitionKeys.list(params),
    queryFn: () =>
      request.get<PaginatedResponse<WorkflowDefinition>>(`/api/workflows/definitions${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/**
 * 已发布流程定义（启动列表、日程绑定、关联流程选择器等共用）。
 *
 * 这是该端点的唯一入口：designer 与 tasks 曾各自建 key 缓存同一份数据，
 * 而发布只失效 `workflowDefinitionKeys.all`，前缀盖不到那两个 key，
 * 新发布的定义在它们的下拉里最长 5 分钟不出现。
 *
 * `staleTime` 是 observer 级选项，不同调用方可各自指定；但 `silent` 之类会进入
 * queryFn 的参数刻意不开放——同一个 key 配不同 queryFn 会让实际行为取决于哪个
 * observer 最后注册。
 */
export function usePublishedWorkflowDefinitions(options?: { enabled?: boolean; staleTime?: number }) {
  return useQuery({
    queryKey: workflowDefinitionKeys.published,
    queryFn: () => request.get<WorkflowDefinition[]>('/api/workflows/definitions/published').then(unwrap),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime,
  });
}

export function useWorkflowDefinitionDetail(id: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowDefinitionKeys.detail(id),
    queryFn: () => request.get<WorkflowDefinition>(`/api/workflows/definitions/${id}`).then(unwrap),
    enabled: enabled && !!id,
  });
}

export function useWorkflowDefinitionVersions(
  definitionId: number | null | undefined,
  params: { page: number; pageSize: number },
  enabled = true,
) {
  return useQuery({
    queryKey: workflowDefinitionKeys.versions(definitionId, params),
    queryFn: () =>
      request.get<PaginatedResponse<WorkflowDefinitionVersion>>(`/api/workflows/definitions/${definitionId}/versions${toQueryString(params)}`).then(unwrap),
    enabled: enabled && !!definitionId,
    placeholderData: keepPreviousData,
  });
}

export function useWorkflowDefinitionDiff(params: WorkflowVersionDiffParams, enabled = true) {
  return useQuery({
    queryKey: workflowDefinitionKeys.diff(params),
    queryFn: () =>
      request
        .get<WorkflowVersionDiff>(`/api/workflows/definitions/${params.definitionId}/diff${toQueryString({ left: params.left, right: params.right })}`)
        .then(unwrap),
    enabled: enabled && !!params.definitionId,
  });
}

function useDefinitionInvalidatingMutation<TVariables, TData = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowDefinitionKeys.all }),
  });
}

export function usePublishWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((id: number) =>
    request.post<unknown>(`/api/workflows/definitions/${id}/publish`, {}).then(unwrap));
}

export function useDisableWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((id: number) =>
    request.post<unknown>(`/api/workflows/definitions/${id}/disable`, {}).then(unwrap));
}

export function useEnableWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((id: number) =>
    request.post<unknown>(`/api/workflows/definitions/${id}/enable`, {}).then(unwrap));
}

export function useDeleteWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((id: number) =>
    request.delete<unknown>(`/api/workflows/definitions/${id}`).then(unwrap));
}

export function useBatchDisableWorkflowDefinitions() {
  return useDefinitionInvalidatingMutation((ids: number[]) =>
    request.post<unknown>('/api/workflows/definitions/batch-disable', { ids }).then(unwrap));
}

export function useBatchEnableWorkflowDefinitions() {
  return useDefinitionInvalidatingMutation((ids: number[]) =>
    request.post<unknown>('/api/workflows/definitions/batch-enable', { ids }).then(unwrap));
}

export function useBatchDeleteWorkflowDefinitions() {
  return useDefinitionInvalidatingMutation((ids: number[]) =>
    request.post<unknown>('/api/workflows/definitions/batch-delete', { ids }).then(unwrap));
}

export function useDuplicateWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((id: number) =>
    request.post<WorkflowDefinition>(`/api/workflows/definitions/${id}/duplicate`, {}).then(unwrap));
}

export function useImportWorkflowDefinition() {
  return useDefinitionInvalidatingMutation((payload: WorkflowDefinitionImportPayload) =>
    request.post<WorkflowDefinition>('/api/workflows/definitions/import', payload).then(unwrap));
}

export function useSaveWorkflowDefinitionAsTemplate() {
  return useDefinitionInvalidatingMutation((payload: { definitionId: number } & Record<string, unknown>) =>
    request.post<unknown>('/api/workflows/templates/save-as', payload).then(unwrap));
}

export function useRestoreWorkflowDefinitionVersion() {
  return useDefinitionInvalidatingMutation(({ definitionId, versionId }: { definitionId: number; versionId: number }) =>
    request.post<WorkflowDefinition>(`/api/workflows/definitions/${definitionId}/versions/${versionId}/restore`, {}).then(unwrap));
}
