import type { WikiTag } from '@zenith/shared/wiki';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WikiTagListParams extends CrudListParams {
  keyword?: string;
}

export const {
  keys: wikiTagKeys,
  useList: useWikiTagList,
  useSave: useSaveWikiTag,
  useDelete: useDeleteWikiTags,
  useLookup: useAllWikiTags,
} = createCrudQueries<WikiTag, WikiTagListParams>({
  resource: 'wiki-tags',
  path: '/api/wiki/tags',
  deleteMode: 'single',
  lookup: true,
});
