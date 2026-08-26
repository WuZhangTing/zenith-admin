/**
 * App 推送域 hooks（配置 / 发送记录）。
 *
 * key 结构:push-configs 与 push-send-logs 两个独立命名空间;
 * 测试发送会产生发送记录 → 连带失效记录列表(通常另页未挂载,失效零成本)。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PushConfig, PushSendLog, PushSendLogStats, TestPushSendInput } from '@zenith/shared/messaging';
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

/** 测试发送:产生一条发送记录 → 失效记录域(列表+统计);配置本身不变 */
export function useTestPushSend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: TestPushSendInput }) =>
      request.post<{ msgId: string | null }>(`/api/push-configs/${id}/test`, values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pushSendLogKeys.all });
    },
  });
}

/** 记录页顶部统计(窗口汇总+趋势);挂在记录域 key 下,测试发送后随列表一并失效 */
export function usePushSendLogStats(days: number) {
  return useQuery({
    queryKey: [...pushSendLogKeys.all, 'stats', days] as const,
    queryFn: () => request.get<PushSendLogStats>(`/api/push-send-logs/stats?days=${days}`).then(unwrap),
  });
}
