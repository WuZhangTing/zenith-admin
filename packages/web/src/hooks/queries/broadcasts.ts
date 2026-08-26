/**
 * 运营群发域 hooks。
 *
 * key 结构:broadcasts 独立命名空间;发送动作改变活动状态并产生任务中心任务,
 * 成功后失效整个域(列表+详情);任务进度经 useMyAsyncTasks 实时获取,不进本域缓存。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AsyncTask } from '@zenith/shared/tasks';
import type { BroadcastCampaign, CreateBroadcastInput } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface BroadcastListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: broadcastKeys,
  useList: useBroadcastList,
  useDetail: useBroadcastDetail,
  useSave: useSaveBroadcast,
  useDelete: useDeleteBroadcasts,
} = createCrudQueries<BroadcastCampaign, BroadcastListParams, CreateBroadcastInput>({
  resource: 'broadcasts',
  deleteMode: 'single',
});

/** 发送:活动置为 sending 并提交任务中心任务 → 失效整个群发域 */
export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      request.post<AsyncTask>(`/api/broadcasts/${id}/send`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: broadcastKeys.all });
    },
  });
}
