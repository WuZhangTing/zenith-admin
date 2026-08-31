import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentTransfer } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface PaymentTransferListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  channel?: string;
  status?: string;
  approvalStatus?: string;
}

export interface PaymentTransferSummary {
  totalAmount: number;
  successCount: number;
  processingCount: number;
  failedCount: number;
}

export interface CreatePaymentTransferValues {
  applicationId: number;
  channel: string;
  currency: 'CNY';
  receiverAccount: string;
  receiverName?: string;
  amount: number;
  remark: string;
  bizType?: string;
  bizId?: string;
  idempotencyKey: string;
}

export const paymentTransferKeys = {
  all: ['payment-transfers'] as const,
  lists: ['payment-transfers', 'list'] as const,
  list: (params: PaymentTransferListParams) => ['payment-transfers', 'list', params] as const,
  summary: ['payment-transfers', 'summary'] as const,
  detail: (id: number | undefined) => ['payment-transfers', 'detail', id] as const,
};

export function usePaymentTransferList(params: PaymentTransferListParams) {
  return useQuery({
    queryKey: paymentTransferKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentTransfer>>(`/api/payment/transfers${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentTransferSummary(enabled = true) {
  return useQuery({
    queryKey: paymentTransferKeys.summary,
    queryFn: () => request.get<PaymentTransferSummary>('/api/payment/transfers/summary').then(unwrap),
    enabled,
  });
}

export function useCreatePaymentTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...values }: CreatePaymentTransferValues) =>
      request.post<PaymentTransfer>('/api/payment/transfers', values, { headers: { 'X-Idempotency-Key': idempotencyKey } }).then(unwrap),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: paymentTransferKeys.lists }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.summary }),
      ]);
    },
  });
}

export function useQueryPaymentTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<PaymentTransfer>(`/api/payment/transfers/${id}/query`).then(unwrap),
    onSuccess: async (transfer) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: paymentTransferKeys.lists }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.summary }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.detail(transfer.id) }),
      ]);
    },
  });
}

export function useApprovePaymentTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) =>
      request.post<PaymentTransfer>(`/api/payment/transfers/${id}/approve`, { remark }).then(unwrap),
    onSuccess: async (transfer) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: paymentTransferKeys.lists }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.summary }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.detail(transfer.id) }),
      ]);
    },
  });
}

export function useRejectPaymentTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remark }: { id: number; remark: string }) =>
      request.post<PaymentTransfer>(`/api/payment/transfers/${id}/reject`, { remark }).then(unwrap),
    onSuccess: async (transfer) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: paymentTransferKeys.lists }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.summary }),
        qc.invalidateQueries({ queryKey: paymentTransferKeys.detail(transfer.id) }),
      ]);
    },
  });
}
