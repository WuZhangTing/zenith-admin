import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentWebhookDelivery, PaymentWebhookEndpoint } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentWebhookEndpointListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export interface PaymentWebhookDeliveryListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

/** 投递记录随端点增删改一并失效（沿用原 .all 粗失效的覆盖面） */
const DELIVERY_LISTS_KEY = ['payment-webhooks', 'deliveries', 'list'] as const;

const crud = createCrudQueries<PaymentWebhookEndpoint, PaymentWebhookEndpointListParams, Partial<PaymentWebhookEndpoint> & { secret?: string }>({
  resource: 'payment-webhook-endpoints',
  keyPrefix: ['payment-webhooks', 'endpoints'],
  path: '/api/payment/webhooks/endpoints',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: DELIVERY_LISTS_KEY }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: DELIVERY_LISTS_KEY }),
});

export const paymentWebhookKeys = {
  ...crud.keys,
  // 端点与投递记录共享 ['payment-webhooks'] 根命名空间（重投等命令按根广播）
  all: ['payment-webhooks'] as const,
  endpointLists: crud.keys.lists,
  endpointList: crud.keys.list,
  endpointDetail: crud.keys.detail,
  deliveryLists: DELIVERY_LISTS_KEY,
  deliveryList: (params: PaymentWebhookDeliveryListParams) => ['payment-webhooks', 'deliveries', 'list', params] as const,
};

export const usePaymentWebhookEndpoints = crud.useList;
export const usePaymentWebhookEndpointDetail = crud.useDetail;
export const useSavePaymentWebhookEndpoint = crud.useSave;
export const useDeletePaymentWebhookEndpoints = crud.useDelete;

export function usePaymentWebhookDeliveries(params: PaymentWebhookDeliveryListParams) {
  return useQuery({
    queryKey: paymentWebhookKeys.deliveryList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentWebhookDelivery>>(`/api/payment/webhooks/deliveries${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useRedeliverPaymentWebhookDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<PaymentWebhookDelivery>(`/api/payment/webhooks/deliveries/${id}/redeliver`, {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentWebhookKeys.all }),
  });
}

/** 向端点发送 webhook.test 测试事件（真实签名投递 + 落投递日志） */
export function useTestPaymentWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<PaymentWebhookDelivery>(`/api/payment/webhooks/endpoints/${id}/test`, {}).then(unwrap),
    // 测试会产生一条新投递记录
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentWebhookKeys.deliveryLists }),
  });
}
