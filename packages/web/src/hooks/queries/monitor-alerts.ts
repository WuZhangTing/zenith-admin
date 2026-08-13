import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { MonitorAlertEvent, MonitorAlertRule } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface MonitorAlertListParams extends CrudListParams {
  keyword?: string;
  metric?: string;
  level?: string;
  /** 规则是否参与定时评估 */
  enabled?: string;
  /** 规则当前是否处于告警中 */
  state?: string;
}

export interface MonitorAlertEventListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  metric?: string;
  level?: string;
  status?: string;
  notifyStatus?: string;
  ruleId?: number;
  startTime?: string;
  endTime?: string;
}

/** 告警事件由规则触发产生，规则增删改后一并失效（沿用原 .all 粗失效的覆盖面） */
const EVENT_LISTS_KEY = ['monitor-alerts', 'events', 'list'] as const;

const crud = createCrudQueries<MonitorAlertRule, MonitorAlertListParams, Record<string, unknown>>({
  resource: 'monitor-alerts',
  onSaved: (qc) => void qc.invalidateQueries({ queryKey: EVENT_LISTS_KEY }),
  onDeleted: (qc) => void qc.invalidateQueries({ queryKey: EVENT_LISTS_KEY }),
});

export const monitorAlertKeys = {
  ...crud.keys,
  eventLists: EVENT_LISTS_KEY,
  eventList: (params: MonitorAlertEventListParams) => ['monitor-alerts', 'events', 'list', params] as const,
};

export const useMonitorAlertList = crud.useList;
export const useSaveMonitorAlert = crud.useSave;
export const useDeleteMonitorAlerts = crud.useDelete;

export function useToggleMonitorAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      request.patch<MonitorAlertRule>(`/api/monitor-alerts/${id}/enabled`, { enabled }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: monitorAlertKeys.all }),
  });
}

/** 批量启停：停用会关闭规则未恢复的告警事件，故事件列表一并失效 */
export function useBatchToggleMonitorAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) =>
      request.patch<null>('/api/monitor-alerts/batch/enabled', { ids, enabled }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.lists });
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
    },
  });
}

export function useMonitorAlertEventList(params: MonitorAlertEventListParams) {
  return useQuery({
    queryKey: monitorAlertKeys.eventList(params),
    queryFn: () =>
      request.get<PaginatedResponse<MonitorAlertEvent>>(`/api/monitor-alerts/events${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}
