import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { ChatConversation } from '@zenith/shared/chat';
import type { WsMessage } from '@zenith/shared/platform';
import { useWebSocket } from '@/hooks/useWebSocket';
import { request } from '@/utils/request';
import { getChatNotifyPrefs } from '@/pages/chat/notifyPrefs';
import { getMessageSummary } from '@/pages/chat/utils';

let sharedAudioCtx: AudioContext | null = null;

/** 用 WebAudio 播放一声短促提示音，无需音频资源文件 */
function playBeep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    sharedAudioCtx = sharedAudioCtx ?? new Ctor();
    const ctx = sharedAudioCtx;
    void ctx.resume?.();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
  } catch { /* ignore */ }
}

function isAbsoluteUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/**
 * 全局聊天通知器：标签页失焦时收到新消息，弹出桌面通知 + 提示音。
 * 尊重会话免打扰与用户偏好（localStorage）。挂载于 AdminLayout 一次即可。
 */
export function useChatNotifier(currentUserId: number | null) {
  const navigate = useNavigate();
  const location = useLocation();
  const mutedRef = useRef<Set<number>>(new Set());
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const refreshMuted = useCallback(async () => {
    const res = await request.get<ChatConversation[]>('/api/chat/conversations', { silent: true });
    if (res.code === 0 && res.data) {
      mutedRef.current = new Set(res.data.filter((c) => c.isMuted).map((c) => c.id));
    }
  }, []);

  useEffect(() => {
    if (currentUserId == null) return;
    void refreshMuted();
    const onFocus = () => { void refreshMuted(); };
    globalThis.addEventListener('focus', onFocus);
    const timer = globalThis.setInterval(() => { void refreshMuted(); }, 60_000);
    return () => {
      globalThis.removeEventListener('focus', onFocus);
      globalThis.clearInterval(timer);
    };
  }, [currentUserId, refreshMuted]);

  const handler = useCallback((wsMsg: WsMessage) => {
    if (wsMsg.type !== 'chat:message') return;
    const msg = wsMsg.payload;
    if (!msg.senderId || msg.senderId === currentUserId) return;
    // 仅在标签页失焦时提醒，避免打扰正在使用的用户
    if (!document.hidden) return;
    if (mutedRef.current.has(msg.conversationId)) return;

    const prefs = getChatNotifyPrefs();
    if (prefs.sound) playBeep();

    if (prefs.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notification = new Notification(msg.senderName ?? '新消息', {
          body: getMessageSummary(msg),
          tag: `chat-${msg.conversationId}`,
          icon: isAbsoluteUrl(msg.senderAvatar) ? msg.senderAvatar : undefined,
        });
        notification.onclick = () => {
          globalThis.focus();
          navigate(`/chat?conv=${msg.conversationId}`);
          notification.close();
        };
      } catch { /* ignore */ }
    }
  }, [currentUserId, navigate]);

  useWebSocket(handler);
}
