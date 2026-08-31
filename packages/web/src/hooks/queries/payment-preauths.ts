import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentPreauth, PaymentPreauthMethod } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface PaymentPreauthListParams {
  applicationId: number;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  channel?: string;
}

export const paymentPreauthKeys = {
  all: ['payment-preauths'] as const,
  lists: ['payment-preauths', 'list'] as const,
  list: (params: PaymentPreauthListParams) => ['payment-preauths', 'list', params] as const,
};

export function usePaymentPreauthList(params: PaymentPreauthListParams, enabled = true) {
  return useQuery({
    queryKey: paymentPreauthKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentPreauth>>(`/api/payment/preauths${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreatePaymentPreauth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { applicationId: number; payMethod: PaymentPreauthMethod; currency: 'CNY'; payerAccount: string; subject: string; frozenAmount: number; bizType?: string; bizId: string; remark?: string }) =>
      request.post<PaymentPreauth>('/api/payment/preauths', values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentPreauthKeys.all }),
  });
}

export function useCapturePaymentPreauth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId, captureAmount }: { id: number; applicationId: number; captureAmount?: number }) =>
      request.post<PaymentPreauth>(`/api/payment/preauths/${id}/capture${toQueryString({ applicationId })}`, { captureAmount }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentPreauthKeys.all }),
  });
}

export function useReleasePaymentPreauth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentPreauth>(`/api/payment/preauths/${id}/release${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentPreauthKeys.all }),
  });
}

export function useRecoverPaymentPreauth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentPreauth>(`/api/payment/preauths/${id}/recover${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentPreauthKeys.all }),
  });
}
