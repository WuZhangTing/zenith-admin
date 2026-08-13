import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { MpMessageTemplate, MpTemplateSendLog } from '@zenith/shared/mp';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface MpTemplateListParams {
  page: number;
  pageSize: number;
}

export interface MpTemplateLogListParams {
  page: number;
  pageSize: number;
  status?: string;
}

export interface MpTemplateSyncResult {
  created: number;
  updated: number;
}

export interface MpTemplateBatchSendResult {
  success: number;
  failed: number;
  total: number;
}

export interface MpTemplateIndustry {
  primaryIndustry: { firstClass: string; secondClass: string } | null;
  secondaryIndustry: { firstClass: string; secondClass: string } | null;
}

export const mpTemplateKeys = {
  all: ['mp', 'templates'] as const,
  /** 某公众号下的全部数据（模板 / 发送日志 / 行业设置），仅用于切换账号等整体场景 */
  account: (accountId: number | null | undefined) => ['mp', 'templates', accountId] as const,
  lists: (accountId: number | null | undefined) => ['mp', 'templates', accountId, 'list'] as const,
  list: (accountId: number | null | undefined, params: MpTemplateListParams) => ['mp', 'templates', accountId, 'list', params] as const,
  logLists: (accountId: number | null | undefined) => ['mp', 'templates', accountId, 'logs'] as const,
  logList: (accountId: number | null | undefined, params: MpTemplateLogListParams) => ['mp', 'templates', accountId, 'logs', params] as const,
  industry: (accountId: number | null | undefined) => ['mp', 'templates', accountId, 'industry'] as const,
};

export function useMpTemplateList(accountId: number | null | undefined, params: MpTemplateListParams) {
  return useQuery({
    queryKey: mpTemplateKeys.list(accountId, params),
    queryFn: () => request.get<PaginatedResponse<MpMessageTemplate>>(`/api/mp/templates${toQueryString({ ...params, accountId })}`).then(unwrap),
    enabled: !!accountId,
    placeholderData: keepPreviousData,
  });
}

export function useMpTemplateLogList(accountId: number | null | undefined, params: MpTemplateLogListParams) {
  return useQuery({
    queryKey: mpTemplateKeys.logList(accountId, params),
    queryFn: () => request.get<PaginatedResponse<MpTemplateSendLog>>(`/api/mp/templates/logs${toQueryString({ ...params, accountId })}`).then(unwrap),
    enabled: !!accountId,
    placeholderData: keepPreviousData,
  });
}

export function useMpTemplateIndustry(accountId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: mpTemplateKeys.industry(accountId),
    queryFn: () => request.get<MpTemplateIndustry>(`/api/mp/templates/industry${toQueryString({ accountId })}`).then(unwrap),
    enabled: enabled && !!accountId,
  });
}

export function useSyncMpTemplates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: number) => request.post<MpTemplateSyncResult>('/api/mp/templates/sync', { accountId }).then(unwrap),
    // 同步只重建模板清单；发送日志与行业设置不受影响
    onSuccess: (_data, accountId) => qc.invalidateQueries({ queryKey: mpTemplateKeys.lists(accountId) }),
  });
}

export function useSendMpTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => request.post<null>('/api/mp/templates/send', values).then(unwrap),
    // 发送只新增一条发送日志，模板清单本身不变
    onSuccess: (_data, values) => qc.invalidateQueries({ queryKey: mpTemplateKeys.logLists(values.accountId as number) }),
  });
}

export function useBatchSendMpTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => request.post<MpTemplateBatchSendResult>('/api/mp/templates/batch-send', values).then(unwrap),
    onSuccess: (_data, values) => qc.invalidateQueries({ queryKey: mpTemplateKeys.logLists(values.accountId as number) }),
  });
}

export function useSaveMpTemplateIndustry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => request.put<null>('/api/mp/templates/industry', values).then(unwrap),
    onSuccess: (_data, values) => qc.invalidateQueries({ queryKey: mpTemplateKeys.industry(values.accountId as number) }),
  });
}

export function useDeleteMpTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; accountId: number | null | undefined }) =>
      request.delete<null>(`/api/mp/templates/${id}`).then(unwrap),
    // 已发送日志保留历史记录，不随模板删除变化
    onSuccess: (_data, { accountId }) => qc.invalidateQueries({ queryKey: mpTemplateKeys.lists(accountId) }),
  });
}
