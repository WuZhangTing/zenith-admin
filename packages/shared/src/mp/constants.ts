import type { MpBroadcastType, MpMaterialType, MpMessageType, MpReplyContentType } from './types';

// ─── 公众号媒体类型 ────────────────────────────────────────────────────
export const MP_REPLY_CONTENT_TYPE_LABELS: Record<MpReplyContentType, string> = {
  text: '文本',
  image: '图片',
  voice: '语音',
  video: '视频',
  news: '图文',
};

export const MP_REPLY_CONTENT_TYPE_OPTIONS: Array<{ value: MpReplyContentType; label: string }> =
  (Object.keys(MP_REPLY_CONTENT_TYPE_LABELS) as MpReplyContentType[])
    .map((value) => ({ value, label: MP_REPLY_CONTENT_TYPE_LABELS[value] }));

export const MP_BROADCAST_TYPE_LABELS: Record<MpBroadcastType, string> = {
  text: '文本',
  image: '图片',
  mpnews: '图文',
};

export const MP_BROADCAST_TYPE_OPTIONS: Array<{ value: MpBroadcastType; label: string }> =
  (Object.keys(MP_BROADCAST_TYPE_LABELS) as MpBroadcastType[])
    .map((value) => ({ value, label: MP_BROADCAST_TYPE_LABELS[value] }));

export const MP_MATERIAL_TYPE_LABELS: Record<MpMaterialType, string> = {
  image: '图片',
  voice: '语音',
  video: '视频',
  thumb: '缩略图',
};

export const MP_MATERIAL_TYPE_OPTIONS: Array<{ value: MpMaterialType; label: string }> =
  (Object.keys(MP_MATERIAL_TYPE_LABELS) as MpMaterialType[])
    .map((value) => ({ value, label: MP_MATERIAL_TYPE_LABELS[value] }));

export const MP_MESSAGE_TYPE_LABELS: Record<MpMessageType, string> = {
  text: '文本',
  image: '图片',
  voice: '语音',
  video: '视频',
  shortvideo: '视频',
  location: '位置',
  link: '链接',
  event: '事件',
};

// ─── 自 validation 上移（枚举 SSOT：供跨域 z.enum() 引用，避免 validation 间值环）───
// 公众号客服消息（发送文本）
// 公众号网页授权（OAuth2）
export const MP_OAUTH_SCOPES = ['snsapi_base', 'snsapi_userinfo'] as const;

// 公众号客服消息（支持文本 / 图片 / 语音 / 视频 / 图文）
export const MP_CUSTOM_MSG_TYPES = ['text', 'image', 'voice', 'video', 'news'] as const;
