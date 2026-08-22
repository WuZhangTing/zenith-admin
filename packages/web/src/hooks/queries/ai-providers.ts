import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AiChatModel, AiProviderCatalogEntry, AiProviderConfig } from '@zenith/shared/ai';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';

export interface AiProviderListParams {
  keyword?: string;
}

export interface AiProviderTestPayload {
  id?: number;
  providerId: string;
  baseUrl?: string | null;
  apiKey?: string;
  model: string;
}

export const aiProviderKeys = {
  all: ['ai-providers'] as const,
  lists: ['ai-providers', 'list'] as const,
  list: (params: AiProviderListParams = {}) => ['ai-providers', 'list', params] as const,
  detail: (id: number | undefined) => ['ai-providers', 'detail', id] as const,
  chatModels: ['ai-providers', 'chat-models'] as const,
  catalog: ['ai-providers', 'catalog'] as const,
  catalogModels: (providerId: string | undefined) => ['ai-providers', 'catalog', providerId, 'models'] as const,
};

export function useAiProviderList(params: AiProviderListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: aiProviderKeys.list(params),
    queryFn: () => request.get<AiProviderConfig[]>('/api/ai/providers').then(unwrap),
    placeholderData: keepPreviousData,
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
  });
}

/** 聊天可用模型（轻量列表，无需 ai:provider:list 权限，仅含启用配置） */
export function useAiChatModels() {
  return useQuery({
    queryKey: aiProviderKeys.chatModels,
    queryFn: () => request.get<AiChatModel[]>('/api/ai/models').then(unwrap),
    placeholderData: keepPreviousData,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useAiProviderDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: aiProviderKeys.detail(id),
    queryFn: () => request.get<AiProviderConfig>(`/api/ai/providers/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<AiProviderConfig> }) =>
      (id === undefined
        ? request.post<AiProviderConfig>('/api/ai/providers', values)
        : request.put<AiProviderConfig>(`/api/ai/providers/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: aiProviderKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.lists });
      // 聊天可用模型由启用中的供应商配置派生，改动后必须回源
      void qc.invalidateQueries({ queryKey: aiProviderKeys.chatModels });
    },
  });
}

export function useDeleteAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/ai/providers/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: aiProviderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.lists });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.chatModels });
    },
  });
}

export function useSetDefaultAiProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/ai/providers/${id}/set-default`, {}).then(unwrap),
    // 默认标记会同时改变旧默认项，故整体刷新列表而非单条详情
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: aiProviderKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.lists });
      void qc.invalidateQueries({ queryKey: aiProviderKeys.chatModels });
    },
  });
}

export function useTestAiProviderConnection() {
  return useMutation({
    mutationFn: (body: AiProviderTestPayload) =>
      request.post<{ success: boolean; message: string }>('/api/ai/providers/test-connection', body).then(unwrap),
  });
}

/** 从供应商 API 自动发现模型列表 */
export function useFetchAiProviderModels() {
  return useMutation({
    mutationFn: (body: { id?: number; providerId: string; baseUrl?: string | null; apiKey?: string }) =>
      request.post<string[]>('/api/ai/providers/fetch-models', body).then(unwrap),
  });
}

/** 服务商目录（Mastra 模型目录,常用项排前） */
export function useAiProviderCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: aiProviderKeys.catalog,
    queryFn: () => request.get<AiProviderCatalogEntry[]>('/api/ai/providers/catalog').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
  });
}

/** 目录内某服务商的模型清单 */
export function useAiCatalogModels(providerId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: aiProviderKeys.catalogModels(providerId),
    queryFn: () => request.get<string[]>(`/api/ai/providers/catalog/${providerId}/models`).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: (options?.enabled ?? true) && !!providerId && providerId !== 'custom',
  });
}
