import type { AnalyticsDeviceType, AnalyticsEnvironment, AnalyticsEventSource } from '../analytics/types';
import type { ChatMessage, ChatReactionGroup, ChatVoteData, RtcIceCandidateInit, RtcInvitePayload, RtcPeerInfo, SystemSchedulerAlertChannel } from '../chat/types';
import type { EntityStatus } from '../core/types';
import type { UserBehaviorEventType } from '../identity/types';
import type { Announcement, ChannelMessage, InAppMessage } from '../messaging/types';
import type { MpKfSession, MpMessageDirection, MpMessageType } from '../mp/types';
import type { AsyncTask } from '../tasks/types';
import type { WorkflowInstanceStatus } from '../workflow/types';
import type {
  MonitorAlertHandleStatus,
  MonitorAlertNotifyStatus,
  MonitorAlertOverviewRange,
  MonitorMetric,
} from './constants';

// ─── 字典 ─────────────────────────────────────────────────────────────────────
export interface Dict {
  id: number;
  name: string;
  code: string;
  description?: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DictItem {
  id: number;
  dictId: number;
  parentId?: number | null;
  label: string;
  value: string;
  color?: string;
  sort: number;
  status: EntityStatus;
  remark?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  children?: DictItem[];
}

// ─── 文件管理 ─────────────────────────────────────────────────────────────────
export type FileStorageProvider = 'local' | 'oss' | 's3' | 'cos' | 'obs' | 'kodo' | 'bos' | 'azure' | 'sftp';

/** 对象读写权限（canned ACL）；default = 继承 Bucket */
export type FileObjectAcl = 'default' | 'private' | 'public-read' | 'public-read-write';

/** 文件访问 URL 策略；proxy=服务端代理，public=永久公开直链，presigned=临时签名直链 */
export type FileUrlStrategy = 'proxy' | 'public' | 'presigned';

/** access-url 接口返回的文件访问地址（presigned 每次返回新鲜签名，禁止长期缓存） */
export interface FileAccessUrl {
  url: string;
  strategy: FileUrlStrategy;
  /** 签名过期时间（YYYY-MM-DD HH:mm:ss）；public/proxy 为 null */
  expiresAt: string | null;
}

export interface FileStorageConfig {
  id: number;
  name: string;
  provider: FileStorageProvider;
  status: EntityStatus;
  isDefault: boolean;
  basePath?: string;
  /** 对象读写权限（仅 oss/s3/cos/obs/bos 生效）；default = 继承 Bucket */
  objectAcl?: FileObjectAcl;
  /** 文件访问 URL 策略 */
  urlStrategy: FileUrlStrategy;
  /** 自定义访问域名（CDN/加速域名），public 策略优先使用 */
  publicBaseUrl?: string;
  /** 临时签名有效期（秒） */
  presignedExpirySeconds: number;
  localRootPath?: string;
  // 阿里云 OSS
  ossRegion?: string;
  ossEndpoint?: string;
  ossBucket?: string;
  ossAccessKeyId?: string;
  ossAccessKeySecret?: string;
  // S3 兼容存储
  s3Region?: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3ForcePathStyle?: boolean;
  // 腾讯云 COS
  cosRegion?: string;
  cosBucket?: string;
  cosSecretId?: string;
  cosSecretKey?: string;
  // 华为云 OBS
  obsEndpoint?: string;
  obsBucket?: string;
  obsAccessKeyId?: string;
  obsSecretAccessKey?: string;
  // 七牛云 Kodo
  kodoAccessKey?: string;
  kodoSecretKey?: string;
  kodoBucket?: string;
  kodoRegion?: string;
  kodoEndpoint?: string;
  // 百度云 BOS
  bosEndpoint?: string;
  bosBucket?: string;
  bosAccessKeyId?: string;
  bosSecretAccessKey?: string;
  // Azure Blob Storage
  azureAccountName?: string;
  azureAccountKey?: string;
  azureContainerName?: string;
  azureEndpoint?: string;
  // SFTP
  sftpHost?: string;
  sftpPort?: number;
  sftpUsername?: string;
  sftpPassword?: string;
  sftpPrivateKey?: string;
  sftpRootPath?: string;
  sftpBaseUrl?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedFile {
  id: string;
  storageConfigId: number;
  storageName: string;
  provider: FileStorageProvider;
  originalName: string;
  objectKey: string;
  size: number;
  mimeType?: string;
  extension?: string;
  /** 稳定代理路径 /api/files/{id}/content：可持久化、永不失效 */
  url: string;
  /** public 策略的永久公开直链；仅渲染用，禁止持久化 */
  directUrl?: string | null;
  uploaderName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Storage Browse ──────────────────────────────────────
export interface FolderEntry {
  name: string;
  path: string;
}

export interface StorageBrowseResult {
  folders: FolderEntry[];
  files: ManagedFile[];
  currentPath: string;
  basePath: string;
}

// ─── File Stats ───────────────────────────────────────────────────────
export interface FileStats {
  summary: {
    totalFiles: number;
    totalSize: number;
    imageCount: number;
    docCount: number;
    videoCount: number;
    audioCount: number;
    todayCount: number;
    thisMonthCount: number;
  };
  typeStats: { type: string; label: string; count: number; size: number }[];
  providerStats: { provider: string; count: number; size: number }[];
  monthlyStats: { month: string; count: number }[];
  uploaderStats: { username: string; count: number; size: number }[];
  sizeRangeStats: { range: string; count: number }[];
}

// ─── Maintenance Logs ────────────────────────────────────
export type MaintenanceLogStatus = 'ongoing' | 'completed';

export interface MaintenanceLog {
  id: number;
  message: string;
  estimatedEndAt: string | null;
  startedAt: string | null;
  startedByName: string | null;
  endedAt: string | null;
  endedByName: string | null;
  durationSeconds: number | null;
  status: MaintenanceLogStatus;
  createdAt: string;
}

// ─── IP Access Logs ──────────────────────────────────────
export interface IpAccessLog {
  id: number;
  ip: string;
  path: string;
  method: string;
  blockType: 'blacklist' | 'whitelist';
  userAgent: string | null;
  createdAt: string;
}

// ─── Operation Logs ──────────────────────────────────────
export interface OperationLog {
  id: number;
  userId: number | null;
  username: string | null;
  /** 用户当前昵称（按 username 关联补充；用户已删除时为 null） */
  nickname?: string | null;
  module: string | null;
  description: string;
  method: string;
  path: string;
  /** 链路 ID（= 请求的 X-Request-Id），可跳转链路追踪 */
  requestId?: string | null;
  requestBody: string | null;
  beforeData: string | null;
  afterData: string | null;
  responseCode: number | null;
  responseBody: string | null;
  durationMs: number | null;
  ip: string | null;
  location?: string | null;
  userAgent: string | null;
  os: string | null;
  browser: string | null;
  createdAt: string;
}

export interface OperationLogStats {
  summary: {
    total: number;
    successCount: number;
    failCount: number;
    avgDurationMs: number | null;
    uniqueUsers: number;
    /** 耗时分位数（基于有耗时记录的请求） */
    p50DurationMs: number | null;
    p95DurationMs: number | null;
    p99DurationMs: number | null;
  };
  /** 上一周期（相同天数）汇总，用于环比 */
  prevSummary: {
    total: number;
    successCount: number;
    failCount: number;
    avgDurationMs: number | null;
    uniqueUsers: number;
  };
  moduleStats: { module: string; count: number }[];
  moduleTimingStats: { module: string; avgMs: number; maxMs: number; count: number }[];
  dailyStats: { date: string; count: number; successCount: number; failCount: number; avgMs: number | null }[];
  userStats: { username: string; nickname?: string | null; count: number }[];
  methodStats: { method: string; count: number }[];
  hourlyStats: { hour: number; count: number }[];
  /** 响应状态码分布（按 2xx/3xx/4xx/5xx 归类） */
  statusClassStats: { statusClass: string; count: number }[];
  /** 耗时区间分布 */
  durationHistogram: { bucket: string; count: number }[];
  /** 慢接口 Top（按平均耗时） */
  slowPaths: { path: string; avgMs: number; maxMs: number; count: number }[];
  /** 失败热点模块 Top（responseCode >= 400） */
  failModuleStats: { module: string; count: number }[];
  /** 用户 → 模块 操作流向（桑基图数据源） */
  userModuleFlows: { username: string; nickname?: string | null; module: string; count: number }[];
}

// ─── 系统监控告警 ─────────────────────────────────────────────────────────────
// MonitorMetric 及其标签/分组/单位元信息统一定义在 ./constants.ts（枚举 SSOT）

export type MonitorAlertOperator = 'gt' | 'gte' | 'lt' | 'lte';

export type MonitorAlertLevel = 'info' | 'warning' | 'critical';

export type MonitorAlertState = 'ok' | 'firing';

export type MonitorAlertEventStatus = 'firing' | 'resolved';
export interface MonitorAlertRule {
  id: number;
  name: string;
  metric: MonitorMetric;
  operator: MonitorAlertOperator;
  threshold: number;
  durationMinutes: number;
  level: MonitorAlertLevel;
  channels: string[];
  webhookUrl: string | null;
  recipientUserIds: number[];
  recipientEmails: string[];
  silenceMinutes: number;
  enabled: boolean;
  state: MonitorAlertState;
  lastTriggeredAt: string | null;
  lastValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorAlertEvent {
  id: number;
  ruleId: number | null;
  ruleName: string;
  metric: MonitorMetric;
  level: MonitorAlertLevel;
  operator: MonitorAlertOperator;
  threshold: number;
  value: number;
  status: MonitorAlertEventStatus;
  message: string;
  /** 最近一次通知派发的真实结果 */
  notifyStatus: MonitorAlertNotifyStatus;
  /** 本次实际尝试的渠道快照 */
  notifyChannels: string[];
  notifyError: string | null;
  notifiedAt: string | null;
  /** 人工处理状态，与 status 正交 */
  handleStatus: MonitorAlertHandleStatus;
  acknowledgedAt: string | null;
  handledBy: number | null;
  handledByName: string | null;
  handledAt: string | null;
  handleNote: string | null;
  triggeredAt: string;
  resolvedAt: string | null;
}

/** 告警概览：按级别的告警中数量 */
export interface MonitorAlertLevelCount {
  level: MonitorAlertLevel;
  count: number;
}

/** 告警概览：按天的触发 / 恢复趋势 */
export interface MonitorAlertTrendPoint {
  date: string;
  fired: number;
  resolved: number;
}

/** 告警概览：触发次数最多的规则 */
export interface MonitorAlertTopRule {
  ruleId: number | null;
  ruleName: string;
  count: number;
}

export interface MonitorAlertOverview {
  range: MonitorAlertOverviewRange;
  /** 当前处于告警中的事件数（不受时间范围限制，反映此刻状态） */
  firingTotal: number;
  firingByLevel: MonitorAlertLevelCount[];
  /** 告警中且无人认领的事件数 */
  pendingTotal: number;
  /** 最久未认领事件的触发时间与已等待分钟数 */
  oldestPendingAt: string | null;
  oldestPendingMinutes: number | null;
  /** 时间范围内的统计 */
  firedInRange: number;
  resolvedInRange: number;
  notifyFailedInRange: number;
  /** 平均确认耗时（分钟），无样本时为 null */
  mttaMinutes: number | null;
  /** 平均恢复耗时（分钟），无样本时为 null */
  mttrMinutes: number | null;
  trend: MonitorAlertTrendPoint[];
  topRules: MonitorAlertTopRule[];
}

/** 规则试发通知的结果：直接暴露各渠道派发情况，便于定位是哪一个渠道配错了 */
export interface MonitorAlertTestResult {
  status: MonitorAlertNotifyStatus;
  channels: string[];
  error: string | null;
}

export interface MonitorHistoryPoint {
  t: string;
  cpu: number;
  memory: number;
  disk: number;
  swap: number;
  load1: number;
  procCpu: number;
  heap: number;
  loopLag: number;
  qps: number;
  errorRate: number;
  netRxBps: number;
  netTxBps: number;
  diskReadBps: number;
  diskWriteBps: number;
}

export interface MonitorHistory {
  range: string;
  bucketSec: number;
  points: MonitorHistoryPoint[];
}

export interface SessionListItem {
  id: number;
  sessionId: string;
  userId: number | null;
  username: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  pageCount: number;
  eventCount: number;
  entryPage: string | null;
  exitPage: string | null;
  referrer: string | null;
  browser: string | null;
  os: string | null;
  deviceType: AnalyticsDeviceType | null;
  region: string | null;
  isBounce: boolean;
  memberId: number | null;
  source: AnalyticsEventSource;
  appId: string;
  environment: AnalyticsEnvironment;
}

export interface SessionTimelineEvent {
  id: number;
  eventType: UserBehaviorEventType;
  eventName: string | null;
  pagePath: string;
  pageTitle: string | null;
  elementLabel: string | null;
  componentArea: string | null;
  durationMs: number | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
}

export interface SessionTimeline {
  sessionId: string;
  username: string | null;
  userId: number | null;
  startedAt: string | null;
  durationMs: number | null;
  entryPage: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  items: SessionTimelineEvent[];
}

// ─── 系统参数配置 ──────────────────────────────────────────
export type ConfigType = 'string' | 'number' | 'boolean' | 'json';

export interface SystemConfig {
  id: number;
  configKey: string;
  configName: string;
  configValue: string;
  configType: ConfigType;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentitySecurityPolicy {
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireSpecialChar: boolean;
    expiryEnabled: boolean;
    expiryDays: number;
  };
  lockout: {
    maxAttempts: number;
    durationMinutes: number;
  };
  mfa: {
    enabled: boolean;
    mode: 'off' | 'optional' | 'required';
    rememberDeviceDays: number;
  };
  risk: {
    enabled: boolean;
    newDeviceAction: 'allow' | 'challenge';
  };
}

export interface MfaFactor {
  id: number;
  type: 'totp' | 'passkey' | 'recovery_code';
  name: string;
  status: 'pending' | 'enabled' | 'disabled';
  verifiedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface TotpSetupResult {
  factorId: number;
  secret: string;
  otpauthUrl: string;
}

export interface TrustedDevice {
  id: number;
  deviceName: string | null;
  ip: string | null;
  userAgent: string | null;
  trustedUntil: string;
  lastSeenAt: string;
  createdAt: string;
}

// ─── 定时任务 ──────────────────────────────────────────────
export type CronRunStatus = 'success' | 'fail' | 'running';

export interface CronJob {
  id: number;
  name: string;
  cronExpression: string;
  handler: string;
  params: string | null;
  status: EntityStatus;
  description: string;
  retryCount: number;
  /** 重试间隔，单位：秒 */
  retryInterval: number;
  retryBackoff: boolean;
  monitorTimeout: number | null;
  lastRunAt: string | null;
  lastRunStatus: CronRunStatus | null;
  lastRunMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobStatsPerJob {
  jobId: number;
  jobName: string;
  totalRuns: number;
  successCount: number;
  failCount: number;
  successRate: number;
  avgDurationMs: number | null;
  /** P95 耗时（长尾性能），无已完成执行时为 null */
  p95DurationMs: number | null;
  /** 近 10 次执行状态（旧 → 新） */
  recentResults: CronRunStatus[];
  /** 当前连续失败次数（最近一次成功后归零） */
  consecutiveFails: number;
  lastRunStatus: CronRunStatus | null;
  lastRunAt: string | null;
}

export interface CronJobDailyStat {
  date: string;
  total: number;
  successCount: number;
  failCount: number;
  /** 当日已完成执行的平均耗时 */
  avgDurationMs: number | null;
}

export interface CronJobHourlyStat {
  /** 0-23 */
  hour: number;
  total: number;
  failCount: number;
}

export interface CronJobRecentLog {
  id: number;
  jobId: number;
  jobName: string;
  status: CronRunStatus;
  durationMs: number | null;
  startedAt: string;
  executionCount: number;
  output: string | null;
}

export interface CronJobStats {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  todayRuns: number;
  todaySuccesses: number;
  todayFails: number;
  todayAvgDurationMs: number | null;
  perJob: CronJobStatsPerJob[];
  dailyStats: CronJobDailyStat[];
  /** 近 7 天按小时执行分布（识别调度高峰） */
  hourlyStats: CronJobHourlyStat[];
  recentLogs: CronJobRecentLog[];
}

// ─── 系统调度 ──────────────────────────────────────────────
export type SystemSchedulerTaskType = 'recurring' | 'queue';

export type SystemSchedulerRunStatus = 'running' | 'success' | 'failed';

export type SystemSchedulerTriggerType = 'schedule' | 'manual' | 'queue';

/** 系统调度任务注册信息基础字段（任务中心与工作流引擎诊断共用） */
export interface SystemSchedulerTaskBase {
  name: string;
  title: string;
  module: string;
  description: string | null;
  taskType: SystemSchedulerTaskType;
  cronExpression: string | null;
  registeredAt: string;
  registeredNodeId: string;
  registeredHostname: string;
  registeredPid: number;
  allowManualRun: boolean;
  enabled: boolean;
  logRetentionDays: number;
  logRetentionRuns: number;
  timeoutMs: number | null;
  failureAlertThreshold: number;
  alertEnabled: boolean;
  alertChannels: SystemSchedulerAlertChannel[];
  alertUserIds: number[];
  alertEmails: string[];
  alertWebhookUrl: string | null;
  manualSingleton: boolean;
  lastRunAt: string | null;
  lastRunStatus: SystemSchedulerRunStatus | null;
  lastRunMessage: string | null;
  lastDurationMs: number | null;
}

export interface SystemSchedulerTask extends SystemSchedulerTaskBase {
  nextRunAt: string | null;
  running: boolean;
  totalRuns: number;
  successCount: number;
  failedCount: number;
  alertCount: number;
  lastAlertAt: string | null;
  lastAlertMessage: string | null;
  queueQueuedCount: number;
  queueActiveCount: number;
  queueDeferredCount: number;
  queueTotalCount: number;
  queueFailedCount: number;
  queueCompletedCount: number;
  queueStateCounts: Record<string, number>;
}

export interface SystemSchedulerRun {
  id: number;
  taskName: string;
  taskTitle: string;
  taskType: SystemSchedulerTaskType;
  module: string;
  triggerType: SystemSchedulerTriggerType;
  status: SystemSchedulerRunStatus;
  jobId: string | null;
  nodeId: string | null;
  nodeHostname: string | null;
  nodePid: number | null;
  triggeredBy: number | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  resultMessage: string | null;
  errorMessage: string | null;
  alertedAt: string | null;
  alertMessage: string | null;
  alertSentAt: string | null;
  alertChannels: SystemSchedulerAlertChannel[];
  alertAckAt: string | null;
  alertAckBy: number | null;
  alertAckByName: string | null;
  alertAckNote: string | null;
  createdAt: string;
}

export interface SystemSchedulerNode {
  nodeId: string;
  hostname: string;
  pid: number;
  version: string | null;
  startedAt: string;
  lastHeartbeatAt: string;
  registeredTaskCount: number;
  runningJobCount: number;
  active: boolean;
  stale: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OnlineUser {
  tokenId: string;
  userId: number;
  username: string;
  nickname: string;
  tenantId?: number | null;
  ip: string;
  location?: string | null;
  browser: string;
  os: string;
  loginAt: string;
}

export type WsMessage =
  | { type: 'announcement:new'; payload: Announcement }
  | { type: 'announcement:updated'; payload: Announcement }
  | { type: 'announcement:deleted'; payload: { id: number } }
  | { type: 'announcement:read'; payload: { id: number } }
  | { type: 'announcement:read-all'; payload: Record<string, never> }
  | { type: 'in-app-message:new'; payload: InAppMessage }
  | { type: 'in-app-message:read'; payload: { id: number } }
  | { type: 'in-app-message:read-all'; payload: Record<string, never> }
  | { type: 'in-app-message:deleted'; payload: { id: number } }
  | { type: 'session:force-logout'; payload: { reason: string } }
  | { type: 'chat:message'; payload: ChatMessage }
  | { type: 'chat:recall'; payload: { conversationId: number; messageId: number } }
  | { type: 'chat:read'; payload: { conversationId: number; userId: number; readAt: string } }
  | { type: 'chat:member-join'; payload: { conversationId: number; user: { id: number; nickname: string; avatar: string | null } } }
  | { type: 'chat:member-leave'; payload: { conversationId: number; userId: number } }
  | { type: 'chat:group-update'; payload: { conversationId: number; name?: string | null; announcement?: string | null; muteAll?: boolean; joinApproval?: boolean } }
  | { type: 'chat:member-update'; payload: { conversationId: number } }
  | { type: 'chat:join-request'; payload: { conversationId: number } }
  | { type: 'chat:conversation-removed'; payload: { conversationId: number; reason: 'disbanded' } }
  | { type: 'chat:typing'; payload: { conversationId: number; userId: number; nickname: string } }
  | { type: 'chat:reaction'; payload: { conversationId: number; messageId: number; reactions: ChatReactionGroup[] } }
  | { type: 'chat:edit'; payload: ChatMessage }
  | { type: 'chat:vote-update'; payload: { conversationId: number; messageId: number; voteData: ChatVoteData } }
  | { type: 'chat:presence'; payload: { userId: number; online: boolean; lastSeen: string | null } }
  | { type: 'channel:message'; payload: ChannelMessage }
  | { type: 'channel:message-retract'; payload: { channelId: number; messageId: number } }
  | { type: 'channel:cs-message'; payload: { channelId: number } }
  | { type: 'rtc:invite'; payload: RtcInvitePayload }
  | { type: 'rtc:accept'; payload: { callId: string; to: number; from: RtcPeerInfo } }
  | { type: 'rtc:reject'; payload: { callId: string; to: number; reason?: string } }
  | { type: 'rtc:busy'; payload: { callId: string; to: number } }
  | { type: 'rtc:cancel'; payload: { callId: string; conversationId: number; to?: number } }
  | { type: 'rtc:join'; payload: { callId: string; conversationId: number; from: RtcPeerInfo } }
  | { type: 'rtc:room-participants'; payload: { callId: string; participants: RtcPeerInfo[] } }
  | { type: 'rtc:leave'; payload: { callId: string; conversationId: number; from: number; to?: number } }
  | { type: 'rtc:offer'; payload: { callId: string; to: number; from: number; sdp: string } }
  | { type: 'rtc:answer'; payload: { callId: string; to: number; from: number; sdp: string } }
  | { type: 'rtc:ice'; payload: { callId: string; to: number; from: number; candidate: RtcIceCandidateInit } }
  | { type: 'workflow:taskCreated'; payload: { instanceId: number; taskId: number; instanceTitle: string; nodeName: string } }
  | { type: 'workflow:taskFinished'; payload: { instanceId: number; taskId: number; decision: 'approved' | 'rejected' | 'skipped' } }
  | { type: 'workflow:instanceFinished'; payload: { instanceId: number; status: WorkflowInstanceStatus; title: string } }
  | { type: 'payment:success'; payload: { orderNo: string; bizType: string; bizId: string; amount: number } }
  | { type: 'payment:closed'; payload: { orderNo: string; bizType: string; bizId: string } }
  | { type: 'payment:failed'; payload: { orderNo: string; bizType: string; bizId: string } }
  | { type: 'payment:refunded'; payload: { orderNo: string; refundNo: string; refundAmount: number } }
  | { type: 'payment:refund-failed'; payload: { orderNo: string; refundNo: string; refundAmount: number } }
  | { type: 'task:progress'; payload: AsyncTask }
  | { type: 'mp-kf:session-new'; payload: MpKfSession }
  | { type: 'mp-kf:session-update'; payload: MpKfSession }
  | { type: 'mp-kf:session-message'; payload: { sessionId: number; accountId: number; openid: string; direction: MpMessageDirection; msgType: MpMessageType; content: string | null; createdAt: string } }
  | { type: 'analytics:ingest'; payload: { count: number } }
  | { type: 'analytics:config-updated'; payload: { tenantId: number | null } }
  | { type: 'iot:telemetry'; payload: { deviceId: number; metrics: Record<string, number | string | boolean>; reportedAt: string } }
  | { type: 'iot:shadow'; payload: { deviceId: number; reported: Record<string, number | string | boolean>; desired: Record<string, number | string | boolean>; desiredVersion: number } }
  | { type: 'iot:device-event'; payload: { deviceId: number; kind: 'lifecycle' | 'model' | 'anomaly'; identifier: string; name: string; level: 'info' | 'warn' | 'fault'; reportedAt: string } };

// ─── 地区管理 ──────────────────────────────────────────────
export type RegionLevel = 'province' | 'city' | 'county';

export interface Region {
  id: number;
  code: string;
  name: string;
  level: RegionLevel;
  parentCode: string | null;
  sort: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  children?: Region[];
}

// ─── 数据库备份 ────────────────────────────────────────────────────────────
export type BackupType = 'pg_dump' | 'drizzle_export';

export type BackupStatus = 'pending' | 'running' | 'success' | 'failed';

export interface DbBackup {
  id: number;
  name: string;
  type: BackupType;
  fileId: string | null;
  fileSize: number | null;
  status: BackupStatus;
  tables: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdBy: number | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  groupName: string | null;
  description: string | null;
  status: EntityStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── 数据脱敏配置 ─────────────────────────────────────────────────────────────

export type MaskType = 'phone' | 'email' | 'id_card' | 'name' | 'bank_card' | 'custom';

export interface CustomMaskRule {
  prefixKeep: number;
  suffixKeep: number;
  maskChar?: string;
}

export interface DataMaskConfig {
  id: number;
  entity: string;
  field: string;
  label: string;
  maskType: MaskType;
  customRule?: CustomMaskRule | null;
  exemptRoleCodes: string[];
  enabled: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SensitiveField {
  tableName: string;
  columnName: string;
  dataType: string;
  suggestedMaskType: MaskType;
  suggestedLabel: string;
  hasRule: boolean;
}

export interface UploadCertInput {
  name: string;
  domain: string;
  certContent: string;
  keyContent: string;
}

// ─── 链路追踪 ─────────────────────────────────────────────────────────────────
import type { TraceNodeKind, TraceNodeStatus } from './constants';

/** 链路时间线节点：五类锚点归一后的统一结构 */
export interface TraceTimelineNode {
  kind: TraceNodeKind;
  /** 节点时间（YYYY-MM-DD HH:mm:ss） */
  ts: string;
  title: string;
  status: TraceNodeStatus;
  durationMs: number | null;
  /** 源单据 ID（对应锚点表主键） */
  refId: number;
  /** kind 专属明细（渠道投递结果 / 作业错误 / 审计摘要等） */
  detail: Record<string, unknown>;
}

export interface TraceTimeline {
  traceId: string;
  nodes: TraceTimelineNode[];
}

/** 最近失败链路条目（排障入口列表） */
export interface TraceFailureEntry {
  kind: TraceNodeKind;
  refId: number;
  traceId: string;
  title: string;
  error: string;
  /** YYYY-MM-DD HH:mm:ss */
  ts: string;
}
