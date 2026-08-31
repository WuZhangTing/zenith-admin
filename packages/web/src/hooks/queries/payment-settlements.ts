import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentSettlementBatch, PaymentSettlementItem, PaymentSettlementStatus } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface PaymentSettlementListParams {
  page: number;
  pageSize: number;
  channel?: string;
  status?: string;
}

export interface GeneratePaymentSettlementValues {
  applicationId: number;
  channelConfigId: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  remark?: string;
}

export interface UpdatePaymentSettlementStatusValues {
  id: number;
  status: PaymentSettlementStatus;
  failureReason?: string;
  payoutReference?: string;
}

export const paymentSettlementKeys = {
  all: ['payment-settlements'] as const,
  lists: ['payment-settlements', 'list'] as const,
  list: (params: PaymentSettlementListParams) => ['payment-settlements', 'list', params] as const,
  detail: (id: number | undefined) => ['payment-settlements', 'detail', id] as const,
  items: (id: number | undefined) => ['payment-settlements', 'items', id] as const,
};

export function usePaymentSettlementList(params: PaymentSettlementListParams) {
  return useQuery({
    queryKey: paymentSettlementKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentSettlementBatch>>(`/api/payment/settlements${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentSettlementItems(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentSettlementKeys.items(id),
    queryFn: () => request.get<PaymentSettlementItem[]>(`/api/payment/settlements/${id}/items`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useGeneratePaymentSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: GeneratePaymentSettlementValues) =>
      request.post<PaymentSettlementBatch>('/api/payment/settlements/generate', values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentSettlementKeys.all }),
  });
}

export function useUpdatePaymentSettlementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }: UpdatePaymentSettlementStatusValues) =>
      request.post<PaymentSettlementBatch>(`/api/payment/settlements/${id}/status`, values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentSettlementKeys.all }),
  });
}

export function useDeletePaymentSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/payment/settlements/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentSettlementKeys.all }),
  });
}
