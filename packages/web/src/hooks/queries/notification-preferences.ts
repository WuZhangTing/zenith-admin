/**
 * 通知偏好（个人中心）域 hooks。
 *
 * 矩阵与全局设置是两棵独立缓存：调偏好开关不影响免打扰设置，反之亦然，
 * 因此互不失效；保存设置的写接口与查询同源（同一 service 映射），允许回填。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationMatrixGroup,
  NotificationRecipientSettings,
  SaveNotificationPreferenceItem,
  SaveNotificationSettingsInput,
} from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const notificationPreferenceKeys = {
  all: ['notification-preferences'] as const,
  matrix: ['notification-preferences', 'matrix'] as const,
  settings: ['notification-preferences', 'settings'] as const,
};

export function useNotificationMatrix() {
  return useQuery({
    queryKey: notificationPreferenceKeys.matrix,
    queryFn: () => request.get<NotificationMatrixGroup[]>('/api/notification-preferences/matrix').then(unwrap),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationPreferenceKeys.settings,
    queryFn: () => request.get<NotificationRecipientSettings>('/api/notification-preferences/settings').then(unwrap),
  });
}

/** 保存偏好开关：服务端按稀疏规则落库，矩阵需回源重算生效值 */
export function useSaveNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: SaveNotificationPreferenceItem[]) =>
      request.put<null>('/api/notification-preferences/matrix', { items }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationPreferenceKeys.matrix });
    },
  });
}

/** 保存全局设置：写接口返回与 GET 同源的完整设置，直接回填 */
export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveNotificationSettingsInput) =>
      request.put<NotificationRecipientSettings>('/api/notification-preferences/settings', input).then(unwrap),
    onSuccess: (saved) => {
      qc.setQueryData(notificationPreferenceKeys.settings, saved);
    },
  });
}
