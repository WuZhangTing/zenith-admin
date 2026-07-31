import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiPromptScope, AiPromptTemplate, CreateAiPromptTemplateInput } from '@zenith/shared/ai';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface AiPromptListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  scope?: AiPromptScope;
}

export const aiPromptKeys = {
  all: ['ai-prompts'] as const,
  lists: ['ai-prompts', 'list'] as const,
  list: (params: AiPromptListParams) => ['ai-prompts', 'list', params] as const,
  detail: (id: number | undefined) => ['ai-prompts', 'detail', id] as const,
  available: ['ai-prompts', 'available'] as const,
};

export function useAiPromptList(params: AiPromptListParams) {
  return useQuery({
    queryKey: aiPromptKeys.list(params),
    queryFn: () =>
      request.get<PaginatedResponse<AiPromptTemplate>>(`/api/ai/prompt-templates${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useAiPromptDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: aiPromptKeys.detail(id),
    queryFn: () => request.get<AiPromptTemplate>(`/api/ai/prompt-templates/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useAvailableAiPrompts(enabled = true) {
  return useQuery({
    queryKey: aiPromptKeys.available,
    queryFn: () => request.get<AiPromptTemplate[]>('/api/ai/prompt-templates/available').then(unwrap),
    enabled,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useSaveAiPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: CreateAiPromptTemplateInput }) =>
      (id === undefined
        ? request.post<AiPromptTemplate>('/api/ai/prompt-templates', values)
        : request.put<AiPromptTemplate>(`/api/ai/prompt-templates/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: aiPromptKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: aiPromptKeys.lists });
      // 可用模板列表由模板集合派生
      void qc.invalidateQueries({ queryKey: aiPromptKeys.available });
    },
  });
}

export function useDeleteAiPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/ai/prompt-templates/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: aiPromptKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: aiPromptKeys.lists });
      void qc.invalidateQueries({ queryKey: aiPromptKeys.available });
    },
  });
}

/** 记录模板被应用为对话角色一次（使用统计，fire-and-forget 场景静默失败） */
export function recordAiPromptUse(id: number) {
  return request.post<null>(`/api/ai/prompt-templates/${id}/use`, {}, { silent: true }).catch(() => {});
}
