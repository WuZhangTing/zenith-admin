import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { IotAutomation, IotAutomationRun } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 联动规则 ─────────────────────────────────────────────────────────────────
export interface IotAutomationListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  triggerType?: string;
  status?: string;
}

export const {
  keys: iotAutomationKeys,
  useList: useIotAutomationList,
  useSave: useSaveIotAutomation,
  useDelete: useDeleteIotAutomations,
} = createCrudQueries<IotAutomation, IotAutomationListParams, Partial<IotAutomation>>({
  resource: 'iot-automations',
  path: '/api/iot/automations',
  deleteMode: 'single',
});

// ─── 执行记录（只读追加型，无变更入口）───────────────────────────────────────
export interface IotAutomationRunListParams extends CrudListParams {
  automationId?: number;
  deviceId?: number;
  success?: boolean;
}

export const iotAutomationRunKeys = {
  list: (params: IotAutomationRunListParams) => ['iot-automation-runs', 'list', params] as const,
};

export function useIotAutomationRunList(params: IotAutomationRunListParams, enabled = true) {
  return useQuery({
    queryKey: iotAutomationRunKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotAutomationRun>>(`/api/iot/automations/runs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}
