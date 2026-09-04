import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BizPayDemo, BizPayDemoStatus } from '@zenith/shared/biz';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { CreatePaymentResult, PaymentMethod } from '@zenith/shared/payment';
import { taskDemoContract } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { useApiMutation } from '@/lib/contract-query';
import { invalidateAsyncTaskState, useAsyncTaskAction, useAsyncTaskItems, useAsyncTaskTypes } from './async-tasks';

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

/**
 * 任务演示打的是任务中心同一批端点（类型元数据、明细项、取消/恢复/重启），
 * 直接复用任务中心域 hooks 以共享缓存与失效语义，而不是另起 `['biz-task-demo']` 造成同一端点两份副本。
 */
export {
  useAsyncTaskAction as useBizTaskDemoAction,
  useAsyncTaskItems as useBizTaskDemoItems,
  useAsyncTaskTypes as useBizTaskDemoTypes,
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
  return useApiMutation(taskDemoContract.submit, { invalidate: invalidateAsyncTaskState });
}
