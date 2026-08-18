import type { ChatMessageExtra } from '../chat/types';
import type { EntityStatus } from '../core/types';
import type {
  NotificationChannel,
  NotificationDecision,
  NotificationDigestMode,
  NotificationEventGroup,
  NotificationReasonCode,
  NotificationRecipientType,
  NotificationSeverity,
} from './constants';

// ─── 公告 ──────────────────────────────────────────────────
export type AnnouncementPublishStatus = 'draft' | 'published' | 'recalled' | 'scheduled';

export type AnnouncementType = 'notice' | 'announcement' | 'warning';

export type AnnouncementPriority = 'low' | 'medium' | 'high';

export type AnnouncementTargetType = 'all' | 'specific';

export type AnnouncementRecipientType = 'user' | 'role' | 'dept';

export interface AnnouncementRecipient {
  recipientType: AnnouncementRecipientType;
  recipientId: number;
  recipientLabel?: string;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  type: string;
  publishStatus: string;
  priority: string;
  targetType: AnnouncementTargetType;
  publishTime: string | null;
  createById: number | null;
  createByName: string | null;
  createdAt: string;
  updatedAt: string;
  recipients?: AnnouncementRecipient[];
  attachments?: AnnouncementAttachment[];
  /** 已读人数（管理列表额外返回） */
  readCount?: number;
}

export interface AnnouncementReadStatsUser {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  /** 已读时间，仅 tab=read 时有值 */
  readAt?: string;
}

export interface AnnouncementReadStats {
  readCount: number;
  totalCount: number;
  list: AnnouncementReadStatsUser[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── 公告附件 ──────────────────────────────────────────────

export interface AnnouncementAttachment {
  id: number;
  fileId: string;
  file: {
    id: string;
    originalName: string;
    size: number;
    mimeType: string | null;
    extension: string | null;
    url: string;
    directUrl?: string | null;
  };
  sortOrder: number;
  createdAt: string;
}

// ─── 邮件配置 ──────────────────────────────────────────────────────────────
export type EmailEncryption = 'none' | 'ssl' | 'tls';

export interface EmailConfig {
  id: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword?: string;
  fromName: string;
  fromEmail: string;
  encryption: EmailEncryption;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Channel（站内公众号 / 系统号）────────────────────────────────────────────
export type ChannelType = 'system' | 'business';

export type ChannelAudienceType = 'broadcast' | 'targeted';

export type ChannelMessageType = 'text' | 'card' | 'image' | 'news';

/** 消息状态：sent=已发；draft=草稿；scheduled=定时待发 */
export type ChannelMessageStatus = 'sent' | 'draft' | 'scheduled';

/** 群发受众范围：all=全员；users=指定用户；departments=按部门；roles=按角色 */
export type ChannelPublishAudienceMode = 'all' | 'users' | 'departments' | 'roles';

/** 群发发送方式：now=立即；scheduled=定时；draft=存草稿 */
export type ChannelSendMode = 'now' | 'scheduled' | 'draft';

/** 消息方向：out=频道→用户（群发/客服/自动回复）；in=用户→频道（用户主动发送） */
export type ChannelMessageDirection = 'out' | 'in';

/** 公众号底部菜单类型：click=点击触发关键词；view=跳转链接 */
export type ChannelMenuType = 'click' | 'view';

/** 自动回复匹配类型：subscribe=关注欢迎语；keyword=关键词；default=兜底 */
export type ChannelAutoReplyMatchType = 'subscribe' | 'keyword' | 'default';

/** 关键词匹配模式：exact=完全匹配；contains=包含 */
export type ChannelAutoReplyKeywordMode = 'exact' | 'contains';

/** 客服会话状态：open=待处理；processing=处理中；resolved=已解决 */
export type ChannelConversationStatus = 'open' | 'processing' | 'resolved';

/** 频道内一条消息（卡片复用 ChatMessageExtra.card / 身份用 extra.bot） */
export interface ChannelMessage {
  id: number;
  channelId: number;
  audienceType: ChannelAudienceType;
  type: ChannelMessageType;
  title: string | null;
  content: string;
  extra: ChatMessageExtra | null;
  publishedById: number | null;
  /** 消息方向（双向客服） */
  direction: ChannelMessageDirection;
  /** in 消息=发送用户；out 客服回复=客服用户；自动回复/群发为 null */
  senderUserId: number | null;
  /** 发送者展示名（in=用户昵称，out 客服=客服昵称） */
  senderUserName: string | null;
  /** 当前用户视角是否已读 */
  isRead: boolean;
  /** 消息状态（管理端消息记录：sent 已发 / draft 草稿 / scheduled 定时待发） */
  status: ChannelMessageStatus;
  /** 定时发送时间（status=scheduled 时有值） */
  scheduledAt: string | null;
  /** 客服会话视角：该 out 定向消息是否已被目标用户读取（null=非定向/不适用） */
  readByTarget?: boolean | null;
  /** 是否已撤回（F：撤回后内容置空，前端显示占位） */
  isRetracted?: boolean;
  retractedAt?: string | null;
  createdAt: string;
}

/** 公众号底部菜单节点（最多 3 个一级，每个一级下最多 5 个二级） */
export interface ChannelMenu {
  id: number;
  channelId: number;
  parentId: number | null;
  name: string;
  type: ChannelMenuType;
  /** click=关键词文案；view=跳转 URL；含子菜单的一级菜单可为空 */
  value: string | null;
  sort: number;
  children?: ChannelMenu[];
}

/** 富内容自动回复的扩展数据（replyType=image/news 时使用） */
export interface ChannelRichReplyExtra {
  /** 图片消息：图片 URL */
  imageUrl?: string | null;
  /** 图文消息：标题 / 封面 / 摘要 / 跳转链接 */
  title?: string | null;
  cover?: string | null;
  summary?: string | null;
  linkUrl?: string | null;
}

/** 频道自动回复规则 */
export interface ChannelAutoReply {
  id: number;
  channelId: number;
  matchType: ChannelAutoReplyMatchType;
  /** 关键词（matchType=keyword 时必填） */
  keyword: string | null;
  keywordMode: ChannelAutoReplyKeywordMode;
  /** 回复内容类型（text/image/news；H 富内容） */
  replyType: ChannelMessageType;
  replyContent: string;
  /** 富内容扩展（image/news 时） */
  replyExtra: ChannelRichReplyExtra | null;
  /** 命中次数（H 统计） */
  hitCount: number;
  status: EntityStatus;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 客服快捷回复（channelId 为 null 表示全局，所有运营号通用） */
export interface ChannelQuickReply {
  id: number;
  channelId: number | null;
  channelName: string | null;
  title: string;
  content: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

/** 客服工作台中的一条会话（按用户聚合） */
export interface ChannelConversation {
  channelId: number;
  userId: number;
  userName: string;
  userAvatar: string | null;
  /** 最近一条消息内容预览 */
  lastMessage: string;
  /** 最近一条消息方向 */
  lastDirection: ChannelMessageDirection;
  lastMessageAt: string;
  /** 待客服回复的用户消息数（最近一条客服回复之后的用户消息） */
  unreadCount: number;
  /** 会话内消息总数 */
  messageCount: number;
  /** 会话状态（待处理 / 处理中 / 已解决） */
  status: ChannelConversationStatus;
  /** 指派的客服 userId（null=未指派，开放协作） */
  assigneeId: number | null;
  /** 指派客服展示名 */
  assigneeName: string | null;
  /** 会话标签 */
  tags: string[];
  /** 解决时间 */
  resolvedAt: string | null;
  /** 用户评价（1-5 星，null=未评价） */
  rating: number | null;
  ratingComment: string | null;
  ratedAt: string | null;
}

/** 频道订阅者（订阅者管理） */
export interface ChannelSubscriber {
  userId: number;
  name: string;
  avatar: string | null;
  /** 订阅时间（系统号全员为 null） */
  subscribedAt: string | null;
  isMuted: boolean;
}

/** 群发消息模板 */
export interface ChannelMessageTemplate {
  id: number;
  name: string;
  type: ChannelMessageType;
  title: string | null;
  content: string;
  extra: ChatMessageExtra | null;
  createdAt: string;
  updatedAt: string;
}

/** 客服绩效（按客服聚合） */
export interface ChannelCsPerformance {
  agentId: number;
  agentName: string;
  /** 回复消息数 */
  replyCount: number;
  /** 标记解决会话数 */
  resolvedCount: number;
  /** 平均首次响应时长（分钟，null=无数据） */
  avgResponseMinutes: number | null;
  /** 平均评分（1-5，null=无评分） */
  avgRating: number | null;
}

/** 可指派的客服（拥有 channel:cs 权限的用户） */
export interface ChannelCsAgent {
  id: number;
  name: string;
  avatar: string | null;
}

/** 频道数据看板（I） */
export interface ChannelDashboardOverview {
  /** 运营号数量 */
  businessChannelCount: number;
  /** 订阅总数（运营号订阅关系） */
  subscriptionCount: number;
  /** 消息总数（已发送 out） */
  messageCount: number;
  /** 今日推送数 */
  todayPushCount: number;
  /** 待处理会话数 */
  openConversationCount: number;
  /** 平均首次响应时长（分钟，用户首条 in → 首条人工 out） */
  avgResponseMinutes: number | null;
}

/** 近 N 天消息量趋势点 */
export interface ChannelDashboardTrendPoint {
  date: string;
  /** 用户来信数 */
  inbound: number;
  /** 频道发出数（群发+客服回复） */
  outbound: number;
}

/** 会话状态分布 */
export interface ChannelDashboardStatusDist {
  open: number;
  processing: number;
  resolved: number;
}

/** 热门自动回复（按命中次数） */
export interface ChannelDashboardTopReply {
  id: number;
  channelName: string;
  keyword: string | null;
  matchType: ChannelAutoReplyMatchType;
  hitCount: number;
}

/** 运营号消息排行 */
export interface ChannelDashboardChannelRank {
  channelId: number;
  channelName: string;
  messageCount: number;
  subscriberCount: number;
}

/** 频道数据看板聚合结果 */
export interface ChannelDashboard {
  overview: ChannelDashboardOverview;
  trend: ChannelDashboardTrendPoint[];
  statusDist: ChannelDashboardStatusDist;
  /** 群发定向消息已读率（0-100） */
  readRate: number;
  topReplies: ChannelDashboardTopReply[];
  channelRank: ChannelDashboardChannelRank[];
}

/** 公众号 / 系统号（在聊天会话列表中以只读频道形式呈现） */
export interface Channel {
  id: number;
  code: string;
  name: string;
  avatar: string | null;
  description: string | null;
  type: ChannelType;
  builtin: boolean;
  status: EntityStatus;
  /** 当前用户未读数 */
  unreadCount: number;
  lastMessage: ChannelMessage | null;
  isMuted: boolean;
  isSubscribed: boolean;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 频道管理后台视图（含订阅数 / 消息数） */
export interface ChannelAdmin {
  id: number;
  code: string;
  name: string;
  avatar: string | null;
  description: string | null;
  type: ChannelType;
  builtin: boolean;
  status: EntityStatus;
  subscriberCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 通知模块（邮件 / 短信 / 站内信）─────────────────────────────────────────
export type SendStatus = 'pending' | 'success' | 'failed';

export type SendSource = 'manual' | 'test' | 'system' | 'api';

export type SmsProvider = 'aliyun' | 'tencent';

export type InAppMessageType = 'info' | 'success' | 'warning' | 'error';

// 邮件模板
export interface EmailTemplate {
  id: number;
  name: string;
  code: string;
  subject: string;
  content: string;
  variables: string | null;
  status: EntityStatus;
  remark: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// 邮件发送记录
export interface EmailSendLog {
  id: number;
  templateId: number | null;
  templateName?: string | null;
  toEmail: string;
  subject: string;
  content: string;
  status: SendStatus;
  errorMsg: string | null;
  source: SendSource;
  userId: number | null;
  userName?: string | null;
  ip: string | null;
  tenantId?: number | null;
  sentAt: string | null;
  createdAt: string;
}

// 短信服务商配置
export interface SmsConfig {
  id: number;
  name: string;
  provider: SmsProvider;
  accessKeyId: string;
  accessKeySecret?: string; // 列表/详情返回时可能脱敏
  region: string | null;
  signName: string;
  isDefault: boolean;
  status: EntityStatus;
  remark: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// 短信模板
export interface SmsTemplate {
  id: number;
  name: string;
  code: string;
  templateCode: string;
  signName: string | null;
  content: string;
  variables: string | null;
  provider: SmsProvider;
  status: EntityStatus;
  remark: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// 短信发送记录
export interface SmsSendLog {
  id: number;
  configId: number | null;
  templateId: number | null;
  templateName?: string | null;
  provider: SmsProvider;
  phone: string;
  content: string;
  status: SendStatus;
  errorMsg: string | null;
  bizId: string | null;
  deliveryStatus: string | null;
  deliveredAt: string | null;
  source: SendSource;
  userId: number | null;
  userName?: string | null;
  ip: string | null;
  tenantId?: number | null;
  sentAt: string | null;
  createdAt: string;
}

// 站内信模板
export interface InAppTemplate {
  id: number;
  name: string;
  code: string;
  title: string;
  content: string;
  type: InAppMessageType;
  variables: string | null;
  status: EntityStatus;
  remark: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

// 站内信收件记录
export interface InAppMessage {
  id: number;
  templateId: number | null;
  userId: number;
  userName?: string | null;
  title: string;
  content: string;
  type: InAppMessageType;
  isRead: boolean;
  readAt: string | null;
  source: SendSource;
  senderId: number | null;
  senderName?: string | null;
  /** 深链地址（站内路由，点击消息跳转） */
  link?: string | null;
  tenantId?: number | null;
  createdAt: string;
}

// ─── 通知中心（Notification Center）─────────────────────────────────────────

/**
 * 收件人。
 * `user` / `member` 参与偏好解析；`external` 是不绑定账号的裸地址
 * （告警规则里的外部邮箱、Webhook URL），没有身份也就没有偏好，直接投递。
 */
export type NotificationRecipient =
  | { type: 'user'; id: number }
  | { type: 'member'; id: number }
  | { type: 'external'; channel: NotificationChannel; address: string };

/** 渠道级投递参数，用于渠道本身需要额外配置的场景（短信模板、Webhook 地址）。 */
export interface NotificationChannelOptions {
  sms?: {
    templateId: number;
    /**
     * 显式短信模板变量。短信服务商按**位置**映射参数（腾讯云 `Object.values`），
     * 而事件 vars 经 jsonb 往返后键序会被重排；不传时适配器按模板占位符出现顺序
     * 从事件 vars 中挑选，传了则以此为准。
     */
    variables?: Record<string, string>;
  };
  webhook?: { url: string; body?: Record<string, unknown> };
  email?: { html?: string; subject?: string };
  inapp?: { type?: InAppMessageType };
}

/**
 * 管理员配置层：本次派发允许 / 禁止的渠道。
 * 典型来源是流程定义的 notifyChannels 开关或告警规则的 channels 字段——
 * 它决定「渠道是否被开放」，用户偏好在其之后决定「是否真的要收」。
 */
export interface NotificationChannelPolicy {
  /** 白名单：给出时本次只考虑这些渠道 */
  only?: readonly NotificationChannel[];
  /** 在默认渠道之外额外开启 */
  enable?: readonly NotificationChannel[];
  /** 强制关闭（优先级高于 enable） */
  disable?: readonly NotificationChannel[];
}

/** 单条偏好覆盖记录。 */
export interface NotificationPreference {
  id: number;
  recipientType: NotificationRecipientType;
  recipientId: number;
  eventKey: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 收件人的全局通知设置。 */
export interface NotificationRecipientSettings {
  recipientType: NotificationRecipientType;
  recipientId: number;
  globalMuted: boolean;
  timezone: string;
  /** 免打扰起始，HH:mm；与 quietEnd 同时为空表示未启用 */
  quietStart: string | null;
  quietEnd: string | null;
  digestMode: NotificationDigestMode;
  /** daily 摘要的发送小时（0-23） */
  digestHour: number;
  updatedAt: string;
}

/** 派发决策与结果记录。 */
export interface NotificationDispatchRecord {
  id: number;
  outboxId: number | null;
  eventKey: string;
  recipientType: NotificationRecipientType;
  recipientId: number | null;
  recipientAddress: string | null;
  channel: NotificationChannel;
  decision: NotificationDecision;
  reasonCode: NotificationReasonCode | null;
  reasonDetail: string | null;
  tenantId: number | null;
  createdAt: string;
}

// ─── 偏好矩阵与策略中心视图模型 ───────────────────────────────────────────────

/** 偏好矩阵中一个「事件 × 渠道」格子的可视状态。 */
export interface NotificationMatrixChannel {
  channel: NotificationChannel;
  /** 该事件是否开放此渠道（不开放的渠道不渲染开关） */
  available: boolean;
  /** 当前生效值（偏好 → 租户/平台覆盖 → 事件默认 逐层求值后的结果） */
  enabled: boolean;
  /** 管理员已锁定，用户不可修改 */
  locked: boolean;
  /** 无任何覆盖时的默认值，用于「恢复默认」与稀疏存储判断 */
  defaultEnabled: boolean;
}

export interface NotificationMatrixEvent {
  key: string;
  label: string;
  description?: string;
  severity: NotificationSeverity;
  /** 强制事件：整行锁定 */
  mandatory: boolean;
  channels: NotificationMatrixChannel[];
}

export interface NotificationMatrixGroup {
  group: NotificationEventGroup;
  label: string;
  events: NotificationMatrixEvent[];
}

/** 策略中心的事件行：目录信息 + 当前作用域的覆盖。 */
export interface NotificationPolicyChannel {
  channel: NotificationChannel;
  available: boolean;
  defaultEnabled: boolean;
  override: { enabled: boolean; locked: boolean } | null;
}

export interface NotificationPolicyEvent {
  key: string;
  group: NotificationEventGroup;
  groupLabel: string;
  label: string;
  description?: string;
  severity: NotificationSeverity;
  mandatory: boolean;
  bypassQuietHours: boolean;
  channels: NotificationPolicyChannel[];
}
