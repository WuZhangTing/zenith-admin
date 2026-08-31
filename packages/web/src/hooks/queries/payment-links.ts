import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePaymentLinkInput, PaymentCashierMethod, PaymentCashierSession, PaymentLink, PaymentLinkPublic, PaymentLinkStatus } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentLinkListParams extends CrudListParams {
  keyword?: string;
  status?: PaymentLinkStatus;
}

export interface PublicPaymentLinkPayValues {
  token: string;
  amount?: number;
  payMethod?: PaymentCashierMethod;
}

export type PaymentLinkSaveValues = Partial<Omit<CreatePaymentLinkInput, 'applicationId'>> & { applicationId?: number };

/** 公开收银台视图按 token 缓存，链接内容变更后一并失效（沿用原 .all 粗失效的覆盖面） */
const PUBLIC_PREFIX = ['payment-links', 'public'] as const;

const crud = createCrudQueries<PaymentLink, PaymentLinkListParams, PaymentLinkSaveValues>({
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
  publicSession: (token: string | undefined, sessionToken: string | undefined) => ['payment-links', 'public', token, 'sessions', sessionToken] as const,
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ token, amount, payMethod }: PublicPaymentLinkPayValues) =>
      request.post<PaymentCashierSession>(
        `/api/public/payment/link/${encodeURIComponent(token)}/pay`,
        { amount, payMethod },
        { skipAuth: true, silent: true },
      ).then(unwrap),
    onSuccess: (session, values) => {
      qc.setQueryData(paymentLinkKeys.publicSession(values.token, session.sessionToken), session);
    },
  });
}

/** 收银台会话恢复与轮询：刷新、第三方回跳均使用同一不可枚举 token。 */
export function usePublicPaymentCashierSession(token: string, sessionToken: string | undefined) {
  return useQuery({
    queryKey: paymentLinkKeys.publicSession(token, sessionToken),
    queryFn: () =>
      request.get<PaymentCashierSession>(
        `/api/public/payment/link/${encodeURIComponent(token)}/sessions/${encodeURIComponent(sessionToken ?? '')}`,
        { skipAuth: true, silent: true },
      ).then(unwrap),
    enabled: !!token && !!sessionToken,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'succeeded' || status === 'failed' || status === 'expired' ? false : 3000;
    },
  });
}
