import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { AsyncTask, AsyncTaskItem, AsyncTaskItemStatus, AsyncTaskStats, AsyncTaskTypeMeta } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface AsyncTaskListParams {
  page: number;
  pageSize: number;
  taskType?: string;
  status?: string;
  keyword?: string;
  /** 任务内容关键字：匹配入参 payload 与产出 result */
  content?: string;
  createdBy?: string;
}

export interface AsyncTaskItemsParams {
  taskId: number;
  page: number;
  pageSize: number;
  status?: string;
}

export const asyncTaskKeys = {
  all: ['async-tasks'] as const,
  lists: ['async-tasks', 'list'] as const,
  list: (params: AsyncTaskListParams) => ['async-tasks', 'list', params] as const,
  stats: ['async-tasks', 'stats'] as const,
  types: ['async-tasks', 'types'] as const,
  items: ['async-tasks', 'items'] as const,
  itemList: (params: AsyncTaskItemsParams) => ['async-tasks', 'items', params] as const,
};

export function useAsyncTaskList(params: AsyncTaskListParams, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: asyncTaskKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<AsyncTask>>(`/api/async-tasks${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
}

export function useAsyncTaskStats(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: asyncTaskKeys.stats,
    queryFn: () => request.get<AsyncTaskStats>('/api/async-tasks/stats', { silent: true }).then(unwrap),
    refetchInterval: options?.refetchInterval,
  });
}

export function useAsyncTaskTypes() {
  return useQuery({
    queryKey: asyncTaskKeys.types,
    queryFn: () => request.get<AsyncTaskTypeMeta[]>('/api/async-tasks/types', { silent: true }).then(unwrap),
  });
}

export function useAsyncTaskItems(params: AsyncTaskItemsParams, enabled = true) {
  return useQuery({
    queryKey: asyncTaskKeys.itemList(params),
    queryFn: () => request.get<PaginatedResponse<AsyncTaskItem>>(`/api/async-tasks/${params.taskId}/items${toQueryString({ page: params.page, pageSize: params.pageSize, status: params.status })}`, { silent: true }).then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/**
 * 任务状态变更（取消 / 恢复 / 重启 / 删除 / 批量 / 清理）的公共失效面。
 *
 * 覆盖列表、统计与明细项，但**不含 `types`**：任务类型元数据由
 * `useUpdateAsyncTaskTypeConfig` 单独维护，不随任务状态变化。
 * 任务中心一屏同时挂着 list / stats / types / items，用 `.all` 会连带把 types 打回源。
 *
 * 导出供 `biz-pay-demo.ts` 复用——任务演示页打的是同一批 `/api/async-tasks` 端点，
 * 刻意共享同一命名空间以复用缓存，失效语义也必须跟着一致。
 */
export function invalidateAsyncTaskState(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: asyncTaskKeys.lists });
  void qc.invalidateQueries({ queryKey: asyncTaskKeys.stats });
  void qc.invalidateQueries({ queryKey: asyncTaskKeys.items });
}

export function useAsyncTaskAction(action: 'cancel' | 'resume' | 'restart') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<AsyncTask>(`/api/async-tasks/${id}/${action}`).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useDeleteAsyncTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/async-tasks/${id}`).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useBatchCancelAsyncTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.post<{ affected: number }>('/api/async-tasks/batch-cancel', { ids }).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useBatchDeleteAsyncTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.post<{ affected: number }>('/api/async-tasks/batch-delete', { ids }).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useCleanupAsyncTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<{ cleaned: number }>('/api/async-tasks/cleanup').then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useUpdateAsyncTaskTypeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskType, values }: { taskType: string; values: Partial<AsyncTaskTypeMeta> }) =>
      request.put<AsyncTaskTypeMeta>(`/api/async-tasks/types/${taskType}/config`, values).then(unwrap),
    // 只改类型配置；已产生的任务实例与统计不受影响
    onSuccess: () => qc.invalidateQueries({ queryKey: asyncTaskKeys.types }),
  });
}

export type { AsyncTaskItemStatus };
