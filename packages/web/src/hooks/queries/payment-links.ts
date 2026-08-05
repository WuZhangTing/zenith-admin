import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePaymentResult, PaymentLink, PaymentLinkPublic } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentLinkListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export interface PublicPaymentLinkPayValues {
  token: string;
  amount?: number;
  payMethod?: string;
}

/** 公开收银台视图按 token 缓存，链接内容变更后一并失效（沿用原 .all 粗失效的覆盖面） */
const PUBLIC_PREFIX = ['payment-links', 'public'] as const;

const crud = createCrudQueries<PaymentLink, PaymentLinkListParams>({
  resource: 'payment-links',
  path: '/api/payment/links',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: PUBLIC_PREFIX }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: PUBLIC_PREFIX }),
});

export const paymentLinkKeys = {
  ...crud.keys,
  public: (token: string | undefined) => ['payment-links', 'public', token] as const,
};

export const usePaymentLinkList = crud.useList;
export const usePaymentLinkDetail = crud.useDetail;
export const useSavePaymentLink = crud.useSave;
export const useDeletePaymentLinks = crud.useDelete;

export function useRotatePaymentLinkToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<PaymentLink>(`/api/payment/links/${id}/rotate-token`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentLinkKeys.all }),
  });
}

export function usePublicPaymentLink(token: string | undefined) {
  return useQuery({
    queryKey: paymentLinkKeys.public(token),
    queryFn: () =>
      request.get<PaymentLinkPublic>(`/api/public/payment/link/${encodeURIComponent(token ?? '')}`, { skipAuth: true, silent: true }).then(unwrap),
    enabled: !!token,
  });
}

export function usePayPublicPaymentLink() {
  return useMutation({
    mutationFn: ({ token, amount, payMethod }: PublicPaymentLinkPayValues) =>
      request.post<{ orderNo: string; payParams: CreatePaymentResult }>(
        `/api/public/payment/link/${encodeURIComponent(token)}/pay`,
        { amount, payMethod },
        { skipAuth: true, silent: true },
      ).then(unwrap),
  });
}

/** 收银台订单状态轮询（下单后每 3s 查询，终态自动停止） */
export function usePublicLinkOrderStatus(token: string, orderNo: string | undefined) {
  return useQuery({
    queryKey: ['payment-links', 'public-order-status', token, orderNo] as const,
    queryFn: () =>
      request.get<{ status: string; paidAt: string | null }>(
        `/api/public/payment/link/${encodeURIComponent(token)}/orders/${encodeURIComponent(orderNo ?? '')}/status`,
        { skipAuth: true, silent: true },
      ).then(unwrap),
    enabled: !!orderNo,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'success' || status === 'closed' || status === 'failed' || status === 'refunded' ? false : 3000;
    },
  });
}
