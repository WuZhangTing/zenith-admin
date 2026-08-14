import type { WikiTemplate } from '@zenith/shared/wiki';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WikiTemplateListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: wikiTemplateKeys,
  useList: useWikiTemplateList,
  useDetail: useWikiTemplateDetail,
  useSave: useSaveWikiTemplate,
  useDelete: useDeleteWikiTemplates,
  useLookup: useAllWikiTemplates,
} = createCrudQueries<WikiTemplate, WikiTemplateListParams>({
  resource: 'wiki-templates',
  path: '/api/wiki/templates',
  deleteMode: 'single',
  lookup: true,
});
