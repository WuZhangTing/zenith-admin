import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentSharingOrder, PaymentSharingReceiver, PaymentSharingReversal } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentSharingReceiverListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export interface PaymentSharingOrderListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export interface PaymentSharingReversalListParams {
  page: number;
  pageSize: number;
  sharingOrderId?: number;
  status?: string;
  startTime?: string;
  endTime?: string;
}

/** 启用中的分账方下拉源随分账方增删改一并失效；分账单列表不受影响 */
const ENABLED_RECEIVERS_KEY = ['payment-sharing', 'receivers', 'enabled'] as const;

const crud = createCrudQueries<PaymentSharingReceiver, PaymentSharingReceiverListParams>({
  resource: 'payment-sharing-receivers',
  keyPrefix: ['payment-sharing', 'receivers'],
  path: '/api/payment/sharing/receivers',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: ENABLED_RECEIVERS_KEY }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: ENABLED_RECEIVERS_KEY }),
});

export const paymentSharingKeys = {
  ...crud.keys,
  // 分账单与分账方共享 ['payment-sharing'] 根命名空间
  all: ['payment-sharing'] as const,
  receiverLists: crud.keys.lists,
  receiverList: crud.keys.list,
  orderLists: ['payment-sharing', 'orders', 'list'] as const,
  orderList: (params: PaymentSharingOrderListParams) => ['payment-sharing', 'orders', 'list', params] as const,
  reversalLists: ['payment-sharing', 'reversals', 'list'] as const,
  reversalList: (params: PaymentSharingReversalListParams) => ['payment-sharing', 'reversals', 'list', params] as const,
  reversalDetail: (id: number | undefined) => ['payment-sharing', 'reversals', 'detail', id] as const,
  enabledReceivers: ENABLED_RECEIVERS_KEY,
};

export const usePaymentSharingReceivers = crud.useList;
export const useSavePaymentSharingReceiver = crud.useSave;
export const useDeletePaymentSharingReceivers = crud.useDelete;

export function usePaymentSharingOrders(params: PaymentSharingOrderListParams) {
  return useQuery({
    queryKey: paymentSharingKeys.orderList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentSharingOrder>>(`/api/payment/sharing/orders${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentSharingReversals(params: PaymentSharingReversalListParams) {
  return useQuery({
    queryKey: paymentSharingKeys.reversalList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentSharingReversal>>(`/api/payment/sharing/reversals${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentSharingReversalDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentSharingKeys.reversalDetail(id),
    queryFn: () => request.get<PaymentSharingReversal>(`/api/payment/sharing/reversals/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useEnabledPaymentSharingReceivers(enabled = true) {
  return useQuery({
    queryKey: paymentSharingKeys.enabledReceivers,
    queryFn: () =>
      request
        .get<PaginatedResponse<PaymentSharingReceiver>>('/api/payment/sharing/receivers?page=1&pageSize=100&status=enabled')
        .then(unwrap)
        .then((data) => data.list.filter((r) => r.status === 'enabled')),
    staleTime: LOOKUP_STALE_TIME,
    enabled,
  });
}

export function useCreatePaymentSharingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { orderNo: string; receiverId: number; amount?: number; remark?: string }) =>
      request.post<PaymentSharingOrder>('/api/payment/sharing/orders', values).then(unwrap),
    // 新增分账单不改变分账方名单，故不碰 receiverLists 与 enabledReceivers
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentSharingKeys.orderLists }),
  });
}

export function useReversePaymentSharingOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sharingOrderId, idempotencyKey, reason }: { sharingOrderId: number; idempotencyKey: string; reason: string }) =>
      request
        .post<PaymentSharingReversal>(
          `/api/payment/sharing/orders/${sharingOrderId}/reverse`,
          { reason },
          { headers: { 'X-Idempotency-Key': idempotencyKey } },
        )
        .then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentSharingKeys.orderLists });
      void qc.invalidateQueries({ queryKey: paymentSharingKeys.reversalLists });
    },
  });
}

export function useQueryPaymentSharingReversal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<PaymentSharingReversal>(`/api/payment/sharing/reversals/${id}/query`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: paymentSharingKeys.orderLists });
      void qc.invalidateQueries({ queryKey: paymentSharingKeys.reversalLists });
    },
  });
}
