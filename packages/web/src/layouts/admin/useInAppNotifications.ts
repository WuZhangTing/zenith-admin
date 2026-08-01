import { useCallback, useEffect, useRef, useState } from 'react';
import type { InAppMessage, Announcement } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { markAnnouncementRead } from './utils';

// ─── 公告 / 站内信 ─────────────────────────────────────────────────────────
export function useInAppNotifications() {
  const [inAppMessages, setInAppMessages] = useState<InAppMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [announcementPopVisible, setAnnouncementPopVisible] = useState(false);
  const [recentAnnouncements, setRecentAnnouncements] = useState<(Announcement & { isRead: boolean })[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [messagePopVisible, setMessagePopVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<InAppMessage | null>(null);
  const recentInAppMessageRef = useRef(new Map<string, number>());

  const fetchAnnouncementUnreadCount = useCallback(() => {
    request.get<{ count: number }>('/api/announcements/unread-count', { silent: true }).then((res) => {
      if (res.code === 0 && res.data) setAnnouncementUnreadCount(res.data.count ?? 0);
    });
  }, []);

  const fetchRecentAnnouncements = useCallback(() => {
    request.get<(Announcement & { isRead: boolean })[]>('/api/announcements/published', { silent: true }).then((res) => {
      if (res.code === 0 && res.data) setRecentAnnouncements(res.data);
    });
  }, []);

  useEffect(() => { fetchAnnouncementUnreadCount(); }, [fetchAnnouncementUnreadCount]);

  // 监听 announcement 事件同步公告未读数
  useEffect(() => {
    const handler = () => { fetchAnnouncementUnreadCount(); fetchRecentAnnouncements(); };
    globalThis.addEventListener('announcement:refresh', handler);
    return () => globalThis.removeEventListener('announcement:refresh', handler);
  }, [fetchAnnouncementUnreadCount, fetchRecentAnnouncements]);

  const markAnnouncementAsRead = (id: number) => {
    request.post(`/api/announcements/${id}/read`, undefined, { silent: true }).then((res) => {
      if (res.code !== 0) return;
      setRecentAnnouncements(markAnnouncementRead(id));
      setAnnouncementUnreadCount((c) => Math.max(0, c - 1));
    });
  };

  const fetchInAppMessages = useCallback(() => {
    request.get<{ list: InAppMessage[]; total: number }>('/api/in-app-messages?page=1&pageSize=10', { silent: true }).then((res) => {
      if (res.code === 0 && res.data) setInAppMessages(res.data.list ?? []);
    });
    request.get<{ count: number }>('/api/in-app-messages/unread-count', { silent: true }).then((res) => {
      if (res.code === 0 && res.data) setUnreadCount(res.data.count ?? 0);
    });
  }, []);

  useEffect(() => { fetchInAppMessages(); }, [fetchInAppMessages]);

  // 监听其他页面（如站内信管理）触发的刷新事件，同步顶部铃铛 badge
  useEffect(() => {
    const handler = () => fetchInAppMessages();
    globalThis.addEventListener('in-app-messages:refresh', handler);
    return () => globalThis.removeEventListener('in-app-messages:refresh', handler);
  }, [fetchInAppMessages]);

  return {
    inAppMessages, setInAppMessages,
    unreadCount, setUnreadCount,
    announcementUnreadCount,
    announcementPopVisible, setAnnouncementPopVisible,
    recentAnnouncements,
    selectedAnnouncement, setSelectedAnnouncement,
    messagePopVisible, setMessagePopVisible,
    selectedMessage, setSelectedMessage,
    recentInAppMessageRef,
    fetchRecentAnnouncements, markAnnouncementAsRead, fetchInAppMessages,
  };
}

// ─── 聊天未读数 ────────────────────────────────────────────────────────────
export function useChatUnread() {
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  // 初次加载时拉取会话列表计算未读
  useEffect(() => {
    request.get<Array<{ unreadCount: number }>>('/api/chat/conversations', { silent: true }).then((res) => {
      if (res.code === 0 && res.data) {
        setChatUnreadCount(res.data.reduce((s, c) => s + (c.unreadCount ?? 0), 0));
      }
    });
  }, []);
  return { chatUnreadCount, setChatUnreadCount };
}
