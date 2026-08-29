import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { InAppMessage } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { inAppMessageKeys } from '@/hooks/queries/in-app-messages';

export interface InboxListParams {
  page: number;
  pageSize: number;
  isRead?: string;
}

export const inboxKeys = {
  all: ['inbox'] as const,
  lists: ['inbox', 'list'] as const,
  list: (params: InboxListParams) => ['inbox', 'list', params] as const,
  detail: (id: number | undefined) => ['inbox', 'detail', id] as const,
};

export function useInboxList(params: InboxListParams) {
  return useQuery({
    queryKey: inboxKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<InAppMessage>>(`/api/in-app-messages${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useInboxMessageDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: inboxKeys.detail(id),
    queryFn: () => request.get<InAppMessage>(`/api/in-app-messages/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

/** 已读 / 删除会同时改变收件箱列表与顶栏铃铛（列表 + 未读数），两处缓存一起失效 */
function invalidateInboxAndBell(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: inboxKeys.all });
  void qc.invalidateQueries({ queryKey: inAppMessageKeys.mine });
}

export function useMarkInboxMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/in-app-messages/${id}/read`, undefined, { silent: true }).then(unwrap),
    onSuccess: () => invalidateInboxAndBell(qc),
  });
}

export function useMarkAllInboxMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<null>('/api/in-app-messages/read-all', {}).then(unwrap),
    onSuccess: () => invalidateInboxAndBell(qc),
  });
}

export function useBatchMarkInboxMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.post<null>('/api/in-app-messages/batch-read', { ids }).then(unwrap),
    onSuccess: () => invalidateInboxAndBell(qc),
  });
}

export function useBatchDeleteInboxMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.delete<null>('/api/in-app-messages/batch', { ids }).then(unwrap),
    onSuccess: () => invalidateInboxAndBell(qc),
  });
}

export function useDeleteInboxMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/in-app-messages/${id}`).then(unwrap),
    onSuccess: () => invalidateInboxAndBell(qc),
  });
}
