import { createLabelOptionsFromMap } from '../core/enum-options';
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
  createLabelOptionsFromMap(NOTIFY_CHANNEL_LABELS);

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
  createLabelOptionsFromMap(SMS_PROVIDER_LABELS);

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  pending: '待发送',
  success: '已发送',
  failed: '失败',
};

export const SEND_STATUS_OPTIONS: Array<{ value: SendStatus; label: string }> =
  createLabelOptionsFromMap(SEND_STATUS_LABELS);

export const SEND_SOURCE_LABELS: Record<SendSource, string> = {
  manual: '手动',
  test: '测试',
  system: '系统',
  api: 'API',
};

export const SEND_SOURCE_OPTIONS: Array<{ value: SendSource; label: string }> =
  createLabelOptionsFromMap(SEND_SOURCE_LABELS);

export const IN_APP_MESSAGE_TYPE_LABELS: Record<InAppMessageType, string> = {
  info: '通知',
  success: '成功',
  warning: '警告',
  error: '错误',
};

export const IN_APP_MESSAGE_TYPE_OPTIONS: Array<{ value: InAppMessageType; label: string }> =
  createLabelOptionsFromMap(IN_APP_MESSAGE_TYPE_LABELS);

// ─── 通知中心（Notification Center）─────────────────────────────────────────────
// 这些枚举同时被 pgEnum、Zod 与前端矩阵复用，三端必须一致。

/**
 * 投递渠道全集。新增渠道需同时提供 `NotificationChannelAdapter` 实现，
 * 否则解析阶段会以 `channel_unavailable` 抑制并留痕（不会静默丢失）。
 */
export const NOTIFICATION_CHANNELS = ['inapp', 'email', 'sms', 'webhook', 'chat'] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inapp: '站内信',
  email: '邮件',
  sms: '短信',
  webhook: 'Webhook',
  chat: '聊天卡片',
};

export const NOTIFICATION_CHANNEL_OPTIONS: Array<{ value: NotificationChannel; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_CHANNEL_LABELS);

/** 收件主体类型：管理端用户与前台会员是两套独立身份，偏好不共享；external 用于不绑定账号的裸邮箱 / Webhook 地址。 */
export const NOTIFICATION_RECIPIENT_TYPES = ['user', 'member', 'external'] as const;

export type NotificationRecipientType = (typeof NOTIFICATION_RECIPIENT_TYPES)[number];

export const NOTIFICATION_RECIPIENT_TYPE_LABELS: Record<NotificationRecipientType, string> = {
  user: '系统用户',
  member: '会员',
  external: '外部地址',
};

/** 事件重要级别；`critical` 默认穿透免打扰。 */
export const NOTIFICATION_SEVERITIES = ['normal', 'important', 'critical'] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const NOTIFICATION_SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  normal: '普通',
  important: '重要',
  critical: '紧急',
};

export const NOTIFICATION_SEVERITY_OPTIONS: Array<{ value: NotificationSeverity; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_SEVERITY_LABELS);

/** 事件分组，用于偏好矩阵按业务域折叠展示。 */
export const NOTIFICATION_EVENT_GROUPS = [
  'security',
  'identity',
  'workflow',
  'wiki',
  'report',
  'ops',
  'open-platform',
  'member',
  'analytics',
  'messaging',
] as const;

export type NotificationEventGroup = (typeof NOTIFICATION_EVENT_GROUPS)[number];

export const NOTIFICATION_EVENT_GROUP_LABELS: Record<NotificationEventGroup, string> = {
  security: '账号与安全',
  identity: '组织与租户',
  workflow: '工作流',
  wiki: '知识中心',
  report: '报表中心',
  ops: '运维与告警',
  'open-platform': '开放平台',
  member: '会员',
  analytics: '数据分析',
  messaging: '通知中心',
};

export const NOTIFICATION_EVENT_GROUP_OPTIONS: Array<{ value: NotificationEventGroup; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_EVENT_GROUP_LABELS);

/** 摘要模式：非 realtime 时同一收件人的通知会被聚合成一条定时发出。 */
export const NOTIFICATION_DIGEST_MODES = ['realtime', 'hourly', 'daily'] as const;

export type NotificationDigestMode = (typeof NOTIFICATION_DIGEST_MODES)[number];

export const NOTIFICATION_DIGEST_MODE_LABELS: Record<NotificationDigestMode, string> = {
  realtime: '实时',
  hourly: '每小时汇总',
  daily: '每日汇总',
};

export const NOTIFICATION_DIGEST_MODE_OPTIONS: Array<{ value: NotificationDigestMode; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_DIGEST_MODE_LABELS);

/** Outbox 行状态，语义对齐 payment_events。 */
export const NOTIFICATION_OUTBOX_STATUSES = ['pending', 'done', 'failed'] as const;

export type NotificationOutboxStatus = (typeof NOTIFICATION_OUTBOX_STATUSES)[number];

export const NOTIFICATION_OUTBOX_STATUS_LABELS: Record<NotificationOutboxStatus, string> = {
  pending: '待派发',
  done: '已派发',
  failed: '派发失败',
};

export const NOTIFICATION_OUTBOX_STATUS_OPTIONS: Array<{ value: NotificationOutboxStatus; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_OUTBOX_STATUS_LABELS);

/**
 * 单条「收件人 × 渠道」的派发结论。
 * 结论回答「发没发出去」，具体原因见 `reasonCode`——两者分开才能既做统计又做归因。
 */
export const NOTIFICATION_DECISIONS = ['sent', 'suppressed', 'deferred', 'deduped', 'failed'] as const;

export type NotificationDecision = (typeof NOTIFICATION_DECISIONS)[number];

export const NOTIFICATION_DECISION_LABELS: Record<NotificationDecision, string> = {
  sent: '已发送',
  suppressed: '按偏好抑制',
  deferred: '延后发送',
  deduped: '重复已忽略',
  failed: '发送失败',
};

export const NOTIFICATION_DECISION_OPTIONS: Array<{ value: NotificationDecision; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_DECISION_LABELS);

/**
 * 归因码：回答「为什么没收到」。
 * 存 varchar 而非 pgEnum——归因维度会随渠道演进增加，不值得为每次新增做一次迁移。
 */
export const NOTIFICATION_REASON_CODES = [
  'preference_off',
  'globally_muted',
  'channel_unavailable',
  'unreachable',
  'rate_limited',
  'quiet_hours',
  'digest',
  'delivery_error',
] as const;

export type NotificationReasonCode = (typeof NOTIFICATION_REASON_CODES)[number];

export const NOTIFICATION_REASON_CODE_LABELS: Record<NotificationReasonCode, string> = {
  preference_off: '收件人已关闭该事件的此渠道',
  globally_muted: '收件人已开启全局免打扰',
  channel_unavailable: '该渠道未启用或未注册适配器',
  unreachable: '收件人缺少该渠道的可达地址',
  rate_limited: '触发频率限制',
  quiet_hours: '处于免打扰时段，已延后',
  digest: '按摘要模式聚合，已延后',
  delivery_error: '渠道投递失败',
};

export const NOTIFICATION_REASON_CODE_OPTIONS: Array<{ value: NotificationReasonCode; label: string }> =
  createLabelOptionsFromMap(NOTIFICATION_REASON_CODE_LABELS);
