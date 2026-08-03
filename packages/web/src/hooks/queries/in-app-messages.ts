import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { InAppMessage, InAppMessageType, InAppTemplate } from '@zenith/shared/messaging';
import { toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export interface InAppMessageListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  type?: InAppMessageType;
  isRead?: string;
}

export const inAppMessageKeys = {
  all: ['in-app-messages'] as const,
  lists: ['in-app-messages', 'list'] as const,
  list: (params: InAppMessageListParams) => ['in-app-messages', 'list', params] as const,
  /** 顶栏铃铛里的我的站内信（固定首页 10 条） */
  mine: ['in-app-messages', 'mine'] as const,
  /** 顶栏铃铛未读数 */
  myUnreadCount: ['in-app-messages', 'mine', 'unread-count'] as const,
};

/** 我的站内信（顶栏铃铛列表） */
export function useMyInAppMessages() {
  return useQuery({
    queryKey: inAppMessageKeys.mine,
    queryFn: () => request
      .get<{ list: InAppMessage[]; total: number }>('/api/in-app-messages?page=1&pageSize=10', { silent: true })
      .then(unwrap),
    select: (data) => data?.list ?? [],
  });
}

/** 我的站内信未读数 */
export function useMyInAppMessageUnreadCount() {
  return useQuery({
    queryKey: inAppMessageKeys.myUnreadCount,
    queryFn: () => request.get<{ count: number }>('/api/in-app-messages/unread-count', { silent: true }).then(unwrap),
    select: (data) => data?.count ?? 0,
  });
}

/** 标记我的某条站内信已读（区别于管理端的 /admin/{id}/read） */
export function useMarkMyInAppMessageRead() {
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/in-app-messages/${id}/read`, undefined, { silent: true }).then(unwrap),
  });
}

export function useInAppMessageList(params: InAppMessageListParams) {
  return useQuery({
    queryKey: inAppMessageKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<InAppMessage>>(`/api/in-app-messages/admin${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useSendInAppMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => request.post<null>('/api/in-app-messages/send', values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: inAppMessageKeys.all }),
  });
}

export function useMarkInAppMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/in-app-messages/admin/${id}/read`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: inAppMessageKeys.all }),
  });
}

export function useMarkAllInAppMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<null>('/api/in-app-messages/admin/read-all').then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: inAppMessageKeys.all }),
  });
}

export function useDeleteInAppMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/in-app-messages/admin/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: inAppMessageKeys.all }),
  });
}

export function useEnabledInAppTemplates(enabled = true) {
  return useQuery({
    queryKey: ['in-app-messages', 'enabled-templates'] as const,
    queryFn: () =>
      request
        .get<PaginatedResponse<InAppTemplate>>('/api/in-app-templates?page=1&pageSize=100&status=enabled')
        .then(unwrap),
    enabled,
  });
}
