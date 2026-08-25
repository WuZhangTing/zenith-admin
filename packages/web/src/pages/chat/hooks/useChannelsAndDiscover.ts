import { useCallback, useEffect } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';
import { confirmDanger } from '@/utils/confirm';
import { useDiscoverableChannels } from '@/hooks/queries/chat';
import type { ChatConversation } from '@zenith/shared/chat';
import type { Channel } from '@zenith/shared/messaging';
import type { Setter } from '../types';

/** 会话/频道列表加载 + 发现频道（防抖搜索、订阅/退订）（自 ChatPage 原样搬移） */
export function useChannelsAndDiscover({
  discoverVisible, discoverKeyword, debouncedDiscoverKeyword, setLoadingConvs, setConversations, setChannels,
  setActiveChannelId, setDiscoverKeyword, setDebouncedDiscoverKeyword, setDiscoverVisible,
}: {
  discoverVisible: boolean;
  discoverKeyword: string;
  debouncedDiscoverKeyword: string;
  setLoadingConvs: Setter<boolean>;
  setConversations: Setter<ChatConversation[]>;
  setChannels: Setter<Channel[]>;
  setActiveChannelId: Setter<number | null>;
  setDiscoverKeyword: Setter<string>;
  setDebouncedDiscoverKeyword: Setter<string>;
  setDiscoverVisible: Setter<boolean>;
}) {
  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true);
    const res = await request.get<ChatConversation[]>('/api/chat/conversations', { silent: true });
    setLoadingConvs(false);
    if (res.code === 0 && res.data) setConversations(res.data);
  }, []);

  useEffect(() => { void fetchConversations(); }, [fetchConversations]);

  const fetchChannels = useCallback(async () => {
    const res = await request.get<Channel[]>('/api/channels/mine', { silent: true });
    if (res.code === 0 && res.data) setChannels(res.data);
  }, []);

  useEffect(() => { void fetchChannels(); }, [fetchChannels]);

  /** 退订频道（自带确认弹窗）：确认逻辑收敛在此，所有入口（右键菜单/频道视图按钮）直接调用即可 */
  const handleUnsubscribeChannel = useCallback((ch: Channel) => {
    confirmDanger({
      title: `确定退订「${ch.name}」吗？`,
      content: '退订后将不再接收该频道的消息推送，可随时在「发现频道」中重新订阅。',
      onOk: async () => {
        const res = await request.delete(`/api/channels/${ch.id}/subscribe`);
        if (res.code === 0) {
          Toast.success('已退订');
          setActiveChannelId(null);
          void fetchChannels();
        }
      },
    });
  }, [fetchChannels]);

  const loadDiscoverList = useCallback(async (keyword: string) => {
    setDebouncedDiscoverKeyword(keyword.trim());
  }, []);

  const openDiscover = useCallback(() => {
    setDiscoverKeyword('');
    setDebouncedDiscoverKeyword('');
    setDiscoverVisible(true);
  }, []);

  // 发现频道搜索：打开时立即加载，输入关键词时 300ms 防抖重新加载
  useEffect(() => {
    if (!discoverVisible) return;
    const handler = setTimeout(() => { void loadDiscoverList(discoverKeyword); }, discoverKeyword.trim() ? 300 : 0);
    return () => clearTimeout(handler);
  }, [discoverVisible, discoverKeyword, loadDiscoverList]);

  const discoverableChannelsQuery = useDiscoverableChannels(
    { keyword: debouncedDiscoverKeyword || undefined },
    discoverVisible,
  );
  const { data: discoverableChannels, refetch: refetchDiscoverableChannels } = discoverableChannelsQuery;
  const discoverList = discoverableChannels ?? [];

  const handleSubscribeChannel = useCallback(async (ch: Channel) => {
    const res = await request.post(`/api/channels/${ch.id}/subscribe`, {});
    if (res.code === 0) {
      Toast.success('已订阅');
      void refetchDiscoverableChannels();
      void fetchChannels();
    }
  }, [fetchChannels, refetchDiscoverableChannels]);

  return {
    fetchConversations, fetchChannels, handleUnsubscribeChannel, loadDiscoverList, openDiscover, discoverList,
    handleSubscribeChannel,
  };
}
