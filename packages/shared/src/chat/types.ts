export interface ExportColumnMeta {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'datetime' | 'date' | 'enum' | 'money' | 'boolean';
  sensitive?: boolean;
  children?: ExportColumnMeta[];
}

export type SystemSchedulerAlertChannel = 'inapp' | 'email' | 'webhook';

// ─── WebRTC 音视频通话 ───────────────────────────────────────────────────────
export type RtcCallType = 'audio' | 'video';

export type RtcCallMode = 'p2p' | 'group';

/** 通话参与者基本信息 */
export interface RtcPeerInfo {
  userId: number;
  nickname: string;
  avatar: string | null;
}

/** 与 RTCIceCandidateInit 对齐的可序列化 ICE candidate（避免 DOM 类型依赖） */
export interface RtcIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface RtcInvitePayload {
  callId: string;
  conversationId: number;
  callType: RtcCallType;
  mode: RtcCallMode;
  from: RtcPeerInfo;
  /** 单聊定向邀请的目标用户；群聊为空（广播给会话成员） */
  to?: number;
  /** 会话展示名（来电界面用） */
  conversationName?: string | null;
}

/** ICE 服务器配置（前端 RTCPeerConnection 用） */
export interface RtcIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RtcConfig {
  iceServers: RtcIceServerConfig[];
}

// ─── 聊天 ─────────────────────────────────────────────────────────────────────
export type ChatConversationType = 'direct' | 'group';

export type ChatMessageType = 'text' | 'image' | 'file' | 'system' | 'forward' | 'vote' | 'voice' | 'card' | 'video';

export interface ChatVoteOption {
  id: string;
  label: string;
}

export interface ChatVoteRecord {
  userId: number;
  optionIds: string[];
  nickname: string;
}

export interface ChatVoteData {
  question: string;
  options: ChatVoteOption[];
  isMultiple: boolean;
  isAnonymous: boolean;
  expireAt: string | null;
  votes: ChatVoteRecord[];
  isClosed: boolean;
}

export type ChatMemberRole = 'owner' | 'admin' | 'member';

export interface ChatLinkPreview {
  url: string;
  title: string;
  description: string | null;
  siteName: string | null;
  image: string | null;
  favicon: string | null;
}

export interface ChatAssetMeta {
  kind: 'image' | 'file' | 'voice' | 'video';
  name: string;
  size: number;
  mimeType: string | null;
  extension: string | null;
  /** 托管文件 ID，用于服务端预览接口认证（可选，虚拟消息不填） */
  fileId?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnailUrl?: string | null;
  /** 语音消息时长（秒），仅 kind='voice' 有效 */
  duration?: number | null;
}

export interface ChatMention {
  userId: number;
  nickname: string;
}

export interface ChatAnnouncementHistoryMeta {
  announcement: string | null;
  operatorName: string | null;
}

export interface ChatForwardedItem {
  senderName: string | null;
  type: ChatMessageType;
  content: string;
  createdAt: string;
  asset?: ChatAssetMeta | null;
}

export interface ChatReactionGroup {
  emoji: string;
  count: number;
  userIds: number[];
}

/** 卡片消息字段（键值对展示） */
export interface ChatCardField {
  label: string;
  value: string;
}

/** 卡片消息动作按钮 */
export interface ChatCardAction {
  /** 动作唯一标识 */
  key: string;
  label: string;
  /** 按钮样式 */
  theme?: 'primary' | 'secondary' | 'danger' | 'tertiary';
  /** 动作类型：调用工作流审批接口 / 打开链接 / 仅展示 */
  action: 'workflow:approve' | 'workflow:reject' | 'link' | 'none';
  /** workflow:* 动作关联的任务 ID */
  taskId?: number | null;
  /** link 动作的跳转地址（站内 path 或外链） */
  url?: string | null;
  /** 是否要求填写评论（如驳回） */
  requireComment?: boolean;
}

/** 卡片消息内容（工作流审批 / 系统告警 / Webhook 推送） */
export interface ChatCard {
  title: string;
  text?: string | null;
  /** 图文消息封面图 URL（频道图文群发使用，工作流卡片不设） */
  cover?: string | null;
  fields?: ChatCardField[] | null;
  actions?: ChatCardAction[] | null;
  /** 来源标识（如「工作流」「系统告警」「监控」） */
  source?: string | null;
  /** 卡片状态：pending 可操作，done 已处理（按钮置灰） */
  status?: 'pending' | 'done' | null;
  /** 已处理后的结果文案 */
  statusText?: string | null;
  /** 关联的工作流实例 ID（工作流卡片点击可打开流程详情抽屉） */
  instanceId?: number | null;
}

/** 机器人/系统发送者身份（senderId 为 null 的消息携带） */
export interface ChatBotMeta {
  name: string;
  avatar?: string | null;
}

export interface ChatMessageExtra {
  asset?: ChatAssetMeta | null;
  linkPreview?: ChatLinkPreview | null;
  mentions?: ChatMention[] | null;
  isFavorited?: boolean;
  isPinned?: boolean;
  announcementHistory?: ChatAnnouncementHistoryMeta | null;
  forwardedMessages?: ChatForwardedItem[] | null;
  forwardSourceConvName?: string | null;
  hiddenFor?: number[] | null;
  voteData?: ChatVoteData | null;
  card?: ChatCard | null;
  bot?: ChatBotMeta | null;
}

export interface ChatReplySnapshot {
  id: number;
  senderId: number | null;
  senderName: string | null;
  type: ChatMessageType;
  content: string;
  isRecalled: boolean;
  extra: ChatMessageExtra | null;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string | null;
  senderAvatar: string | null;
  type: ChatMessageType;
  content: string;
  replyToId: number | null;
  replyToMessage: ChatReplySnapshot | null;
  isRecalled: boolean;
  isEdited: boolean;
  extra: ChatMessageExtra | null;
  reactions: ChatReactionGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageSearchItem {
  message: ChatMessage;
  snippet: string;
}

export interface ChatMessageSearchResult {
  list: ChatMessageSearchItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChatMessageContext {
  list: ChatMessage[];
  anchorMessageId: number;
  hasBefore: boolean;
  hasAfter: boolean;
}

export interface ChatGroupMember {
  id: number;
  nickname: string;
  username: string;
  avatar?: string | null;
  role: ChatMemberRole;
  /** 被禁言至（null = 未禁言；9999 年 = 永久） */
  mutedUntil?: string | null;
}

export interface ChatConversation {
  id: number;
  type: ChatConversationType;
  name: string | null;
  announcement?: string | null;
  targetUser?: {
    id: number;
    nickname: string;
    avatar: string | null;
    phone?: string | null;
    email?: string | null;
    departmentName?: string | null;
    positionNames?: string[];
  } | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** 是否存在未读的 @我 消息 */
  hasMentionUnread: boolean;
  isPinned: boolean;
  isStarred: boolean;
  isMuted: boolean;
  /** 会话归档（收进「已归档」折叠分组） */
  isArchived?: boolean;
  /** 全员禁言开关（群聊） */
  muteAll?: boolean;
  /** 入群审批开关（群聊，开启后邀请入群需审批） */
  joinApproval?: boolean;
  /** 我在该会话中的角色 */
  myRole?: ChatMemberRole;
  /** 我被禁言至（null = 未禁言） */
  myMutedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 会话成员的已读状态（用于已读回执） */
export interface ChatReadState {
  userId: number;
  nickname: string;
  avatar: string | null;
  /** 最后已读时间，null 表示从未读过 */
  lastReadAt: string | null;
}

/** 用户在线状态（用于在线状态指示） */
export interface ChatPresence {
  userId: number;
  online: boolean;
  /** 最近在线时间，online=true 时为 null */
  lastSeen: string | null;
}

/** 组织架构选人：部门节点 */
export interface ChatOrgDepartment {
  id: number;
  name: string;
  parentId: number;
}

/** 组织架构选人：用户节点 */
export interface ChatOrgUser {
  id: number;
  nickname: string;
  username: string;
  avatar: string | null;
  departmentId: number | null;
}

/** 组织架构选人数据（部门 + 用户扁平列表，前端组树） */
export interface ChatOrgData {
  departments: ChatOrgDepartment[];
  users: ChatOrgUser[];
}

/** 个人快捷回复（常用语） */
export interface ChatQuickReply {
  id: number;
  content: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export type ChatScheduledStatus = 'pending' | 'sent' | 'canceled' | 'failed';

/** 定时消息 */
export interface ChatScheduledMessage {
  id: number;
  conversationId: number;
  /** 目标会话展示名（群名或对方昵称） */
  conversationName: string | null;
  type: ChatMessageType;
  content: string;
  extra: ChatMessageExtra | null;
  scheduledAt: string;
  status: ChatScheduledStatus;
  failReason: string | null;
  sentMessageId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 自定义表情（个人收藏贴图） */
export interface ChatCustomEmoji {
  id: number;
  url: string;
  fileId: string | null;
  name: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/** 群邀请链接 */
export interface ChatGroupInvite {
  id: number;
  conversationId: number;
  token: string;
  /** 过期时间（null = 永久有效） */
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  enabled: boolean;
  createdAt: string;
}

/** 邀请链接落地信息（加入前展示） */
export interface ChatInviteInfo {
  conversationId: number;
  groupName: string | null;
  memberCount: number;
  /** 是否需要群主/管理员审批 */
  joinApproval: boolean;
  /** 当前用户是否已在群内 */
  alreadyMember: boolean;
}

export type ChatJoinRequestStatus = 'pending' | 'approved' | 'rejected';

/** 入群申请 */
export interface ChatGroupJoinRequest {
  id: number;
  conversationId: number;
  userId: number;
  nickname: string;
  avatar: string | null;
  message: string | null;
  status: ChatJoinRequestStatus;
  createdAt: string;
}

/** 聊天入站 Webhook 机器人 */
export interface ChatWebhook {
  id: number;
  name: string;
  avatar: string | null;
  description: string | null;
  conversationId: number;
  conversationName: string | null;
  enabled: boolean;
  /** 完整入站推送地址 */
  webhookUrl: string;
  /** 令牌（仅创建/重置时返回明文，列表中为脱敏） */
  token: string;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
