import { useCallback, useEffect, useMemo } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';
import { confirmDelete } from '@/utils/confirm';
import { useChatAnnouncementHistory, useDeleteChatAnnouncementHistory } from '@/hooks/queries/chat';
import type { ChatConversation, ChatMessage, ChatMessageContext, ChatGroupMember, ChatPresence, ChatReadState } from '@zenith/shared/chat';
import type { MessageReadReceipt, Setter } from '../types';

const EMPTY_ANNOUNCEMENT_HISTORY: ChatMessage[] = [];

/** 会话附属数据：置顶/收藏消息、群公告历史、已读回执、在线状态（自 ChatPage 原样搬移） */
export function useConversationExtras({
  activeConvId, announcementHistoryVisible, activeConv, activeGroupMembers, currentUserId, conversations,
  readStates, setPinnedMessages, setFavoriteMessages, setLeftPaneMode, setActiveConvId, setMessages,
  setHasMore, setOldestMsgId, setContextMode, setReadStates, setOnlineUserIds, setLastSeenMap,
}: {
  activeConvId: number | null;
  announcementHistoryVisible: boolean;
  activeConv: ChatConversation | null;
  activeGroupMembers: ChatGroupMember[];
  currentUserId: number | null;
  conversations: ChatConversation[];
  readStates: ChatReadState[];
  setPinnedMessages: Setter<ChatMessage[]>;
  setFavoriteMessages: Setter<ChatMessage[]>;
  setLeftPaneMode: Setter<'conversations' | 'favorites' | 'globalSearch'>;
  setActiveConvId: Setter<number | null>;
  setMessages: Setter<ChatMessage[]>;
  setHasMore: Setter<boolean>;
  setOldestMsgId: Setter<number | null>;
  setContextMode: Setter<{ anchorMessageId: number; keyword: string } | null>;
  setReadStates: Setter<ChatReadState[]>;
  setOnlineUserIds: Setter<Set<number>>;
  setLastSeenMap: Setter<Record<number, string | null>>;
}) {
  const fetchPinnedMessages = useCallback(async (convId: number) => {
    const res = await request.get<ChatMessage[]>(`/api/chat/conversations/${convId}/pinned-messages`, { silent: true });
    if (res.code === 0 && res.data) setPinnedMessages(res.data);
  }, []);

  const fetchFavoriteMessages = useCallback(async () => {
    const res = await request.get<{ list: ChatMessage[] }>(`/api/chat/favorite-messages?page=1&pageSize=100`, { silent: true });
    if (res.code === 0 && res.data) setFavoriteMessages(res.data.list);
  }, []);

  // 群公告历史是抽屉打开时才需要的非实时数据，交给 Query 持有：
  // 删除后由 mutation 失效，无需在页面里手工维护数组
  const announcementHistoryQuery = useChatAnnouncementHistory(
    activeConvId ?? undefined,
    announcementHistoryVisible,
  );
  const announcementHistory = announcementHistoryQuery.data ?? EMPTY_ANNOUNCEMENT_HISTORY;
  const deleteAnnouncementHistoryMutation = useDeleteChatAnnouncementHistory();

  const isOwnerOfActiveGroup = useMemo(() => {
    if (!currentUserId || activeConv?.type !== 'group') return false;
    return activeGroupMembers.some((m) => m.id === currentUserId && m.role === 'owner');
  }, [activeConv?.type, activeGroupMembers, currentUserId]);

  const handleDeleteAnnouncementHistory = useCallback((messageId: number) => {
    if (!activeConvId) return;
    confirmDelete({
      title: '删除公告历史',
      content: '确定要删除该条公告历史记录吗？此操作不可恢复。',
      onOk: async () => {
        await deleteAnnouncementHistoryMutation.mutateAsync({ conversationId: activeConvId, messageId });
        Toast.success('已删除');
      },
    });
  }, [activeConvId, deleteAnnouncementHistoryMutation]);

  const openFavoriteMessage = useCallback(async (message: ChatMessage) => {
    const res = await request.get<ChatMessageContext>(
      `/api/chat/conversations/${message.conversationId}/messages/${message.id}/context?before=15&after=15`,
      { silent: true },
    );
    if (res.code !== 0 || !res.data) {
      Toast.error(res.message ?? '定位收藏消息失败');
      return;
    }
    setLeftPaneMode('conversations');
    setActiveConvId(message.conversationId);
    setMessages(res.data.list);
    setHasMore(res.data.hasBefore);
    setOldestMsgId(res.data.list[0]?.id ?? null);
    setContextMode({ anchorMessageId: res.data.anchorMessageId, keyword: '收藏消息' });
    const anchorMessageId = res.data.anchorMessageId;
    setTimeout(() => {
      const el = document.getElementById(`msg-${anchorMessageId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s ease';
      el.style.background = 'var(--semi-color-primary-light-hover)';
      setTimeout(() => { el.style.background = ''; }, 1200);
    }, 80);
  }, []);

  const fetchReadStates = useCallback(async (convId: number) => {
    const res = await request.get<ChatReadState[]>(`/api/chat/conversations/${convId}/read-states`, { silent: true });
    if (res.code === 0 && res.data) setReadStates(res.data);
  }, []);

  const fetchPresence = useCallback(async (userIds: number[]) => {
    const ids = [...new Set(userIds)].filter((id) => id > 0);
    if (ids.length === 0) return;
    const res = await request.get<ChatPresence[]>(`/api/chat/presence?userIds=${ids.join(',')}`, { silent: true });
    if (res.code !== 0 || !res.data) return;
    setOnlineUserIds((prev) => {
      const next = new Set(prev);
      for (const p of res.data!) {
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
      }
      return next;
    });
    setLastSeenMap((prev) => {
      const next = { ...prev };
      for (const p of res.data!) next[p.userId] = p.lastSeen;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeConvId) {
      setPinnedMessages([]);
      setReadStates([]);
      return;
    }
    void fetchPinnedMessages(activeConvId);
    void fetchReadStates(activeConvId);
  }, [activeConvId, fetchPinnedMessages, fetchReadStates]);

  // 拉取相关用户在线状态：单聊对方 + 当前群成员
  useEffect(() => {
    const directIds = conversations
      .filter((c) => c.type === 'direct' && c.targetUser)
      .map((c) => c.targetUser!.id);
    const groupIds = activeGroupMembers.map((m) => m.id);
    void fetchPresence([...directIds, ...groupIds]);
  }, [conversations, activeGroupMembers, fetchPresence]);

  // 计算单条消息的已读回执（仅对自己发送的消息）
  const computeReadReceipt = useCallback((msg: ChatMessage): MessageReadReceipt | undefined => {
    if (!activeConv || msg.senderId !== currentUserId) return undefined;
    if (msg.isRecalled || msg.type === 'system') return undefined;
    const isRead = (s: ChatReadState) => !!s.lastReadAt && s.lastReadAt >= msg.createdAt;
    if (activeConv.type === 'direct') {
      const other = readStates[0];
      return { kind: 'direct', read: other ? isRead(other) : false };
    }
    const readers = readStates.filter(isRead);
    const unreaders = readStates.filter((s) => !isRead(s));
    return {
      kind: 'group',
      readCount: readers.length,
      total: readStates.length,
      readers: readers.map((s) => ({ nickname: s.nickname, avatar: s.avatar })),
      unreaders: unreaders.map((s) => ({ nickname: s.nickname, avatar: s.avatar })),
    };
  }, [activeConv, currentUserId, readStates]);

  return {
    fetchPinnedMessages, fetchFavoriteMessages, announcementHistory, isOwnerOfActiveGroup, handleDeleteAnnouncementHistory, openFavoriteMessage,
    fetchReadStates, fetchPresence, computeReadReceipt,
  };
}
