// ─── 会话 / 成员 ─────────────────────────────────────────────────────────────
export const CHAT_CONVERSATION_TYPES = ['direct', 'group'] as const;
export type ChatConversationType = (typeof CHAT_CONVERSATION_TYPES)[number];

export const CHAT_MEMBER_ROLES = ['owner', 'admin', 'member'] as const;
export type ChatMemberRole = (typeof CHAT_MEMBER_ROLES)[number];

export const CHAT_JOIN_REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ChatJoinRequestStatus = (typeof CHAT_JOIN_REQUEST_STATUSES)[number];

// ─── 消息 ────────────────────────────────────────────────────────────────────
export const CHAT_MESSAGE_TYPES = ['text', 'image', 'file', 'system', 'forward', 'vote', 'voice', 'card', 'video'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

/** 用户可主动发送的消息类型（system / card 仅由服务端产生） */
export const CHAT_SENDABLE_MESSAGE_TYPES = ['text', 'image', 'file', 'forward', 'vote', 'voice', 'video'] as const;

/** 媒体类消息：content 是被渲染为 src / href 的资源地址 */
export const CHAT_MEDIA_MESSAGE_TYPES = ['image', 'file', 'voice', 'video'] as const;
export type ChatAssetKind = (typeof CHAT_MEDIA_MESSAGE_TYPES)[number];

export const CHAT_FORWARD_MODES = ['merge', 'individual'] as const;
export type ChatForwardMode = (typeof CHAT_FORWARD_MODES)[number];

export const CHAT_SCHEDULED_STATUSES = ['pending', 'sent', 'canceled', 'failed'] as const;
export type ChatScheduledStatus = (typeof CHAT_SCHEDULED_STATUSES)[number];

// ─── 卡片消息 ────────────────────────────────────────────────────────────────
export const CHAT_CARD_ACTION_THEMES = ['primary', 'secondary', 'danger', 'tertiary'] as const;
export type ChatCardActionTheme = (typeof CHAT_CARD_ACTION_THEMES)[number];

export const CHAT_CARD_ACTION_TYPES = ['workflow:approve', 'workflow:reject', 'link', 'none'] as const;
export type ChatCardActionType = (typeof CHAT_CARD_ACTION_TYPES)[number];

export const CHAT_CARD_STATUSES = ['pending', 'done'] as const;
export type ChatCardStatus = (typeof CHAT_CARD_STATUSES)[number];

// ─── WebRTC 音视频通话 ───────────────────────────────────────────────────────
export const RTC_CALL_TYPES = ['audio', 'video'] as const;
export type RtcCallType = (typeof RTC_CALL_TYPES)[number];

export const RTC_CALL_MODES = ['p2p', 'group'] as const;
export type RtcCallMode = (typeof RTC_CALL_MODES)[number];

export const CHAT_CALL_RECORD_STATUSES = ['completed', 'missed', 'canceled', 'rejected'] as const;
export type ChatCallRecordStatus = (typeof CHAT_CALL_RECORD_STATUSES)[number];
