import { useQuery } from '@tanstack/react-query';
import { bizLeaveContract } from '@zenith/shared/biz';
import { api, createResourceQueries, useApiMutation } from '@/lib/contract-query';

export const {
  keys: bizLeaveKeys,
  useList: useBizLeaveList,
  useSave: useSaveBizLeave,
  useDelete: useDeleteBizLeave,
} = createResourceQueries(bizLeaveContract);

/**
 * 审批人视角的请假详情（工作流参与者按 bizId 拉取）。
 * 与「我的请假详情」共用 detail(id) 缓存键：两者返回同一实体，提交 / 重新编辑后一并失效。
 */
export function useBizLeaveDetail(id: string | null | undefined, enabled = true) {
  const numericId = id ? Number(id) : undefined;
  return useQuery({
    queryKey: bizLeaveKeys.detail(numericId),
    queryFn: () => api(bizLeaveContract.approvalDetail, { params: { id: numericId ?? 0 } }, { silent: true }),
    enabled: enabled && numericId !== undefined,
  });
}

/** 提交审批会改变列表状态与当前记录详情，不影响其他请假记录详情 */
export function useSubmitBizLeave() {
  return useApiMutation(bizLeaveContract.submit, {
    invalidate: (qc, saved) => {
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.lists });
    },
  });
}

/** 重新打开只影响该申请的状态与列表展示 */
export function useReopenBizLeave() {
  return useApiMutation(bizLeaveContract.reopen, {
    invalidate: (qc, saved) => {
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: bizLeaveKeys.lists });
    },
  });
}
