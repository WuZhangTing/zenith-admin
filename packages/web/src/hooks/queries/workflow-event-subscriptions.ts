import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { WorkflowEventDelivery, WorkflowEventSubscription, WorkflowEventSubscriptionTestResult, WorkflowEventType } from '@zenith/shared/workflow';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WorkflowEventSubscriptionListParams extends CrudListParams {
  keyword?: string;
  definitionId?: number;
  enabled?: 'true' | 'false';
}

export interface WorkflowEventDeliveryListParams {
  page: number;
  pageSize: number;
  subscriptionId: number | null;
}

export interface WorkflowEventDeliveryReplayPayload {
  subscriptionId: number;
  eventType?: WorkflowEventType;
  status?: 'success' | 'failed' | 'pending';
  startAt?: string;
  endAt?: string;
}

/** 投递记录随订阅增删一并失效（删除订阅级联清理投递） */
const DELIVERIES_KEY = ['workflow', 'event-subscriptions', 'deliveries'] as const;

const crud = createCrudQueries<WorkflowEventSubscription, WorkflowEventSubscriptionListParams, Record<string, unknown>>({
  resource: 'workflow-event-subscriptions',
  // 保留原有嵌套 key：运行时流程用 invalidateQueries({ queryKey: ['workflow'] }) 广播失效
  keyPrefix: ['workflow', 'event-subscriptions'],
  path: '/api/workflows/event-subscriptions',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: DELIVERIES_KEY }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: DELIVERIES_KEY }),
});

export const workflowEventSubscriptionKeys = {
  ...crud.keys,
  deliveries: DELIVERIES_KEY,
  deliveryList: (params: WorkflowEventDeliveryListParams) => ['workflow', 'event-subscriptions', 'deliveries', params] as const,
};

export const useWorkflowEventSubscriptionList = crud.useList;
export const useWorkflowEventSubscriptionDetail = crud.useDetail;
export const useSaveWorkflowEventSubscription = crud.useSave;
export const useDeleteWorkflowEventSubscriptions = crud.useDelete;

export function useWorkflowEventDeliveries(params: WorkflowEventDeliveryListParams, enabled = true) {
  return useQuery({
    queryKey: workflowEventSubscriptionKeys.deliveryList(params),
    queryFn: () =>
      request
        .get<PaginatedResponse<WorkflowEventDelivery>>(`/api/workflows/event-subscriptions/deliveries/list${toQueryString(params)}`)
        .then(unwrap),
    enabled: enabled && params.subscriptionId !== null,
    placeholderData: keepPreviousData,
  });
}

export function useToggleWorkflowEventSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      request.patch<WorkflowEventSubscription>(`/api/workflows/event-subscriptions/${id}/toggle`, { enabled }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowEventSubscriptionKeys.all }),
  });
}

export function useWorkflowEventSubscriptionSecret() {
  return useMutation({
    mutationFn: (id: number) => request.get<{ secret: string }>(`/api/workflows/event-subscriptions/${id}/secret`).then(unwrap),
  });
}

export function useRetryWorkflowEventDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/workflows/event-subscriptions/deliveries/${id}/retry`, {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowEventSubscriptionKeys.deliveries }),
  });
}

export function useReplayWorkflowEventDeliveries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkflowEventDeliveryReplayPayload) =>
      request.post<{ count: number }>('/api/workflows/event-subscriptions/deliveries/replay', payload).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowEventSubscriptionKeys.deliveries }),
  });
}

/** 测试投递：同步发送样例事件并返回 HTTP 结果（不产生投递记录） */
export function useTestWorkflowEventSubscription() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<WorkflowEventSubscriptionTestResult>(`/api/workflows/event-subscriptions/${id}/test`, {}).then(unwrap),
  });
}
