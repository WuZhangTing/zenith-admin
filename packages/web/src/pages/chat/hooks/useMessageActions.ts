import { useCallback } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';
import { confirmDelete } from '@/utils/confirm';
import type { ChatMessage, ChatMessageExtra, ChatVoteData } from '@zenith/shared/chat';
import { removeMessageById, removeMessagesByIds, setMessageReactions } from '../utils-state';
import type { Setter } from '../types';

/** 消息级操作：收藏/置顶/转发/删除/表情回应/投票/编辑/撤回（自 ChatPage 原样搬移） */
export function useMessageActions({
  activeConvId, messages, selectedMessageIds, recalledDrafts, forwardingMessageIds, forwardingMode,
  inputRef, applyMessageUpdate, appendMessageOnce, setInput, setSelectedMentions,
  setMultiSelectMode, setSelectedMessageIds, setForwardingMode, setForwardingMessageIds, setForwardModalVisible, setForwardViewItems,
  setForwardViewTitle, setForwardViewVisible, setMessages, setMediaItems, setReactionTargetMsgId, setReactionPickerAnchor,
  setReactionPickerVisible, setShowVoteModal, setRecalledDrafts,
}: {
  activeConvId: number | null;
  messages: ChatMessage[];
  selectedMessageIds: number[];
  recalledDrafts: Record<number, { content: string; mentions?: Array<{ userId: number; nickname: string }> }>;
  forwardingMessageIds: number[];
  forwardingMode: 'merge' | 'individual';
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  applyMessageUpdate: (message: ChatMessage) => void;
  appendMessageOnce: (message: ChatMessage) => void;
  setInput: Setter<string>;
  setSelectedMentions: Setter<Array<{ userId: number; nickname: string }>>;
  setMultiSelectMode: Setter<boolean>;
  setSelectedMessageIds: Setter<number[]>;
  setForwardingMode: Setter<'merge' | 'individual'>;
  setForwardingMessageIds: Setter<number[]>;
  setForwardModalVisible: Setter<boolean>;
  setForwardViewItems: Setter<NonNullable<ChatMessageExtra['forwardedMessages']>>;
  setForwardViewTitle: Setter<string>;
  setForwardViewVisible: Setter<boolean>;
  setMessages: Setter<ChatMessage[]>;
  setMediaItems: Setter<ChatMessage[]>;
  setReactionTargetMsgId: Setter<number | null>;
  setReactionPickerAnchor: Setter<{ top: number; right: number } | null>;
  setReactionPickerVisible: Setter<boolean>;
  setShowVoteModal: Setter<boolean>;
  setRecalledDrafts: Setter<Record<number, { content: string; mentions?: Array<{ userId: number; nickname: string }> }>>;
}) {
  const handleToggleFavorite = useCallback(async (msg: ChatMessage) => {
    const res = await request.patch<ChatMessage>(`/api/chat/messages/${msg.id}/favorite`, { favorite: !msg.extra?.isFavorited });
    if (res.code !== 0) return;
    if (!res.data) { Toast.error('操作失败'); return; }
    applyMessageUpdate(res.data);
    Toast.success(res.data.extra?.isFavorited ? '已收藏' : '已取消收藏');
  }, [applyMessageUpdate]);

  const handleTogglePinMessage = useCallback(async (msg: ChatMessage) => {
    const res = await request.patch<ChatMessage>(`/api/chat/messages/${msg.id}/pin`, { pin: !msg.extra?.isPinned });
    if (res.code !== 0) return;
    if (!res.data) { Toast.error('操作失败'); return; }
    applyMessageUpdate(res.data);
    Toast.success(res.data.extra?.isPinned ? '已置顶消息' : '已取消置顶');
  }, [applyMessageUpdate]);

  const handleEditRecalled = useCallback((messageId: number) => {
    const draft = recalledDrafts[messageId];
    if (!draft) return;
    setInput(draft.content);
    setSelectedMentions(draft.mentions ?? []);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [recalledDrafts]);

  const handleToggleSelectMessage = useCallback((msg: ChatMessage) => {
    if (msg.isRecalled || msg.type === 'system') return;
    setMultiSelectMode(true);
    setSelectedMessageIds((prev) =>
      prev.includes(msg.id) ? prev.filter((id) => id !== msg.id) : [...prev, msg.id],
    );
  }, []);

  const handleExitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedMessageIds([]);
  }, []);

  const handleForwardSingle = useCallback((msg: ChatMessage) => {
    setForwardingMode('individual');
    setForwardingMessageIds([msg.id]);
    setForwardModalVisible(true);
  }, []);

  const handleForwardSelected = useCallback((mode: 'merge' | 'individual') => {
    if (selectedMessageIds.length === 0) return;
    setForwardingMode(mode);
    setForwardingMessageIds([...selectedMessageIds]);
    setForwardModalVisible(true);
  }, [selectedMessageIds]);

  const handleForwardConfirm = useCallback(async (targetIds: number[]) => {
    setForwardModalVisible(false);
    const res = await request.post('/api/chat/messages/forward', {
      messageIds: forwardingMessageIds,
      targetConversationIds: targetIds,
      mode: forwardingMode,
    });
    if (res.code === 0) {
      Toast.success('转发成功');
      handleExitMultiSelect();
    }
    setForwardingMessageIds([]);
  }, [forwardingMessageIds, forwardingMode, handleExitMultiSelect]);

  const handleFavoriteSelected = useCallback(async () => {
    if (selectedMessageIds.length === 0) return;
    const msgs = messages.filter((m) => selectedMessageIds.includes(m.id) && !m.extra?.isFavorited && !m.isRecalled && m.type !== 'system');
    if (msgs.length === 0) { Toast.info('所选消息已全部收藏'); return; }
    let successCount = 0;
    for (const msg of msgs) {
      const res = await request.patch<ChatMessage>(`/api/chat/messages/${msg.id}/favorite`, { favorite: true });
      if (res.code === 0 && res.data) {
        applyMessageUpdate(res.data);
        successCount += 1;
      }
    }
    Toast.success(`已收藏 ${successCount} 条消息`);
    handleExitMultiSelect();
  }, [selectedMessageIds, messages, applyMessageUpdate, handleExitMultiSelect]);

  const handleOpenForwardView = useCallback((items: NonNullable<ChatMessageExtra['forwardedMessages']>, title: string) => {
    setForwardViewItems(items);
    setForwardViewTitle(title);
    setForwardViewVisible(true);
  }, []);

  const handleDeleteSingle = useCallback(async (msg: ChatMessage) => {
    const res = await request.post('/api/chat/messages/batch-delete', { messageIds: [msg.id] });
    if (res.code !== 0) return;
    setMessages(removeMessageById(msg.id));
    setMediaItems(removeMessageById(msg.id));
    Toast.success('已删除');
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedMessageIds.length === 0) return;
    confirmDelete({
      title: `删除已选的 ${selectedMessageIds.length} 条消息？`,
      content: '删除后仅对自己隐藏，不影响其他人。',
      okText: '删除',
      onOk: async () => {
        const res = await request.post('/api/chat/messages/batch-delete', { messageIds: selectedMessageIds });
        if (res.code !== 0) return;
        const deletedIds = new Set(selectedMessageIds);
        setMessages(removeMessagesByIds(deletedIds));
        setMediaItems(removeMessagesByIds(deletedIds));
        Toast.success('已删除');
        handleExitMultiSelect();
      },
    });
  }, [selectedMessageIds, handleExitMultiSelect]);

  const handleReaction = useCallback((messageId: number, emoji: string) => {
    void request.post<import('@zenith/shared').ChatReactionGroup[]>(
      `/api/chat/messages/${messageId}/reactions`,
      { emoji },
    ).then((res) => {
      if (res.code === 0) {
        setMessages(setMessageReactions(messageId, res.data ?? []));
      }
    });
  }, []);

  const handlePickReactionEmoji = useCallback((messageId: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setReactionTargetMsgId(messageId);
    setReactionPickerAnchor({ top: rect.top, right: window.innerWidth - rect.right });
    setReactionPickerVisible(true);
  }, []);

  const handleCreateVote = useCallback(async (voteData: ChatVoteData, question: string) => {
    if (!activeConvId) return;
    const res = await request.post<ChatMessage>(`/api/chat/conversations/${activeConvId}/messages`, {
      content: question,
      type: 'vote',
      extra: { voteData },
    });
    if (res.code !== 0) return;
    if (!res.data) { Toast.error('发起投票失败'); return; }
    appendMessageOnce(res.data);
    setShowVoteModal(false);
  }, [activeConvId, appendMessageOnce]);

  const handleVoteMessage = useCallback(async (msg: ChatMessage, optionIds: string[]) => {
    const res = await request.post<ChatMessage>(`/api/chat/messages/${msg.id}/vote`, { optionIds });
    if (res.code !== 0) return;
    if (!res.data) { Toast.error('投票失败'); return; }
    applyMessageUpdate(res.data);
  }, [applyMessageUpdate]);

  // 编辑消息（由 MessageBubble 内联编辑回调）
  // ─── 消息编辑 ─────────────────────────────────────────────────────────────

  const handleEditMessage = useCallback(async (updatedMsg: ChatMessage) => {
    const res = await request.request<ChatMessage>(`/api/chat/messages/${updatedMsg.id}/edit`, {
      method: 'PATCH',
      body: JSON.stringify({ content: updatedMsg.content }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.code !== 0) return;
    if (!res.data) { Toast.error('编辑失败'); return; }
    applyMessageUpdate(res.data);
    Toast.success('已修改');
  }, [applyMessageUpdate]);

  const handleRecall = useCallback(async (msg: ChatMessage) => {
    if (msg.type === 'text') {
      setRecalledDrafts((prev) => ({
        ...prev,
        [msg.id]: { content: msg.content, mentions: msg.extra?.mentions ?? undefined },
      }));
      setInput(msg.content);
      setSelectedMentions(msg.extra?.mentions ?? []);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    await request.request<null>(`/api/chat/messages/${msg.id}/recall`, { method: 'PATCH' });
  }, []);

  return {
    handleToggleFavorite, handleTogglePinMessage, handleEditRecalled, handleToggleSelectMessage, handleExitMultiSelect, handleForwardSingle,
    handleForwardSelected, handleForwardConfirm, handleFavoriteSelected, handleOpenForwardView, handleDeleteSingle, handleDeleteSelected,
    handleReaction, handlePickReactionEmoji, handleCreateVote, handleVoteMessage, handleEditMessage, handleRecall,
  };
}
