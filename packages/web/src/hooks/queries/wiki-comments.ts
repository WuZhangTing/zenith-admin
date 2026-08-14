import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateWikiCommentInput, WikiComment, WikiCommentStatus } from '@zenith/shared/wiki';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import type { CrudListParams } from '@/lib/crud-queries';
import { wikiDocKeys } from './wiki-docs';

export interface WikiCommentListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  docId?: number;
  startTime?: string;
  endTime?: string;
}

export const wikiCommentKeys = {
  all: ['wiki-comments'] as const,
  lists: ['wiki-comments', 'list'] as const,
  list: (params: WikiCommentListParams) => ['wiki-comments', 'list', params] as const,
  /** 某文档下的评论树（阅读页挂载） */
  doc: (docId: number | undefined) => ['wiki-comments', 'doc', docId] as const,
};

export function useWikiDocComments(docId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: wikiCommentKeys.doc(docId),
    queryFn: () => request.get<WikiComment[]>(`/api/wiki/comments/doc/${docId}`).then(unwrap),
    enabled: enabled && docId !== undefined,
  });
}

export function useWikiCommentList(params: WikiCommentListParams) {
  return useQuery({
    queryKey: wikiCommentKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<WikiComment>>(`/api/wiki/comments${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/** 评论树、管理列表、文档详情（commentCount）三处联动 */
function invalidateCommentSurfaces(
  qc: ReturnType<typeof useQueryClient>,
  docId: number,
) {
  void qc.invalidateQueries({ queryKey: wikiCommentKeys.doc(docId) });
  void qc.invalidateQueries({ queryKey: wikiCommentKeys.lists });
  void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(docId) });
}

export function useCreateWikiComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWikiCommentInput) =>
      request.post<WikiComment>('/api/wiki/comments', data).then(unwrap),
    onSuccess: (_data, { docId }) => invalidateCommentSurfaces(qc, docId),
  });
}

export function useDeleteMyWikiComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; docId: number }) =>
      request.delete<null>(`/api/wiki/comments/mine/${id}`).then(unwrap),
    onSuccess: (_data, { docId }) => invalidateCommentSurfaces(qc, docId),
  });
}

export function useUpdateWikiCommentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; docId: number; status: WikiCommentStatus }) =>
      request.put<WikiComment>(`/api/wiki/comments/${id}/status`, { status }).then(unwrap),
    onSuccess: (_data, { docId }) => invalidateCommentSurfaces(qc, docId),
  });
}

export function useRemoveWikiComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; docId: number }) =>
      request.delete<null>(`/api/wiki/comments/${id}`).then(unwrap),
    onSuccess: (_data, { docId }) => invalidateCommentSurfaces(qc, docId),
  });
}
