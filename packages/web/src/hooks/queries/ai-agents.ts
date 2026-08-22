import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiAgent, AiBuiltinAgent, CreateAiAgentInput, UpdateAiAgentInput } from '@zenith/shared/ai';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const aiAgentKeys = {
  all: ['ai-agents'] as const,
  mine: ['ai-agents', 'mine'] as const,
  builtin: ['ai-agents', 'builtin'] as const,
  detail: (id: number | null) => ['ai-agents', 'detail', id] as const,
};

export function useMyAiAgents() {
  return useQuery({
    queryKey: aiAgentKeys.mine,
    queryFn: () => request.get<AiAgent[]>('/api/ai/agents').then(unwrap),
  });
}

/** 编程式内置智能体(代码定义、注册进 Mastra,只读) */
export function useBuiltinAiAgents() {
  return useQuery({
    queryKey: aiAgentKeys.builtin,
    queryFn: () => request.get<AiBuiltinAgent[]>('/api/ai/agents/builtin').then(unwrap),
  });
}

export function useAiAgentDetail(id: number | null) {
  return useQuery({
    queryKey: aiAgentKeys.detail(id),
    queryFn: () => request.get<AiAgent>(`/api/ai/agents/${id}`).then(unwrap),
    enabled: id !== null,
  });
}

export function useSaveAiAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: CreateAiAgentInput | UpdateAiAgentInput }) =>
      (id === undefined
        ? request.post<AiAgent>('/api/ai/agents', values)
        : request.put<AiAgent>(`/api/ai/agents/${id}`, values)
      ).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.all }),
  });
}

export function useDeleteAiAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/ai/agents/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: aiAgentKeys.all }),
  });
}
