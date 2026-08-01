import { useCallback, useEffect } from 'react';
import { request } from '@/utils/request';
import type { ChatMessage } from '@zenith/shared/chat';
import type { Setter } from '../types';

/** 媒体库（图片/文件/链接）分页拉取与联动刷新（自 ChatPage 原样搬移） */
export function useMediaLibrary({
  activeConvId, mediaType, showMediaPanel, setMediaHasMore, setMediaItems, setMediaLoading,
  setMediaPage,
}: {
  activeConvId: number | null;
  mediaType: 'image' | 'file' | 'link';
  showMediaPanel: boolean;
  setMediaHasMore: Setter<boolean>;
  setMediaItems: Setter<ChatMessage[]>;
  setMediaLoading: Setter<boolean>;
  setMediaPage: Setter<number>;
}) {
  const fetchMediaItems = useCallback(async (convId: number, type: 'image' | 'file' | 'link', p = 1) => {
    setMediaLoading(true);
    if (p === 1) setMediaItems([]);  // 切换 tab 时立即清空，避免旧数据短暂闪烁
    const qs = type === 'link'
      ? new URLSearchParams({ types: 'text', keyword: 'http', page: String(p), pageSize: '30' })
      : new URLSearchParams({ types: type, page: String(p), pageSize: '30' });
    const res = await request.get<{ list: Array<{ message: ChatMessage }> }>(
      `/api/chat/conversations/${convId}/messages/search?${qs.toString()}`,
      { silent: true },
    );
    setMediaLoading(false);
    if (res.code === 0 && res.data) {
      const rawCount = res.data.list.length;
      let items = res.data.list.map((item) => item.message);
      if (type === 'link') {
        items = items.filter((m) => m.extra?.linkPreview || /https?:\/\//i.test(m.content));
      }
      if (p === 1) {
        setMediaItems(items);
      } else {
        setMediaItems((prev) => [...prev, ...items]);
      }
      setMediaPage(p);
      setMediaHasMore(rawCount >= 30);
    }
  }, []);

  useEffect(() => {
    if (!showMediaPanel || !activeConvId) return;
    void fetchMediaItems(activeConvId, mediaType, 1);
  }, [showMediaPanel, activeConvId, mediaType, fetchMediaItems]);

  return { fetchMediaItems };
}
