import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type {
  MonitorAlertEvent,
  MonitorAlertOverview,
  MonitorAlertOverviewRange,
  MonitorAlertRule,
  MonitorAlertTestResult,
} from '@zenith/shared/platform';
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
  handleStatus?: string;
  ruleId?: number;
  startTime?: string;
  endTime?: string;
}

/** 告警事件由规则触发产生，规则增删改后一并失效（沿用原 .all 粗失效的覆盖面） */
const EVENT_LISTS_KEY = ['monitor-alerts', 'events', 'list'] as const;

/** 概览是跨规则与事件的聚合派生，任一侧变更都可能改变它，故独立成键单独失效 */
const OVERVIEW_KEY = ['monitor-alerts', 'overview'] as const;

const crud = createCrudQueries<MonitorAlertRule, MonitorAlertListParams, Record<string, unknown>>({
  resource: 'monitor-alerts',
  onSaved: (qc) => {
    void qc.invalidateQueries({ queryKey: EVENT_LISTS_KEY });
    void qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
  },
  onDeleted: (qc) => {
    void qc.invalidateQueries({ queryKey: EVENT_LISTS_KEY });
    void qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
  },
});

export const monitorAlertKeys = {
  ...crud.keys,
  eventLists: EVENT_LISTS_KEY,
  eventList: (params: MonitorAlertEventListParams) => ['monitor-alerts', 'events', 'list', params] as const,
  overviews: OVERVIEW_KEY,
  overview: (range: string) => ['monitor-alerts', 'overview', range] as const,
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

/** 批量启停：停用会关闭规则未恢复的告警事件，故事件列表与概览一并失效 */
export function useBatchToggleMonitorAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, enabled }: { ids: number[]; enabled: boolean }) =>
      request.patch<null>('/api/monitor-alerts/batch/enabled', { ids, enabled }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.lists });
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.overviews });
    },
  });
}

/**
 * 试发通知：只验证渠道配置，不产生事件、不改规则运行态，
 * 因此不失效任何列表；返回派发结果供调用方精确提示哪个渠道失败。
 */
export function useTestMonitorAlert() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<MonitorAlertTestResult>(`/api/monitor-alerts/${id}/test`).then(unwrap),
  });
}

/** 处理告警：改变的是事件的人工状态，规则列表不含该状态，故不失效规则列表 */
export function useHandleMonitorAlertEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, handleStatus, note }: { id: number; handleStatus: string; note?: string | null }) =>
      request.patch<MonitorAlertEvent>(`/api/monitor-alerts/events/${id}/handle`, { handleStatus, note }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.overviews });
    },
  });
}

export function useBatchHandleMonitorAlertEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, handleStatus, note }: { ids: number[]; handleStatus: string; note?: string | null }) =>
      request.patch<null>('/api/monitor-alerts/events/batch/handle', { ids, handleStatus, note }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.eventLists });
      void qc.invalidateQueries({ queryKey: monitorAlertKeys.overviews });
    },
  });
}

export function useMonitorAlertOverview(range: MonitorAlertOverviewRange, enabled = true) {
  return useQuery({
    queryKey: monitorAlertKeys.overview(range),
    queryFn: () =>
      request.get<MonitorAlertOverview>(`/api/monitor-alerts/overview?range=${range}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
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
