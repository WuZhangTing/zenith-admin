import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { IotSchedule, IotScheduleRun } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 计划任务 ─────────────────────────────────────────────────────────────────
export interface IotScheduleListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  status?: string;
}

export const {
  keys: iotScheduleKeys,
  useList: useIotScheduleList,
  useSave: useSaveIotSchedule,
  useDelete: useDeleteIotSchedules,
} = createCrudQueries<IotSchedule, IotScheduleListParams, Partial<IotSchedule>>({
  resource: 'iot-schedules',
  path: '/api/iot/schedules',
  deleteMode: 'single',
});

// ─── 执行记录（只读追加型）────────────────────────────────────────────────────
export interface IotScheduleRunListParams extends CrudListParams {
  scheduleId?: number;
}

export const iotScheduleRunKeys = {
  list: (params: IotScheduleRunListParams) => ['iot-schedule-runs', 'list', params] as const,
};

export function useIotScheduleRunList(params: IotScheduleRunListParams, enabled = true) {
  return useQuery({
    queryKey: iotScheduleRunKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotScheduleRun>>(`/api/iot/schedules/runs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}
