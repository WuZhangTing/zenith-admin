import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ImportWikiDocsInput,
  WikiGovernanceKind,
  WikiNoResultKeyword,
} from '@zenith/shared/wiki';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import type { CrudListParams } from '@/lib/crud-queries';
import { wikiDocKeys, wikiDocTreeKeys } from './wiki-docs';
import { wikiGovernanceKeys, wikiStatsKeys } from './wiki-query-keys';

/** 治理清单行（列表专用投影，非完整文档） */
export interface WikiGovernanceDoc {
  id: number;
  spaceId: number;
  spaceName: string;
  title: string;
  status: string;
  ownerId: number | null;
  ownerName: string | null;
  expireAt: string | null;
  reviewCycleDays: number | null;
  nextReviewAt: string | null;
  isArchived: boolean;
  updatedAt: string;
}

export { wikiGovernanceKeys } from './wiki-query-keys';

export function useWikiGovernanceDocs(kind: WikiGovernanceKind, params: CrudListParams, enabled = true) {
  return useQuery({
    queryKey: wikiGovernanceKeys.list(kind, params),
    queryFn: () => request.get<PaginatedResponse<WikiGovernanceDoc>>(`/api/wiki/governance/docs${toQueryString({ ...params, kind })}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useWikiNoResultKeywords(enabled = true) {
  return useQuery({
    queryKey: wikiGovernanceKeys.noResultKeywords,
    queryFn: () => request.get<WikiNoResultKeyword[]>('/api/wiki/governance/no-result-keywords').then(unwrap),
    enabled,
  });
}

/** 治理批量操作共用失效：各清单相互流动（归档会离开原清单进入已归档等） */
function invalidateGovernance(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: wikiGovernanceKeys.lists });
}

/** 提醒是纯通知副作用，不改变任何列表数据，无需失效 */
export function useRemindGovernanceOwners() {
  return useMutation({
    mutationFn: (ids: number[]) => request.post<null>('/api/wiki/governance/remind', { ids }).then(unwrap),
  });
}

/** 归档影响治理清单、文档列表与目录树（归档后从树/列表隐藏） */
export function useArchiveGovernanceDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, archived }: { ids: number[]; archived: boolean }) =>
      request.post<null>('/api/wiki/governance/archive', { ids, archived }).then(unwrap),
    onSuccess: () => {
      invalidateGovernance(qc);
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.all });
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
    },
  });
}

export function useSetGovernanceOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, ownerId }: { ids: number[]; ownerId: number }) =>
      request.post<null>('/api/wiki/governance/owner', { ids, ownerId }).then(unwrap),
    onSuccess: () => {
      invalidateGovernance(qc);
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
    },
  });
}

export function useSetGovernanceReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: number[]; reviewCycleDays: number | null; expireAt?: string | null }) =>
      request.post<null>('/api/wiki/governance/review-cycle', data).then(unwrap),
    onSuccess: () => {
      invalidateGovernance(qc);
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
    },
  });
}

/** 导入生成新草稿：文档列表与对应空间目录树刷新 */
export function useImportWikiDocs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ImportWikiDocsInput) =>
      request.post<{ importedCount: number; docIds: number[] }>('/api/wiki/governance/import', data).then(unwrap),
    onSuccess: (_data, { spaceId }) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(spaceId) });
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.overview });
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.contributors });
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
    },
  });
}
