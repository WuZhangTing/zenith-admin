import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IotAlarm, IotAlarmRule, IotMaintenanceWindow } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 告警规则 ─────────────────────────────────────────────────────────────────
export interface IotAlarmRuleListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  ruleType?: string;
  status?: string;
}

export const {
  keys: iotAlarmRuleKeys,
  useList: useIotAlarmRuleList,
  useSave: useSaveIotAlarmRule,
  useDelete: useDeleteIotAlarmRules,
} = createCrudQueries<IotAlarmRule, IotAlarmRuleListParams, Partial<IotAlarmRule>>({
  resource: 'iot-alarm-rules',
  path: '/api/iot/alarm-rules',
  deleteMode: 'single',
});

// ─── 告警记录 ─────────────────────────────────────────────────────────────────
export interface IotAlarmListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  level?: string;
  ruleType?: string;
  deviceId?: number;
  startTime?: string;
  endTime?: string;
}

export const iotAlarmKeys = {
  all: ['iot-alarms'] as const,
  lists: ['iot-alarms', 'list'] as const,
  list: (params: IotAlarmListParams) => ['iot-alarms', 'list', params] as const,
};

export function useIotAlarmList(params: IotAlarmListParams) {
  return useQuery({
    queryKey: iotAlarmKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotAlarm>>(`/api/iot/alarms${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/** 认领告警：状态翻转，仅失效告警列表 */
export function useAcknowledgeIotAlarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<IotAlarm>(`/api/iot/alarms/${id}/acknowledge`, {}).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotAlarmKeys.lists });
    },
  });
}

/** 手动处理告警（可附处理备注）：记录状态翻转，仅失效告警列表 */
export function useResolveIotAlarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string | null }) =>
      request.post<IotAlarm>(`/api/iot/alarms/${id}/resolve`, { note: note ?? null }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotAlarmKeys.lists });
    },
  });
}

// ─── 维护窗口 ─────────────────────────────────────────────────────────────────
export interface IotMaintenanceWindowListParams extends CrudListParams {
  keyword?: string;
}

export const {
  keys: iotMaintenanceWindowKeys,
  useList: useIotMaintenanceWindowList,
  useSave: useSaveIotMaintenanceWindow,
  useDelete: useDeleteIotMaintenanceWindows,
} = createCrudQueries<IotMaintenanceWindow, IotMaintenanceWindowListParams, Partial<IotMaintenanceWindow>>({
  resource: 'iot-maintenance-windows',
  path: '/api/iot/maintenance-windows',
  deleteMode: 'single',
});
