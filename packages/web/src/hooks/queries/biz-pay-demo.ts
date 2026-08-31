import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BizPayDemo, BizPayDemoStatus } from '@zenith/shared/biz';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { CreatePaymentResult, PaymentMethod } from '@zenith/shared/payment';
import type { AsyncTask, AsyncTaskItem, AsyncTaskTypeMeta } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { invalidateAsyncTaskState } from './async-tasks';

export interface BizPayDemoListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: BizPayDemoStatus;
}

export const bizPayDemoKeys = {
  all: ['biz-pay-demo'] as const,
  lists: ['biz-pay-demo', 'list'] as const,
  list: (params: BizPayDemoListParams) => ['biz-pay-demo', 'list', params] as const,
};

export interface BizTaskDemoItemsParams {
  taskId: number;
  page: number;
  pageSize: number;
}

/**
 * 任务演示打的是与任务中心同一批 `/api/async-tasks` 端点（类型元数据、明细项、
 * 取消/恢复/重启），因此**刻意复用 `['async-tasks']` 命名空间**共享缓存，
 * 而不是另起 `['biz-task-demo']` 造成同一端点两份副本。
 * 失效语义同样复用 `invalidateAsyncTaskState`。
 */
export const bizTaskDemoKeys = {
  all: ['async-tasks'] as const,
  types: ['async-tasks', 'types'] as const,
  items: ['async-tasks', 'items'] as const,
  itemList: (params: BizTaskDemoItemsParams) => ['async-tasks', 'items', params] as const,
};

export function useBizPayDemoList(params: BizPayDemoListParams) {
  return useQuery({
    queryKey: bizPayDemoKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<BizPayDemo>>(`/api/biz/pay-demos${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useCreateBizPayDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { subject: string; amount: number }) =>
      request.post<BizPayDemo>('/api/biz/pay-demos', values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: bizPayDemoKeys.all }),
  });
}

export function usePayBizPayDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId, payMethod }: { id: number; applicationId: number; payMethod: PaymentMethod }) =>
      request
        .post<{ demo: BizPayDemo; payParams: CreatePaymentResult }>(`/api/biz/pay-demos/${id}/pay`, { applicationId, payMethod })
        .then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: bizPayDemoKeys.all }),
  });
}

export function useSimulateBizPayDemoPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<BizPayDemo>(`/api/biz/pay-demos/${id}/simulate-paid`, {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: bizPayDemoKeys.all }),
  });
}

export function useDeleteBizPayDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/biz/pay-demos/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: bizPayDemoKeys.all }),
  });
}

export function useSubmitTaskDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values:
      | { taskType: 'demo-batch'; totalItems: number; itemDelayMs: number; failAtItem?: number; failEveryN?: number }
      | { taskType: 'demo-serial'; stageDelayMs: number }) =>
      request.post<AsyncTask>('/api/task-demo/submit', values).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}

export function useBizTaskDemoTypes() {
  return useQuery({
    queryKey: bizTaskDemoKeys.types,
    queryFn: () => request.get<AsyncTaskTypeMeta[]>('/api/async-tasks/types', { silent: true }).then(unwrap),
  });
}

export function useBizTaskDemoItems(params: BizTaskDemoItemsParams, enabled = true) {
  return useQuery({
    queryKey: bizTaskDemoKeys.itemList(params),
    queryFn: () =>
      request
        .get<PaginatedResponse<AsyncTaskItem>>(
          `/api/async-tasks/${params.taskId}/items${toQueryString({ page: params.page, pageSize: params.pageSize })}`,
          { silent: true },
        )
        .then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBizTaskDemoAction(action: 'cancel' | 'resume' | 'restart') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<AsyncTask>(`/api/async-tasks/${id}/${action}`).then(unwrap),
    onSuccess: () => invalidateAsyncTaskState(qc),
  });
}
