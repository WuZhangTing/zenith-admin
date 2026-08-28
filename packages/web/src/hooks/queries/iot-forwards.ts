import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { IotForwardLog, IotForwardRule } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 流转规则 ─────────────────────────────────────────────────────────────────
export interface IotForwardRuleListParams extends CrudListParams {
  keyword?: string;
  source?: string;
  status?: string;
}

export const {
  keys: iotForwardRuleKeys,
  useList: useIotForwardRuleList,
  useSave: useSaveIotForwardRule,
  useDelete: useDeleteIotForwardRules,
} = createCrudQueries<IotForwardRule, IotForwardRuleListParams, Partial<IotForwardRule> & { secret?: string | null }>({
  resource: 'iot-forward-rules',
  path: '/api/iot/forward-rules',
  deleteMode: 'single',
});

// ─── 投递日志（只读追加型）────────────────────────────────────────────────────
export interface IotForwardLogListParams extends CrudListParams {
  ruleId?: number;
  status?: string;
}

export const iotForwardLogKeys = {
  list: (params: IotForwardLogListParams) => ['iot-forward-logs', 'list', params] as const,
};

export function useIotForwardLogList(params: IotForwardLogListParams, enabled = true) {
  return useQuery({
    queryKey: iotForwardLogKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotForwardLog>>(`/api/iot/forward-rules/logs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}
