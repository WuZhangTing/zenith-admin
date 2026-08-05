import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BizLeave } from '@zenith/shared/biz';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface BizLeaveListParams extends CrudListParams {
  keyword?: string;
  status?: BizLeave['status'];
}

export interface SaveBizLeavePayload {
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
}

const {
  keys: bizLeaveKeys,
  useList: useBizLeaveList,
  useSave: useSaveBizLeave,
  useDelete: useDeleteBizLeave,
} = createCrudQueries<BizLeave, BizLeaveListParams, SaveBizLeavePayload>({
  resource: 'biz-leave',
  path: '/api/biz/leaves',
  deleteMode: 'single',
});

export { bizLeaveKeys, useBizLeaveList, useSaveBizLeave, useDeleteBizLeave };

export function useBizLeaveDetail(id: string | null | undefined, enabled = true) {
  const numericId = id ? Number(id) : undefined;
  return useQuery({
    queryKey: bizLeaveKeys.detail(numericId),
    queryFn: () => request.get<BizLeave>(`/api/biz/leaves/${id}/detail`, { silent: true }).then(unwrap),
    enabled: enabled && !!id,
  });
}

export function useSubmitBizLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<BizLeave>(`/api/biz/leaves/${id}/submit`, {}).then(unwrap),
    onSuccess: (saved) => {
      // 提交审批会改变列表状态与当前记录详情，不影响其他请假记录详情。
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.lists });
    },
  });
}

export function useReopenBizLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<BizLeave>(`/api/biz/leaves/${id}/reopen`, {}).then(unwrap),
    onSuccess: (saved) => {
      // 重新打开只影响该申请的状态与列表展示。
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.lists });
    },
  });
}
