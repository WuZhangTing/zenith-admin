import type { QueryOf } from '@zenith/shared/core';
import { wikiTemplateContract } from '@zenith/shared/wiki';
import { createResourceQueries } from '@/lib/contract-query';

export type WikiTemplateListParams = NonNullable<QueryOf<typeof wikiTemplateContract.list>>;

export const {
  keys: wikiTemplateKeys,
  useList: useWikiTemplateList,
  useDetail: useWikiTemplateDetail,
  useSave: useSaveWikiTemplate,
  useDelete: useDeleteWikiTemplates,
  useLookup: useAllWikiTemplates,
} = createResourceQueries(wikiTemplateContract);
