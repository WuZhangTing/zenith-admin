import { useCallback } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import { request } from '@/utils/request';
import { sendWsMessage } from '@/hooks/useWebSocket';
import { useAddChatCustomEmoji } from '@/hooks/queries/chat';
import type { ChatAssetMeta, ChatCustomEmoji, ChatLinkPreview, ChatMessage } from '@zenith/shared/chat';
import { getFileExtension, getImageDimensions } from '../utils';
import type { Setter } from '../types';
import { useVoiceRecorder } from '../useVoiceRecorder';

/** 文件/图片/贴纸/语音发送、正在输入节流、链接预览抓取（自 ChatPage 原样搬移） */
export function useSendMedia({
  activeConvId, currentUserId, currentUserNickname, appendMessageOnce, addEmojiMutation, typingThrottleRef,
  setEmojiVisible,
}: {
  activeConvId: number | null;
  currentUserId: number | null;
  currentUserNickname: string;
  appendMessageOnce: (message: ChatMessage) => void;
  addEmojiMutation: ReturnType<typeof useAddChatCustomEmoji>;
  typingThrottleRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  setEmojiVisible: Setter<boolean>;
}) {
  const sendFileMessage = useCallback(async (file: File, onProgress?: (percent: number) => void) => {
    if (!activeConvId) return false;
    const fd = new FormData();
    fd.append('file', file);
    const uploadRes = await request.postForm<{ id: string; url: string; originalName: string; size: number }>(
      '/api/files/upload-one',
      fd,
      { onProgress, silent: true },
    );
    if (uploadRes.code !== 0 || !uploadRes.data) return false;
    const { id: fileId, url, originalName, size } = uploadRes.data;
    // 视频文件走 video 消息类型（内联播放），其余为普通文件
    const isVideo = (file.type || '').startsWith('video/');
    const asset: ChatAssetMeta = {
      kind: isVideo ? 'video' : 'file',
      name: originalName,
      size,
      mimeType: file.type || null,
      extension: getFileExtension(originalName),
      fileId,
    };
    const msgRes = await request.post<ChatMessage>(`/api/chat/conversations/${activeConvId}/messages`, {
      content: url,
      type: isVideo ? 'video' : 'file',
      extra: { asset },
    }, { silent: true });
    if (msgRes.code === 0 && msgRes.data) appendMessageOnce(msgRes.data);
    return msgRes.code === 0 && Boolean(msgRes.data);
  }, [activeConvId, appendMessageOnce]);

  // 发送收藏表情（作为图片消息）
  const sendSticker = useCallback(async (emoji: ChatCustomEmoji) => {
    if (!activeConvId) return;
    const asset: ChatAssetMeta = {
      kind: 'image',
      name: emoji.name ?? '表情',
      size: 0,
      mimeType: null,
      extension: null,
      fileId: emoji.fileId,
      width: emoji.width,
      height: emoji.height,
      thumbnailUrl: emoji.url,
    };
    const res = await request.post<ChatMessage>(`/api/chat/conversations/${activeConvId}/messages`, {
      content: emoji.url,
      type: 'image',
      extra: { asset },
    });
    if (res.code === 0 && res.data) appendMessageOnce(res.data);
    setEmojiVisible(false);
  }, [activeConvId, appendMessageOnce]);

  // 图片消息 → 收藏为自定义表情
  const handleSaveAsEmoji = useCallback((msg: ChatMessage) => {
    const asset = msg.extra?.asset;
    void addEmojiMutation.mutateAsync({
      url: msg.content,
      fileId: asset?.fileId ?? null,
      name: asset?.name ?? null,
      width: asset?.width ?? null,
      height: asset?.height ?? null,
    }).then(() => Toast.success('已收藏为表情')).catch(() => undefined);
  }, [addEmojiMutation]);

  const handleTyping = useCallback((newValue: string) => {
    if (!activeConvId || !currentUserId || !newValue.trim()) return;
    if (typingThrottleRef.current) return;
    sendWsMessage({ type: 'chat:typing', payload: { conversationId: activeConvId, userId: currentUserId, nickname: currentUserNickname } });
    typingThrottleRef.current = setTimeout(() => { typingThrottleRef.current = null; }, 3000);
  }, [activeConvId, currentUserId, currentUserNickname]);

  const sendImageFile = useCallback(async (file: File, onProgress?: (percent: number) => void) => {
    if (!activeConvId) return false;
    const dimensions = await getImageDimensions(file);
    const fd = new FormData();
    fd.append('file', file);
    const uploadRes = await request.postForm<{ url: string; originalName: string; size: number }>(
      '/api/files/upload-one',
      fd,
      { onProgress, silent: true },
    );
    if (uploadRes.code !== 0 || !uploadRes.data) {
      return false;
    }
    const { url, originalName, size } = uploadRes.data;
    const asset: ChatAssetMeta = {
      kind: 'image',
      name: originalName,
      size,
      mimeType: file.type || null,
      extension: getFileExtension(originalName),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      thumbnailUrl: url,
    };
    const msgRes = await request.post<ChatMessage>(`/api/chat/conversations/${activeConvId}/messages`, {
      content: url,
      type: 'image',
      extra: { asset },
    }, { silent: true });
    if (msgRes.code === 0 && msgRes.data) appendMessageOnce(msgRes.data);
    return msgRes.code === 0 && Boolean(msgRes.data);
  }, [activeConvId, appendMessageOnce]);

  const sendVoiceMessage = useCallback(async (blob: Blob, durationSec: number, mimeType: string) => {
    if (!activeConvId) return;
    const ext = mimeType.includes('mp4') ? 'm4a' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType });
    const fd = new FormData();
    fd.append('file', file);
    const uploadRes = await request.postForm<{ id: string; url: string; originalName: string; size: number }>(
      '/api/files/upload-one',
      fd,
      { silent: true },
    );
    if (uploadRes.code !== 0 || !uploadRes.data) { Toast.error('语音上传失败'); return; }
    const { id: fileId, url, size } = uploadRes.data;
    const asset: ChatAssetMeta = {
      kind: 'voice',
      name: file.name,
      size,
      mimeType,
      extension: ext,
      fileId,
      duration: Math.max(1, Math.round(durationSec)),
    };
    const msgRes = await request.post<ChatMessage>(`/api/chat/conversations/${activeConvId}/messages`, {
      content: url,
      type: 'voice',
      extra: { asset },
    }, { silent: true });
    if (msgRes.code === 0 && msgRes.data) appendMessageOnce(msgRes.data);
    else Toast.error(msgRes.code === 0 ? '语音发送失败' : (msgRes.message || '语音发送失败'));
  }, [activeConvId, appendMessageOnce]);

  const voiceRecorder = useVoiceRecorder({
    maxSeconds: 60,
    onStop: (blob, seconds, mimeType) => { void sendVoiceMessage(blob, seconds, mimeType); },
    onError: (message) => Toast.warning(message),
  });

  const fetchLinkPreview = useCallback(async (url: string): Promise<ChatLinkPreview | null> => {
    const res = await request.get<ChatLinkPreview>(`/api/chat/link-preview?url=${encodeURIComponent(url)}`, { silent: true });
    if (res.code === 0 && res.data) return res.data;
    return null;
  }, []);

  return {
    sendFileMessage, sendSticker, handleSaveAsEmoji, handleTyping, sendImageFile, sendVoiceMessage,
    voiceRecorder, fetchLinkPreview,
  };
}
