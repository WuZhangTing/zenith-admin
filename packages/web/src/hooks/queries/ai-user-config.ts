import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserAiConfig } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';
import { aiProviderKeys } from './ai-providers';

export const aiUserConfigKeys = {
  all: ['ai-user-configs'] as const,
  lists: ['ai-user-configs', 'list'] as const,
  list: () => ['ai-user-configs', 'list', {}] as const,
};

export function useAiUserConfigs(enabled = true) {
  return useQuery({
    queryKey: aiUserConfigKeys.list(),
    queryFn: () => request.get<UserAiConfig[]>('/api/ai/user-configs').then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useSaveAiUserConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<UserAiConfig> }) =>
      (id === undefined
        ? request.post<UserAiConfig>('/api/ai/user-configs', values)
        : request.put<UserAiConfig>(`/api/ai/user-configs/${id}`, values)
      ).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiUserConfigKeys.lists });
      // 个人 API Key 会改变聊天可选模型，但不影响供应商配置本身，故只失效模型列表
      void qc.invalidateQueries({ queryKey: aiProviderKeys.chatModels });
    },
  });
}

export function useDeleteAiUserConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/ai/user-configs/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiUserConfigKeys.lists });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.chatModels });
    },
  });
}
