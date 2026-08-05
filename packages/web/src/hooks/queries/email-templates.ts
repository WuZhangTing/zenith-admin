import type { EmailTemplate } from '@zenith/shared/messaging';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface EmailTemplateListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: emailTemplateKeys,
  useList: useEmailTemplateList,
  useDetail: useEmailTemplateDetail,
  useSave: useSaveEmailTemplate,
  useDelete: useDeleteEmailTemplate,
} = createCrudQueries<EmailTemplate, EmailTemplateListParams>({
  resource: 'email-templates',
  deleteMode: 'single',
});
