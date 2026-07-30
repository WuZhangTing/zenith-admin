import type { EntityStatus } from '../core/types';

// ─── 公众号管理 ────────────────────────────────────────────────────────────────
export type MpAccountType = 'subscribe' | 'service' | 'test';

export type MpEncryptMode = 'plaintext' | 'compatible' | 'safe';

export interface MpAccount {
  id: number;
  name: string;
  account: string | null;
  appId: string;
  /** 列表/详情返回时脱敏 */
  appSecret?: string;
  token: string;
  encodingAesKey: string | null;
  encryptMode: MpEncryptMode;
  type: MpAccountType;
  qrCodeUrl: string | null;
  isDefault: boolean;
  autoCreateMember: boolean;
  contentCheckEnabled: boolean;
  status: EntityStatus;
  remark: string | null;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MpFanSubscribe = 'subscribed' | 'unsubscribed';

export interface MpTag {
  id: number;
  accountId: number;
  wechatTagId: number | null;
  name: string;
  fansCount: number;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MpFan {
  id: number;
  accountId: number;
  openid: string;
  nickname: string | null;
  avatar: string | null;
  /** 0 未知 / 1 男 / 2 女 */
  sex: number;
  country: string | null;
  province: string | null;
  city: string | null;
  language: string | null;
  subscribe: MpFanSubscribe;
  subscribeTime: string | null;
  remark: string | null;
  tagIds: number[];
  unionid: string | null;
  memberId: number | null;
  blacklisted: boolean;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MpMessageDirection = 'in' | 'out';

export type MpMessageType = 'text' | 'image' | 'voice' | 'video' | 'shortvideo' | 'location' | 'link' | 'event';

export type MpMessageStatus = 'received' | 'sent' | 'failed';

export interface MpMessage {
  id: number;
  accountId: number;
  openid: string;
  direction: MpMessageDirection;
  msgType: MpMessageType;
  content: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  event: string | null;
  msgId: string | null;
  status: MpMessageStatus;
  errorMsg: string | null;
  createdAt: string;
}

/** 会话（按 openid 聚合，含最后一条消息摘要） */
export interface MpConversation {
  openid: string;
  nickname: string | null;
  avatar: string | null;
  lastContent: string | null;
  lastMsgType: MpMessageType;
  lastDirection: MpMessageDirection;
  lastTime: string;
  messageCount: number;
}

export type MpAutoReplyType = 'subscribe' | 'keyword' | 'default';

export type MpAutoReplyMatch = 'exact' | 'contain' | 'regex';

export type MpReplyContentType = 'text' | 'image' | 'voice' | 'video' | 'news';

export interface MpReplyArticle {
  title: string;
  description?: string;
  picUrl?: string;
  url: string;
}

export interface MpAutoReply {
  id: number;
  accountId: number;
  replyType: MpAutoReplyType;
  keyword: string | null;
  matchType: MpAutoReplyMatch;
  contentType: MpReplyContentType;
  content: string | null;
  mediaId: string | null;
  newsArticles: MpReplyArticle[] | null;
  transferToKf: boolean;
  status: EntityStatus;
  sort: number;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MpUnmatchedKeyword {
  id: number;
  accountId: number;
  keyword: string;
  count: number;
  lastAt: string;
}

export type MpMenuStatus = 'draft' | 'published';

/** 微信自定义菜单按钮（可嵌套二级 sub_button） */
export interface MpMenuButton {
  name: string;
  type?: string;
  key?: string;
  url?: string;
  appid?: string;
  pagepath?: string;
  media_id?: string;
  article_id?: string;
  sub_button?: MpMenuButton[];
}

export interface MpMenu {
  id: number;
  accountId: number;
  buttons: MpMenuButton[];
  status: MpMenuStatus;
  publishedAt: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 个性化菜单匹配规则（字段值均为字符串，对齐微信 matchrule） */
export interface MpMenuMatchRule {
  tagId?: string;
  sex?: string;
  country?: string;
  province?: string;
  city?: string;
  clientPlatformType?: string;
  language?: string;
}

export interface MpConditionalMenu {
  id: number;
  accountId: number;
  name: string;
  buttons: MpMenuButton[];
  matchRule: MpMenuMatchRule;
  menuId: string | null;
  status: MpMenuStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MpMaterialType = 'image' | 'voice' | 'video' | 'thumb';

export interface MpMaterial {
  id: number;
  accountId: number;
  type: MpMaterialType;
  name: string;
  wechatMediaId: string | null;
  url: string | null;
  fileSize: number | null;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 图文消息单篇文章 */
export interface MpArticle {
  title: string;
  author?: string;
  digest?: string;
  content: string;
  thumbUrl?: string;
  thumbMediaId?: string;
  contentSourceUrl?: string;
  showCoverPic?: boolean;
}

export type MpDraftStatus = 'draft' | 'published';

export interface MpDraft {
  id: number;
  accountId: number;
  title: string;
  articles: MpArticle[];
  wechatMediaId: string | null;
  status: MpDraftStatus;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MpMessageTemplate {
  id: number;
  accountId: number;
  templateId: string;
  title: string;
  content: string | null;
  example: string | null;
  tenantId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MpTemplateSendStatus = 'success' | 'failed';

export interface MpTemplateSendLog {
  id: number;
  accountId: number;
  templateId: string;
  openid: string;
  data: Record<string, unknown> | null;
  url: string | null;
  status: MpTemplateSendStatus;
  errorMsg: string | null;
  msgId: string | null;
  createdAt: string;
}

/** 公众号数据统计（本地聚合） */
export interface MpStats {
  fanTotal: number;
  fanSubscribed: number;
  fanUnsubscribed: number;
  tagTotal: number;
  materialTotal: number;
  draftTotal: number;
  messageIn: number;
  messageOut: number;
  autoReplyTotal: number;
  fanTrend: { date: string; count: number }[];
  messageTrend: { date: string; in: number; out: number }[];
}

export interface MpDatacube {
  beginDate: string;
  endDate: string;
  userSummary: { refDate: string; newUser: number; cancelUser: number }[];
  userCumulate: { refDate: string; cumulateUser: number }[];
  upstreamMsg: { refDate: string; msgUser: number; msgCount: number }[];
  articleSummary: { refDate: string; pageReadCount: number }[];
  userShare: { refDate: string; shareCount: number; shareUser: number }[];
  interfaceSummary: { refDate: string; callbackCount: number; failCount: number; totalTimeCost: number; maxTimeCost: number }[];
}

// ─── 公众号群发消息 ──────────────────────────────────────────────────────────
export type MpBroadcastType = 'text' | 'image' | 'mpnews';

export type MpBroadcastTarget = 'all' | 'tag';

export type MpBroadcastStatus = 'draft' | 'sent' | 'failed';

export interface MpBroadcast {
  id: number;
  accountId: number;
  msgType: MpBroadcastType;
  target: MpBroadcastTarget;
  tagId: number | null;
  content: string | null;
  mediaId: string | null;
  status: MpBroadcastStatus;
  wechatMsgId: string | null;
  scheduledAt: string | null;
  errorMsg: string | null;
  sentAt: string | null;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MpBroadcastResult {
  msgStatus: string;
  totalCount?: number;
  filterCount?: number;
  sentCount?: number;
  errorCount?: number;
}

export interface MpTemplateIndustry {
  primaryIndustry: { firstClass: string; secondClass: string } | null;
  secondaryIndustry: { firstClass: string; secondClass: string } | null;
}

export interface MpJsConfig {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

// ─── 公众号带参数二维码 ───────────────────────────────────────────────────────
export type MpQrcodeType = 'temporary' | 'permanent';

export interface MpQrcode {
  id: number;
  accountId: number;
  type: MpQrcodeType;
  sceneStr: string;
  name: string;
  ticket: string | null;
  url: string | null;
  expireSeconds: number | null;
  scanCount: number;
  rewardPoints: number;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 公众号多客服账号 ─────────────────────────────────────────────────────────
export interface MpKfAccount {
  id: number;
  accountId: number;
  kfAccount: string;
  nickname: string;
  avatar: string | null;
  kfId: string | null;
  inviteStatus: string;
  inviteWx: string | null;
  status: EntityStatus;
  tenantId?: number | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 多客服会话治理（实时状态机）──────────────────────────────────────────────
export type MpKfSessionStatus = 'waiting' | 'active' | 'closed';

export type MpKfSessionCloseReason = 'manual' | 'wait_timeout' | 'idle_timeout' | 'system';

export type MpKfRoutingStrategy = 'manual' | 'round_robin' | 'least_active';

export type MpKfSessionEventType = 'create' | 'assign' | 'accept' | 'transfer' | 'reroute' | 'close';

export interface MpKfSession {
  id: number;
  accountId: number;
  openid: string;
  kfId: number | null;
  /** 承接客服昵称（联表） */
  kfNickname: string | null;
  /** 粉丝昵称（联表） */
  fanNickname: string | null;
  fanAvatar: string | null;
  status: MpKfSessionStatus;
  priority: number;
  source: string | null;
  unreadCount: number;
  lastFanMsgAt: string | null;
  lastKfMsgAt: string | null;
  lastMsgAt: string | null;
  waitingSince: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  closeReason: MpKfSessionCloseReason | null;
  rating: number | null;
  ratingRemark: string | null;
  remark: string | null;
  /** 已等待秒数（waiting 时由后端计算） */
  waitSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MpKfSessionEvent {
  id: number;
  sessionId: number;
  accountId: number;
  type: MpKfSessionEventType;
  fromKfId: number | null;
  toKfId: number | null;
  fromKfNickname: string | null;
  toKfNickname: string | null;
  operatorId: number | null;
  operatorName: string | null;
  detail: string | null;
  createdAt: string;
}

export interface MpKfSessionDetail extends MpKfSession {
  events: MpKfSessionEvent[];
  messages: MpMessage[];
}

export interface MpKfRoutingConfig {
  id: number;
  accountId: number;
  enabled: boolean;
  strategy: MpKfRoutingStrategy;
  maxConcurrent: number;
  waitTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  autoCloseEnabled: boolean;
  welcomeText: string | null;
  updatedAt: string;
}

export interface MpKfAgentLoad {
  kfId: number;
  kfAccount: string;
  nickname: string;
  status: EntityStatus;
  activeCount: number;
}

export interface MpKfSessionStats {
  waiting: number;
  active: number;
  closedToday: number;
  /** 今日已结束会话平均等待接入秒数 */
  avgWaitSeconds: number;
  /** 今日已结束会话平均满意度评分（1-5） */
  avgRating: number;
  agents: MpKfAgentLoad[];
}

export interface MpKfSessionReportItem {
  date: string;
  created: number;
  closed: number;
  avgWaitSeconds: number;
  avgRating: number;
}
