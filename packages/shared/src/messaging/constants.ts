import type { InAppMessageType, SendSource, SendStatus, SmsProvider } from './types';

export const BUSINESS_TYPES = ['announcement'] as const;

export type BusinessType = typeof BUSINESS_TYPES[number];

// ─── 通知/告警渠道 ────────────────────────────────────────────────────
/**
 * 通知渠道统一文案（站内信/邮件/Webhook）。
 * 注意：report 域后端 value 为驼峰 `inApp`（历史枚举），label 仍统一复用此处，
 * 渲染时可用 `value.toLowerCase()` 归一后查表。
 */
export const NOTIFY_CHANNEL_LABELS = {
  inapp: '站内信',
  email: '邮件',
  webhook: 'Webhook',
} as const;

export type NotifyChannel = keyof typeof NOTIFY_CHANNEL_LABELS;

/** 通知渠道下拉选项（与 NOTIFY_CHANNEL_LABELS 自动同步） */
export const NOTIFY_CHANNEL_OPTIONS: Array<{ value: NotifyChannel; label: string }> =
  (Object.keys(NOTIFY_CHANNEL_LABELS) as NotifyChannel[]).map((value) => ({ value, label: NOTIFY_CHANNEL_LABELS[value] }));

// ─── Channel（站内公众号 / 系统号）────────────────────────────────────────────
export const CHANNEL_TYPES = ['system', 'business'] as const;

export const CHANNEL_AUDIENCE_TYPES = ['broadcast', 'targeted'] as const;

export const CHANNEL_MESSAGE_TYPES = ['text', 'card', 'image', 'news'] as const;

export const CHANNEL_MESSAGE_STATUSES = ['sent', 'draft', 'scheduled'] as const;

export const CHANNEL_PUBLISH_AUDIENCE_MODES = ['all', 'users', 'departments', 'roles'] as const;

export const CHANNEL_SEND_MODES = ['now', 'scheduled', 'draft'] as const;

export const CHANNEL_MESSAGE_DIRECTIONS = ['out', 'in'] as const;

export const CHANNEL_MENU_TYPES = ['click', 'view'] as const;

export const CHANNEL_AUTO_REPLY_MATCH_TYPES = ['subscribe', 'keyword', 'default'] as const;

export const CHANNEL_AUTO_REPLY_KEYWORD_MODES = ['exact', 'contains'] as const;

export const CHANNEL_CONVERSATION_STATUSES = ['open', 'processing', 'resolved'] as const;

export const CHANNEL_MENU_TYPE_LABELS: Record<(typeof CHANNEL_MENU_TYPES)[number], string> = {
  click: '点击关键词',
  view: '跳转链接',
};

export const CHANNEL_AUTO_REPLY_MATCH_LABELS: Record<(typeof CHANNEL_AUTO_REPLY_MATCH_TYPES)[number], string> = {
  subscribe: '关注欢迎语',
  keyword: '关键词回复',
  default: '默认兜底回复',
};

export const CHANNEL_AUTO_REPLY_KEYWORD_MODE_LABELS: Record<(typeof CHANNEL_AUTO_REPLY_KEYWORD_MODES)[number], string> = {
  exact: '完全匹配',
  contains: '包含匹配',
};

export const CHANNEL_MESSAGE_TYPE_LABELS: Record<(typeof CHANNEL_MESSAGE_TYPES)[number], string> = {
  text: '文本',
  image: '图片',
  news: '图文',
  card: '卡片',
};

export const CHANNEL_MESSAGE_STATUS_LABELS: Record<(typeof CHANNEL_MESSAGE_STATUSES)[number], string> = {
  sent: '已发送',
  draft: '草稿',
  scheduled: '定时待发',
};

export const CHANNEL_PUBLISH_AUDIENCE_MODE_LABELS: Record<(typeof CHANNEL_PUBLISH_AUDIENCE_MODES)[number], string> = {
  all: '全体成员',
  users: '指定用户',
  departments: '按部门',
  roles: '按角色',
};

export const CHANNEL_SEND_MODE_LABELS: Record<(typeof CHANNEL_SEND_MODES)[number], string> = {
  now: '立即发送',
  scheduled: '定时发送',
  draft: '存草稿',
};

export const CHANNEL_CONVERSATION_STATUS_LABELS: Record<(typeof CHANNEL_CONVERSATION_STATUSES)[number], string> = {
  open: '待处理',
  processing: '处理中',
  resolved: '已解决',
};

// ─── 消息与短信 ────────────────────────────────────────────────────────
export const SMS_PROVIDER_LABELS: Record<SmsProvider, string> = {
  aliyun: '阿里云',
  tencent: '腾讯云',
};

export const SMS_PROVIDER_OPTIONS: Array<{ value: SmsProvider; label: string }> =
  (Object.keys(SMS_PROVIDER_LABELS) as SmsProvider[])
    .map((value) => ({ value, label: SMS_PROVIDER_LABELS[value] }));

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  pending: '待发送',
  success: '已发送',
  failed: '失败',
};

export const SEND_STATUS_OPTIONS: Array<{ value: SendStatus; label: string }> =
  (Object.keys(SEND_STATUS_LABELS) as SendStatus[])
    .map((value) => ({ value, label: SEND_STATUS_LABELS[value] }));

export const SEND_SOURCE_LABELS: Record<SendSource, string> = {
  manual: '手动',
  test: '测试',
  system: '系统',
  api: 'API',
};

export const SEND_SOURCE_OPTIONS: Array<{ value: SendSource; label: string }> =
  (Object.keys(SEND_SOURCE_LABELS) as SendSource[])
    .map((value) => ({ value, label: SEND_SOURCE_LABELS[value] }));

export const IN_APP_MESSAGE_TYPE_LABELS: Record<InAppMessageType, string> = {
  info: '通知',
  success: '成功',
  warning: '警告',
  error: '错误',
};

export const IN_APP_MESSAGE_TYPE_OPTIONS: Array<{ value: InAppMessageType; label: string }> =
  (Object.keys(IN_APP_MESSAGE_TYPE_LABELS) as InAppMessageType[])
    .map((value) => ({ value, label: IN_APP_MESSAGE_TYPE_LABELS[value] }));
