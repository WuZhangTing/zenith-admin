import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiHttpTool, AiToolInfo, CreateAiHttpToolInput, UpdateAiHttpToolInput } from '@zenith/shared/ai';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';

export const aiToolKeys = {
  all: ['ai-tools'] as const,
  lists: ['ai-tools', 'list'] as const,
  available: ['ai-tools', 'available'] as const,
};

export function useAiHttpTools() {
  return useQuery({
    queryKey: aiToolKeys.lists,
    queryFn: () => request.get<AiHttpTool[]>('/api/ai/http-tools').then(unwrap),
  });
}

/** 智能体编辑器工具勾选用（内置 + HTTP 工具统一视图） */
export function useAvailableAiTools(enabled = true) {
  return useQuery({
    queryKey: aiToolKeys.available,
    queryFn: () => request.get<AiToolInfo[]>('/api/ai/http-tools/available').then(unwrap),
    enabled,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useSaveAiHttpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: CreateAiHttpToolInput | UpdateAiHttpToolInput }) =>
      (id === undefined
        ? request.post<AiHttpTool>('/api/ai/http-tools', values)
        : request.put<AiHttpTool>(`/api/ai/http-tools/${id}`, values)
      ).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiToolKeys.lists });
      // 智能体编辑器的可选工具视图由 HTTP 工具集合派生
      void qc.invalidateQueries({ queryKey: aiToolKeys.available });
    },
  });
}

export function useDeleteAiHttpTool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/ai/http-tools/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiToolKeys.lists });
      void qc.invalidateQueries({ queryKey: aiToolKeys.available });
    },
  });
}
