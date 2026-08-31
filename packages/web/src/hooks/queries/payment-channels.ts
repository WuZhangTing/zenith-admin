import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentChannelConfig, PaymentChannelConfigLookup } from '@zenith/shared/payment';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PaymentChannelListParams extends CrudListParams {
  keyword?: string;
  channel?: string;
  status?: string;
}

export interface PaymentChannelTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export const paymentChannelOperationLookupKeys = {
  all: ['payment-channel-operation-lookup'] as const,
  list: () => ['payment-channel-operation-lookup', 'list'] as const,
};

const crud = createCrudQueries<PaymentChannelConfig, PaymentChannelListParams, Record<string, unknown>>({
  resource: 'payment-channels',
  path: '/api/payment/channels',
  // 渠道下拉源（支付应用配置等场景共享）
  lookup: true,
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  // isDefault 全域唯一：保存时设为默认会连带清掉原默认渠道，其它渠道的详情缓存一并失效
  onSaved: (qc, saved) => {
    if (saved.isDefault) void qc.invalidateQueries({ queryKey: ['payment-channels', 'detail'] });
    void qc.invalidateQueries({ queryKey: paymentChannelOperationLookupKeys.all });
  },
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: paymentChannelOperationLookupKeys.all }),
});

export const paymentChannelKeys = crud.keys;

export const usePaymentChannelList = crud.useList;
export const usePaymentChannelDetail = crud.useDetail;
export const useSavePaymentChannel = crud.useSave;
export const useDeletePaymentChannels = crud.useDelete;
export const useAllPaymentChannelConfigsLookup = crud.useLookup;

/** 资金运营页面专用最小下拉源：仅含当前租户启用的商户配置。 */
export function usePaymentChannelOperationLookup(enabled = true) {
  return useQuery({
    queryKey: paymentChannelOperationLookupKeys.list(),
    queryFn: () => request.get<PaymentChannelConfigLookup[]>('/api/payment/channels/operation-lookup').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled,
  });
}

export function useTestPaymentChannel() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<PaymentChannelTestResult>(`/api/payment/channels/${id}/test`, {}).then(unwrap),
  });
}

export function useSetDefaultPaymentChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/payment/channels/${id}/default`, {}).then(unwrap),
    // 默认标记在列表、详情、下拉源里都会展示，整域失效
    onSuccess: () => qc.invalidateQueries({ queryKey: paymentChannelKeys.all }),
  });
}
