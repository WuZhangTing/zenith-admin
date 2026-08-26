import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { RuleAssetVersion, RuleScorecard, RuleScorecardEvaluateResult } from '@zenith/shared/rules';
import { toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export interface RuleScorecardListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: 'draft' | 'published' | 'disabled';
}

/** 评分卡：独立命名空间（与决策表/名单同级），互不失效 */
export const ruleScorecardKeys = {
  all: ['rules', 'scorecards'] as const,
  lists: ['rules', 'scorecards', 'list'] as const,
  list: (params: RuleScorecardListParams) => ['rules', 'scorecards', 'list', params] as const,
  versions: (id: number | undefined) => ['rules', 'scorecards', 'versions', id] as const,
};

export function useRuleScorecardList(params: RuleScorecardListParams) {
  return useQuery({
    queryKey: ruleScorecardKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<RuleScorecard>>(`/api/rules/scorecards${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useSaveRuleScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<RuleScorecard>('/api/rules/scorecards', values)
        : request.put<RuleScorecard>(`/api/rules/scorecards/${id}`, values)
      ).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleScorecardKeys.all }),
  });
}

export function useDeleteRuleScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/rules/scorecards/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleScorecardKeys.all }),
  });
}

export function usePublishRuleScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<RuleScorecard>(`/api/rules/scorecards/${id}/publish`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleScorecardKeys.all }),
  });
}

export function useToggleRuleScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      request.post<RuleScorecard>(`/api/rules/scorecards/${id}/toggle`, { enabled }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleScorecardKeys.all }),
  });
}

/** 测试求值：纯读操作，不触发失效 */
export function useEvaluateRuleScorecard() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Record<string, unknown> }) =>
      request.post<RuleScorecardEvaluateResult>(`/api/rules/scorecards/${id}/evaluate`, { input }).then(unwrap),
  });
}

export function useRuleScorecardVersions(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ruleScorecardKeys.versions(id),
    queryFn: () => request.get<RuleAssetVersion[]>(`/api/rules/scorecards/${id}/versions`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useRollbackRuleScorecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      request.post<RuleScorecard>(`/api/rules/scorecards/${id}/rollback/${version}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleScorecardKeys.all }),
  });
}
