import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SmsConfig, SmsProvider } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface SmsConfigListParams extends CrudListParams {
  keyword?: string;
  provider?: SmsProvider;
  status?: string;
}

export const {
  keys: smsConfigKeys,
  useList: useSmsConfigList,
  useDetail: useSmsConfigDetail,
  useSave: useSaveSmsConfig,
  useDelete: useDeleteSmsConfig,
} = createCrudQueries<SmsConfig, SmsConfigListParams>({
  resource: 'sms-configs',
  deleteMode: 'single',
});

export function useSetDefaultSmsConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/sms-configs/${id}/default`).then(unwrap),
    onSuccess: () => {
      // 默认短信配置会改变当前与原默认配置详情、列表中的 isDefault。
      void qc.invalidateQueries({ queryKey: ['sms-configs', 'detail'] });
      void qc.invalidateQueries({ queryKey: smsConfigKeys.lists });
    },
  });
}
