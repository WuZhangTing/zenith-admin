import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentRiskHit, PaymentRiskReview, PaymentRiskRule } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentRiskRuleListParams extends CrudListParams {
  scope?: string;
  status?: string;
}

export interface PaymentRiskHitListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  action?: string;
  dimension?: string;
  channel?: string;
}

export interface PaymentRiskReviewListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  channel?: string;
}

/** 命中记录与人工复核清单随规则增删改一并失效（沿用原 .all 粗失效的覆盖面） */
const HIT_LISTS_KEY = ['payment-risk', 'hits'] as const;
const REVIEW_LISTS_KEY = ['payment-risk', 'reviews'] as const;

const crud = createCrudQueries<PaymentRiskRule, PaymentRiskRuleListParams>({
  resource: 'payment-risk',
  path: '/api/payment/risk-rules',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => {
    void qc.invalidateQueries({ queryKey: HIT_LISTS_KEY });
    void qc.invalidateQueries({ queryKey: REVIEW_LISTS_KEY });
  },
  onDeleted: (qc) => {
    void qc.invalidateQueries({ queryKey: HIT_LISTS_KEY });
    void qc.invalidateQueries({ queryKey: REVIEW_LISTS_KEY });
  },
});

export const paymentRiskKeys = {
  ...crud.keys,
  hitLists: HIT_LISTS_KEY,
  hitList: (params: PaymentRiskHitListParams) => ['payment-risk', 'hits', params] as const,
  reviewLists: REVIEW_LISTS_KEY,
  reviewList: (params: PaymentRiskReviewListParams) => ['payment-risk', 'reviews', params] as const,
};

export const usePaymentRiskRuleList = crud.useList;
export const useSavePaymentRiskRule = crud.useSave;
export const useDeletePaymentRiskRules = crud.useDelete;

export function usePaymentRiskHitList(params: PaymentRiskHitListParams) {
  return useQuery({
    queryKey: paymentRiskKeys.hitList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentRiskHit>>(`/api/payment/risk/hits${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentRiskReviewList(params: PaymentRiskReviewListParams) {
  return useQuery({
    queryKey: paymentRiskKeys.reviewList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentRiskReview>>(`/api/payment/risk/reviews${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useApprovePaymentRiskReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remark }: { id: number; remark?: string }) =>
      request.post<PaymentRiskReview>(`/api/payment/risk/reviews/${id}/approve`, { remark }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentRiskKeys.all }),
  });
}

export function useRejectPaymentRiskReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, remark }: { id: number; remark?: string }) =>
      request.post<PaymentRiskReview>(`/api/payment/risk/reviews/${id}/reject`, { remark }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentRiskKeys.all }),
  });
}
