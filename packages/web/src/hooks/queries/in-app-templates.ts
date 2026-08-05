import type { InAppMessageType, InAppTemplate } from '@zenith/shared/messaging';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface InAppTemplateListParams extends CrudListParams {
  keyword?: string;
  type?: InAppMessageType;
  status?: string;
}

export const {
  keys: inAppTemplateKeys,
  useList: useInAppTemplateList,
  useDetail: useInAppTemplateDetail,
  useSave: useSaveInAppTemplate,
  useDelete: useDeleteInAppTemplate,
} = createCrudQueries<InAppTemplate, InAppTemplateListParams, Record<string, unknown>>({
  resource: 'in-app-templates',
  deleteMode: 'single',
});
