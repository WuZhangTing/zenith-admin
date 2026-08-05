import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { MonitorAlertEvent, MonitorAlertRule } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export type MonitorAlertListParams = CrudListParams;

export interface MonitorAlertEventListParams {
  page: number;
  pageSize: number;
  metric?: string;
  level?: string;
  status?: string;
}

/** 告警事件由规则触发产生，规则增删改后一并失效（沿用原 .all 粗失效的覆盖面） */
const EVENT_LISTS_KEY = ['monitor-alerts', 'events', 'list'] as const;

const crud = createCrudQueries<MonitorAlertRule, MonitorAlertListParams, Record<string, unknown>>({
  resource: 'monitor-alerts',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
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

export function useMonitorAlertEventList(params: MonitorAlertEventListParams) {
  return useQuery({
    queryKey: monitorAlertKeys.eventList(params),
    queryFn: () =>
      request.get<PaginatedResponse<MonitorAlertEvent>>(`/api/monitor-alerts/events${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}
