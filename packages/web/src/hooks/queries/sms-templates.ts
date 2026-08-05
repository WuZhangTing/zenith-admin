import type { SmsProvider, SmsTemplate } from '@zenith/shared/messaging';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface SmsTemplateListParams extends CrudListParams {
  keyword?: string;
  provider?: SmsProvider;
  status?: string;
}

export const {
  keys: smsTemplateKeys,
  useList: useSmsTemplateList,
  useDetail: useSmsTemplateDetail,
  useSave: useSaveSmsTemplate,
  useDelete: useDeleteSmsTemplate,
} = createCrudQueries<SmsTemplate, SmsTemplateListParams>({
  resource: 'sms-templates',
  deleteMode: 'single',
});
