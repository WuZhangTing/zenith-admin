/**
 * App 推送域 hooks（配置 / 发送记录）。
 *
 * key 结构:push-configs 与 push-send-logs 两个独立命名空间;
 * 测试发送会产生发送记录 → 连带失效记录列表(通常另页未挂载,失效零成本)。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PushConfig, PushSendLog, TestPushSendInput } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface PushConfigListParams extends CrudListParams {
  keyword?: string;
  provider?: string;
  status?: string;
}

export const {
  keys: pushConfigKeys,
  useList: usePushConfigList,
  useDetail: usePushConfigDetail,
  useSave: useSavePushConfig,
  useDelete: useDeletePushConfigs,
} = createCrudQueries<PushConfig, PushConfigListParams, Partial<PushConfig>>({
  resource: 'push-configs',
  deleteMode: 'single',
});

export interface PushSendLogListParams extends CrudListParams {
  keyword?: string;
  provider?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const {
  keys: pushSendLogKeys,
  useList: usePushSendLogList,
} = createCrudQueries<PushSendLog, PushSendLogListParams, never>({
  resource: 'push-send-logs',
});

/** 设为默认:影响列表的默认列(旧默认行同时变化),失效配置列表 */
export function useSetPushConfigDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.put<PushConfig>(`/api/push-configs/${id}/default`).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: pushConfigKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: pushConfigKeys.lists });
    },
  });
}

/** 测试发送:产生一条发送记录 → 失效记录列表;配置本身不变 */
export function useTestPushSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: TestPushSendInput }) =>
      request.post<{ msgId: string | null }>(`/api/push-configs/${id}/test`, values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pushSendLogKeys.lists });
    },
  });
}
