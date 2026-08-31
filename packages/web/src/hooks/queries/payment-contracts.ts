import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { PaymentContract, PaymentDeductPlan } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { paymentOrderKeys } from './payment-orders';

export interface PaymentContractListParams {
  applicationId: number;
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  channel?: string;
  planId?: number;
  startTime?: string;
  endTime?: string;
}

export interface DeductPlanListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export interface DeductResult {
  orderNo?: string | null;
  deductStatus: 'success' | 'processing' | 'failed';
  failReason?: string | null;
}

export interface SignContractResult {
  contract: PaymentContract;
  firstDeduct?: DeductResult | null;
}

export const paymentContractKeys = {
  all: ['payment-contracts'] as const,
  lists: ['payment-contracts', 'list'] as const,
  list: (params: PaymentContractListParams) => ['payment-contracts', 'list', params] as const,
  detail: (id: number | undefined, applicationId?: number) => ['payment-contracts', 'detail', id, applicationId] as const,
  planAll: ['payment-contracts', 'plans'] as const,
  planLists: ['payment-contracts', 'plans', 'list'] as const,
  planList: (params: DeductPlanListParams) => ['payment-contracts', 'plans', 'list', params] as const,
  planOptions: ['payment-contracts', 'plans', 'options'] as const,
};

// ─── 签约协议 ─────────────────────────────────────────────────────────────────

/**
 * 协议状态变更（签约 / 解约 / 暂停 / 恢复 / 扣款）的公共失效面。
 *
 * 只触及协议自身：列表与详情。扣款计划（`planLists` / `planOptions`，后者是
 * 新建协议弹窗的下拉源）不随协议状态变化，不应被打回源。
 */
function invalidateContract(qc: QueryClient, id?: number, applicationId?: number) {
  if (id !== undefined) void qc.invalidateQueries({ queryKey: paymentContractKeys.detail(id, applicationId) });
  void qc.invalidateQueries({ queryKey: paymentContractKeys.lists });
}

export function usePaymentContractList(params: PaymentContractListParams, enabled = true) {
  return useQuery({
    queryKey: paymentContractKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<PaymentContract>>(`/api/payment/contracts${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCreatePaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: { applicationId: number; planId: number; payMethod: string; currency: 'CNY'; signerAccount: string; signerName?: string; remark?: string; firstDeductNow: boolean }) =>
      request.post<SignContractResult>('/api/payment/contracts', values).then(unwrap),
    onSuccess: (result) => {
      invalidateContract(qc, result.contract.id, result.contract.appId);
      // firstDeductNow 会立即产生一笔支付单
      if (result.firstDeduct) void qc.invalidateQueries({ queryKey: paymentOrderKeys.lists });
    },
  });
}

export function useTerminatePaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentContract>(`/api/payment/contracts/${id}/terminate${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: (_data, values) => invalidateContract(qc, values.id, values.applicationId),
  });
}

export function usePausePaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentContract>(`/api/payment/contracts/${id}/pause${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: (_data, values) => invalidateContract(qc, values.id, values.applicationId),
  });
}

export function useResumePaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentContract>(`/api/payment/contracts/${id}/resume${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: (_data, values) => invalidateContract(qc, values.id, values.applicationId),
  });
}

export function useDeductPaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<DeductResult & { contract: PaymentContract }>(`/api/payment/contracts/${id}/deduct${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: (_data, values) => {
      // 扣款会改写 lastDeductAt / nextDeductAt / failCount 并生成一笔支付单
      invalidateContract(qc, values.id, values.applicationId);
      void qc.invalidateQueries({ queryKey: paymentOrderKeys.lists });
    },
  });
}

export function useRecoverPaymentContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, applicationId }: { id: number; applicationId: number }) =>
      request.post<PaymentContract>(`/api/payment/contracts/${id}/recover${toQueryString({ applicationId })}`).then(unwrap),
    onSuccess: (_data, values) => invalidateContract(qc, values.id, values.applicationId),
  });
}

// ─── 扣款计划 ─────────────────────────────────────────────────────────────────

/**
 * 扣款计划变更的公共失效面。
 *
 * 除计划列表与下拉源外，还必须失效协议列表：协议列表渲染 `planName` 派生列
 * （PaymentContractsPage「扣款计划」列），改名后不失效会显示旧名称。
 */
function invalidatePlan(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: paymentContractKeys.planLists });
  void qc.invalidateQueries({ queryKey: paymentContractKeys.planOptions });
  void qc.invalidateQueries({ queryKey: paymentContractKeys.lists });
}

export function useDeductPlanList(params: DeductPlanListParams) {
  return useQuery({
    queryKey: paymentContractKeys.planList(params),
    queryFn: () => request.get<PaginatedResponse<PaymentDeductPlan>>(`/api/payment/deduct-plans${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useAllDeductPlans() {
  return useQuery({
    queryKey: paymentContractKeys.planOptions,
    queryFn: () => request.get<PaymentDeductPlan[]>('/api/payment/deduct-plans/all').then(unwrap),
  });
}

export function useCreateDeductPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<PaymentDeductPlan>) => request.post<PaymentDeductPlan>('/api/payment/deduct-plans', values).then(unwrap),
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useUpdateDeductPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<PaymentDeductPlan> }) =>
      request.put<PaymentDeductPlan>(`/api/payment/deduct-plans/${id}`, values).then(unwrap),
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useDeleteDeductPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete(`/api/payment/deduct-plans/${id}`).then(unwrap),
    onSuccess: () => invalidatePlan(qc),
  });
}
