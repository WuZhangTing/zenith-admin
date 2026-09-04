import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { chatBotContract, chatContract } from '@zenith/shared/chat';
import { resourceKeyOf, type BodyOf, type QueryOf } from '@zenith/shared/core';
import { api, contractKey, useApiMutation, useApiQuery } from '@/lib/contract-query';

export type ChatBotListParams = QueryOf<typeof chatBotContract.list>;

/** 新增与编辑共用同一表单：必填字段由表单 rules 保证，服务端 schema 兜底校验 */
export type SaveChatBotValues = Partial<BodyOf<typeof chatBotContract.create>>;

const CHAT_BOT_KEY = resourceKeyOf(chatBotContract.basePath);

export const chatBotKeys = {
  all: [CHAT_BOT_KEY] as const,
  lists: [CHAT_BOT_KEY, chatBotContract.list.name] as const,
  list: (params: ChatBotListParams) => contractKey(chatBotContract.list, { query: params }),
  /** 机器人表单的目标会话下拉源：从会话列表中筛出群聊 */
  groupConversations: [CHAT_BOT_KEY, 'group-conversations'] as const,
};

/** 列表行即完整实体（令牌已脱敏），任何写操作后整体失效即可 */
function invalidateChatBots(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: chatBotKeys.all });
}

export function useChatBotList(params: ChatBotListParams) {
  return useApiQuery(chatBotContract.list, { query: params }, { placeholderData: keepPreviousData });
}

export function useChatBotGroupConversations(enabled = true) {
  return useQuery({
    queryKey: chatBotKeys.groupConversations,
    queryFn: () => api(chatContract.conversations),
    select: (items) => items.filter((item) => item.type === 'group'),
    enabled,
  });
}

/** 无 id 走创建（POST），有 id 走更新（PATCH） */
export function useSaveChatBot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: SaveChatBotValues }) =>
      (id === undefined
        ? api(chatBotContract.create, { body: values as BodyOf<typeof chatBotContract.create> })
        : api(chatBotContract.update, { params: { id }, body: values })),
    onSuccess: () => invalidateChatBots(qc),
  });
}

export function useRegenerateChatBotToken() {
  return useApiMutation(chatBotContract.regenerateToken, { invalidate: invalidateChatBots });
}

export function useDeleteChatBot() {
  return useApiMutation(chatBotContract.remove, { invalidate: invalidateChatBots });
}
