/**
 * 通知策略（管理员）域 hooks。
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type {
  NotificationChannel,
  NotificationDecision,
  NotificationPolicyEvent,
  NotificationRecipientType,
} from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { notificationPreferenceKeys } from './notification-preferences';

export interface NotificationDispatchItem {
  id: number;
  outboxId: number | null;
  eventKey: string;
  eventLabel: string;
  recipientType: NotificationRecipientType;
  recipientId: number | null;
  recipientName: string | null;
  recipientAddress: string | null;
  channel: NotificationChannel;
  decision: NotificationDecision;
  reasonCode: string | null;
  reasonDetail: string | null;
  providerMsgId: string | null;
  tenantId: number | null;
  createdAt: string;
}

export interface NotificationDispatchListParams {
  page: number;
  pageSize: number;
  eventKey?: string;
  channel?: NotificationChannel;
  decision?: NotificationDecision;
  recipientId?: number;
  startTime?: string;
  endTime?: string;
}

export const notificationPolicyKeys = {
  all: ['notification-policies'] as const,
  events: ['notification-policies', 'events'] as const,
  dispatches: ['notification-policies', 'dispatches'] as const,
  dispatchList: (params: NotificationDispatchListParams) =>
    ['notification-policies', 'dispatches', params] as const,
};

export function useNotificationPolicyEvents() {
  return useQuery({
    queryKey: notificationPolicyKeys.events,
    queryFn: () => request.get<NotificationPolicyEvent[]>('/api/notification-policies/events').then(unwrap),
  });
}

export interface SaveOverrideInput {
  eventKey: string;
  channel: NotificationChannel;
  enabled: boolean;
  locked: boolean;
}

/** 保存/重置覆盖后，除策略目录外还要打掉个人矩阵——覆盖直接改变矩阵里的默认值与锁定态 */
function invalidatePolicyAffected(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: notificationPolicyKeys.events });
  void qc.invalidateQueries({ queryKey: notificationPreferenceKeys.matrix });
}

export function useSaveNotificationOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveOverrideInput) =>
      request.put<null>('/api/notification-policies/overrides', input).then(unwrap),
    onSuccess: () => invalidatePolicyAffected(qc),
  });
}

export function useResetNotificationOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventKey: string; channel: NotificationChannel }) =>
      request.post<null>('/api/notification-policies/overrides/reset', input).then(unwrap),
    onSuccess: () => invalidatePolicyAffected(qc),
  });
}

export function useNotificationDispatches(params: NotificationDispatchListParams) {
  return useQuery({
    queryKey: notificationPolicyKeys.dispatchList(params),
    queryFn: () =>
      request.get<PaginatedResponse<NotificationDispatchItem>>(`/api/notification-policies/dispatches${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/** 测试触发:真实派发一次事件给当前管理员 → 失效投递日志 */
export function useTestFireNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventKey: string) =>
      request.post<{ outboxId: number | null }>('/api/notification-policies/test-fire', { eventKey }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationPolicyKeys.dispatches });
    },
  });
}
