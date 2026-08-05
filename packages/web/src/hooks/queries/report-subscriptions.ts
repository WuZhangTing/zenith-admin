import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { ReportDashboardSubscription, ReportDeliveryRun } from '@zenith/shared/report';
import type { AsyncTask } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { useReportLookup } from './report-lookups';

export interface ReportSubscriptionListParams extends CrudListParams {
  keyword?: string;
}

/** 投递历史随订阅增删一并失效（沿用原 .all 粗失效的覆盖面） */
const HISTORY_PREFIX = ['report', 'subscriptions', 'history'] as const;

const crud = createCrudQueries<ReportDashboardSubscription, ReportSubscriptionListParams, Record<string, unknown>>({
  resource: 'report-subscriptions',
  // 保留原有嵌套 key：报表域用 ['report'] 前缀组织所有资源
  keyPrefix: ['report', 'subscriptions'],
  path: '/api/report/subscriptions',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: HISTORY_PREFIX }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: HISTORY_PREFIX }),
});

export const reportSubscriptionKeys = {
  ...crud.keys,
  history: (id: number | undefined) => ['report', 'subscriptions', 'history', id] as const,
};

export const useReportSubscriptionList = crud.useList;
export const useSaveReportSubscription = crud.useSave;
export const useDeleteReportSubscriptions = crud.useDelete;

export function useReportSubscriptionDashboardOptions() {
  return useReportLookup('dashboards', { status: 'enabled', limit: 50 });
}

export function useRunReportSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<AsyncTask>(`/api/report/subscriptions/${id}/run`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportSubscriptionKeys.all }),
  });
}

export function useBatchReportSubscriptionEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) =>
      request.put<null>('/api/report/subscriptions/batch-status', { ids, enabled }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportSubscriptionKeys.all }),
  });
}

export function useReportSubscriptionHistory(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: reportSubscriptionKeys.history(id),
    enabled: enabled && !!id,
    queryFn: () => request.get<PaginatedResponse<ReportDeliveryRun>>(`/api/report/delivery-runs${toQueryString({ targetType: 'subscription', subscriptionId: id, includeAttempts: true, page: 1, pageSize: 20 })}`).then(unwrap),
  });
}
