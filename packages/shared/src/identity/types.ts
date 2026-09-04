import type { AiModelSettings, AiModelCapabilities } from '../ai/types';
import type { EntityStatus, PaginatedResponse } from '../core/types';
import type {
  OAuthProviderType,
  DirectorySyncSourceType, DirectorySyncMatchKey, DirectorySyncConflictPolicy,
  DirectorySyncRunStatus, DirectorySyncTriggerType, DirectorySyncItemAction,
  DirectorySyncEntityType, DirectorySyncConflictType, DirectorySyncConflictStatus,
  DirectorySyncResolution,
} from './constants';

export interface User {
  id: number;
  username: string;
  nickname: string;
  email: string | null;
  phone?: string | null;
  gender?: string | null;
  avatar?: string;
  departmentId?: number | null;
  departmentName?: string | null;
  tenantId?: number | null;
  tenantName?: string | null;
  /** 平台超管当前查看的租户；null/缺省表示平台视角 */
  viewingTenantId?: number | null;
  positionIds?: number[];
  positions?: Position[];
  roles: Role[];
  status: EntityStatus;
  passwordUpdatedAt: string;
  requirePasswordChange?: boolean;
  isLocked?: boolean;
  isOnline?: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  lastLoginLocation?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 列表页成员摘要中的最小用户信息。 */
export interface UserPreview {
  id: number;
  nickname: string;
  avatar?: string | null;
}

/** 告警接收用户下拉项：只暴露投递所需的最小信息，不返回邮箱原文。 */
export interface AlertRecipientUser {
  id: number;
  username: string;
  nickname: string;
  departmentName: string | null;
  hasEmail: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'> & { requirePasswordChange?: boolean };
  token: AuthTokens;
  requirePasswordChange?: boolean;
}

export interface MfaLoginChallenge {
  mfaRequired: true;
  challengeId: string;
  methods: ('totp' | 'passkey')[];
  expiresAt: number;
  reason?: string | null;
}

export type LoginResult = LoginResponse | MfaLoginChallenge;

// ─── JWT Payload ──────────────────────────────────────────────────────────────
export interface JwtPayload {
  userId: number;
  username: string;
  roles: string[];
  tenantId: number | null;
  /** 超管切换租户视角时，存放目标租户 ID */
  viewingTenantId?: number | null;
  jti?: string;
}

// ─── 菜单 ─────────────────────────────────────────────────────────────────────
export type MenuType = 'directory' | 'menu' | 'button';

export interface Menu {
  id: number;
  parentId: number;
  title: string;
  name?: string;
  path?: string;
  component?: string;
  icon?: string;
  type: MenuType;
  permission?: string;
  query?: string | null;
  isExternal?: boolean;
  /** 外链打开方式：false=新窗口，true=系统内 iframe 内嵌 */
  embed?: boolean;
  /** 页面缓存：多页签模式下切走保留组件状态（React Activity） */
  keepAlive?: boolean;
  sort: number;
  status: EntityStatus;
  visible: boolean;
  /** 所属可授权功能（null = 核心能力，不受 License / 套餐限制）；由功能目录派生 */
  featureKey?: string | null;
  createdAt: string;
  updatedAt: string;
  children?: Menu[];
}

// ─── 角色 ─────────────────────────────────────────────────────────────────────
export type DataScope = 'all' | 'custom' | 'dept_only' | 'dept' | 'self';

export interface Role {
  id: number;
  name: string;
  code: string;
  description?: string;
  dataScope: DataScope;
  tenantId?: number | null;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  menuIds?: number[];
  deptScopeIds?: number[];
  userCount?: number;
  userPreview?: UserPreview[];
}

// ─── 部门 ─────────────────────────────────────────────────────────────────────
export interface Department {
  id: number;
  parentId: number;
  name: string;
  code: string;
  category?: string;
  leaderId?: number | null;
  leaderName?: string | null;
  phone?: string;
  email?: string;
  sort: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
  children?: Department[];
  userCount?: number;
  userPreview?: UserPreview[];
}

// ─── 岗位 ─────────────────────────────────────────────────────────────────────
export interface Position {
  id: number;
  name: string;
  code: string;
  sort: number;
  status: EntityStatus;
  remark?: string;
  userCount?: number;
  userPreview?: UserPreview[];
  createdAt: string;
  updatedAt: string;
}

// ─── 用户组 ────────────────────────────────────────────────────────────

/** 成员模式：static = 手工维护；dynamic = 按规则自动物化到成员表 */
export type UserGroupMemberMode = 'static' | 'dynamic';

/**
 * 动态组成员规则。条件组之间 AND，组内多值 OR；隐含条件：仅启用用户、同租户。
 * exclude 优先级最高；include 是规则外的强制例外。
 */
export interface UserGroupMemberRule {
  /** 命中这些部门（配合 includeSubDepartments 展开子树） */
  departmentIds?: number[];
  includeSubDepartments?: boolean;
  /** 命中任一岗位 */
  positionIds?: number[];
  /** 强制包含（规则之外的例外名单） */
  includeUserIds?: number[];
  /** 强制排除（优先级最高） */
  excludeUserIds?: number[];
}

export interface UserGroup {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  memberMode: UserGroupMemberMode;
  memberRule?: UserGroupMemberRule | null;
  /** 动态组最近一次成员同步时间 */
  ruleSyncedAt?: string | null;
  memberCount?: number;
  memberPreview?: UserPreview[];
  roleCount?: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Login Logs ──────────────────────────────────────────
export type LoginEventType = 'login' | 'logout';

export interface LoginLog {
  id: number;
  userId: number | null;
  username: string;
  /** 用户当前昵称（按 username 关联补充；用户已删除时为 null） */
  nickname?: string | null;
  ip: string | null;
  location: string | null;
  browser: string | null;
  os: string | null;
  userAgent: string | null;
  eventType: LoginEventType;
  status: 'success' | 'fail';
  message: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  devicePixelRatio?: string | null;
  gpu?: string | null;
  cpuCores?: number | null;
  memoryGb?: string | null;
  createdAt: string;
}

export interface LoginLogStats {
  summary: {
    total: number;
    successCount: number;
    failCount: number;
    uniqueUsers: number;
  };
  /** 上一周期（相同天数）汇总，用于环比 */
  prevSummary: {
    total: number;
    successCount: number;
    failCount: number;
    uniqueUsers: number;
  };
  dailyStats: { date: string; count: number; successCount: number; failCount: number }[];
  userStats: { username: string; nickname?: string | null; count: number }[];
  ipStats: { ip: string; count: number }[];
  ipFailStats: { ip: string; count: number }[];
  browserStats: { browser: string; count: number }[];
  osStats: { os: string; count: number }[];
  hourlyStats: { hour: number; count: number }[];
  /** 失败原因分布（按 message 分组） */
  failReasonStats: { message: string; count: number }[];
  /** 登录地点 Top（IP 归属地） */
  locationStats: { location: string; count: number }[];
  /** 星期 × 小时活跃分布（dow: 1=周一 … 7=周日） */
  dowHourStats: { dow: number; hour: number; count: number }[];
  /** 设备屏幕分辨率 Top */
  resolutionStats: { resolution: string; count: number }[];
  /** 设备 GPU Top */
  gpuStats: { gpu: string; count: number }[];
}

// ─── 用户行为分析 ────────────────────────────────────────────
export type UserBehaviorEventType =
  | 'page_view' | 'page_leave' | 'feature_use' | 'area_click'
  | 'custom' | 'perf' | 'api_request' | 'identify';

export interface UserStatItem {
  userId: number | null;
  username: string | null;
  totalEvents: number;
  pageViews: number;
  uniquePages: number;
  featureUses: number;
  totalDwellMs: number | null;
  lastActiveAt: string | null;
}

export type UserStats = PaginatedResponse<UserStatItem>;

export interface UserTimelineEvent {
  id: number;
  eventType: UserBehaviorEventType;
  eventName: string | null;
  pagePath: string;
  pageTitle: string | null;
  elementLabel: string | null;
  componentArea: string | null;
  durationMs: number | null;
  sessionId: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
}

export interface UserTimeline {
  userId: number | null;
  username: string | null;
  totalEvents: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  items: UserTimelineEvent[];
}

export interface LoginRiskEvent {
  id: number;
  userId: number | null;
  username: string;
  tenantId: number | null;
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
  action: 'allow' | 'challenge' | 'block';
  ip: string | null;
  location: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─── 验证码 ──────────────────────────────────────────────
export interface CaptchaResponse {
  captchaId: string;
  captchaImage: string;
}

// ─── OAuth 第三方账号 ───────────────────────────────────────────────────────
export interface OAuthAccount {
  id: number;
  userId: number;
  provider: OAuthProviderType;
  openId: string;
  unionId?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthProviderInfo {
  key: OAuthProviderType;
  label: string;
  icon: string;
}

export interface OAuthConfig {
  id: number;
  provider: OAuthProviderType;
  clientId: string;
  clientSecret: string;
  agentId?: string | null;
  corpId?: string | null;
  enabled: boolean;
  /** 登录时按提供方断言的已验证邮箱自动关联既有本地账号（平台超管永不自动关联） */
  autoLinkByEmail: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 发起第三方登录 / 绑定时的授权链接与一次性 state（前端须暂存 state，回调时原样带回） */
export interface OAuthAuthUrl {
  authUrl: string;
  state: string;
}

/** 前端在跳转到提供方之前暂存于 sessionStorage 的 OAuth 往返上下文 */
export interface OAuthPendingState {
  state: string;
  provider: OAuthProviderType;
  intent: 'login' | 'bind';
  redirectTo?: string | null;
}

// ─── 企业身份源 ───────────────────────────────────────────────────────────
export type IdentityProviderType = 'oidc' | 'saml' | 'ldap' | 'ad';

export type IdentityProviderStatus = 'enabled' | 'disabled';

export interface IdentityProviderAttributeMapping {
  subject?: string;
  email?: string;
  username?: string;
  nickname?: string;
  phone?: string;
  department?: string;
}

export interface TenantIdentityProvider {
  id: number;
  tenantId: number | null;
  tenantName?: string | null;
  name: string;
  code: string;
  type: IdentityProviderType;
  status: IdentityProviderStatus;
  issuer?: string | null;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
  userinfoEndpoint?: string | null;
  jwksUri?: string | null;
  clientId?: string | null;
  clientSecret?: string;
  scopes: string;
  samlSsoUrl?: string | null;
  samlEntityId?: string | null;
  samlCertificate?: string;
  ldapUrl?: string | null;
  ldapStartTls: boolean;
  ldapSkipTlsVerify: boolean;
  ldapBaseDn?: string | null;
  ldapBindDn?: string | null;
  ldapBindPassword?: string;
  ldapUserFilter?: string | null;
  ldapUserSearchFilter?: string | null;
  ldapSyncFilter?: string | null;
  ldapGroupBaseDn?: string | null;
  ldapGroupFilter?: string | null;
  ldapTimeoutMs: number;
  attributeMapping: IdentityProviderAttributeMapping;
  jitEnabled: boolean;
  autoLinkByEmail: boolean;
  defaultRoleIds: number[];
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantIdentityProviderSummary {
  id: number;
  name: string;
  code: string;
  type: IdentityProviderType;
}

export interface EnterpriseIdentityDiscovery {
  tenantCode?: string | null;
  providers: TenantIdentityProviderSummary[];
}

export interface CreateTenantIdentityProviderInput {
  /** 仅平台管理员可指定（null = 平台级）；其他调用者由服务端强制落到自身租户 */
  tenantId?: number | null;
  name: string;
  code: string;
  type: IdentityProviderType;
  status?: IdentityProviderStatus;
  issuer?: string | null;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
  userinfoEndpoint?: string | null;
  jwksUri?: string | null;
  clientId?: string | null;
  clientSecret?: string;
  scopes?: string;
  samlSsoUrl?: string | null;
  samlEntityId?: string | null;
  samlCertificate?: string;
  ldapUrl?: string | null;
  ldapStartTls?: boolean;
  ldapSkipTlsVerify?: boolean;
  ldapBaseDn?: string | null;
  ldapBindDn?: string | null;
  ldapBindPassword?: string;
  ldapUserFilter?: string | null;
  ldapUserSearchFilter?: string | null;
  ldapSyncFilter?: string | null;
  ldapGroupBaseDn?: string | null;
  ldapGroupFilter?: string | null;
  ldapTimeoutMs?: number;
  attributeMapping?: IdentityProviderAttributeMapping;
  jitEnabled?: boolean;
  autoLinkByEmail?: boolean;
  defaultRoleIds?: number[];
  remark?: string | null;
}

export type UpdateTenantIdentityProviderInput = Partial<CreateTenantIdentityProviderInput>;

export interface LdapDirectoryUser {
  dn: string;
  subject: string;
  email?: string | null;
  username: string;
  nickname: string;
  phone?: string | null;
  department?: string | null;
}

export interface IdentityProviderConnectionTestResult {
  ok: boolean;
  message: string;
  sampleUsers: LdapDirectoryUser[];
}

export interface IdentityProviderSyncResult {
  logId: number;
  status: 'success' | 'failed' | 'partial';
  total: number;
  created: number;
  linked: number;
  updated: number;
  skipped: number;
  failed: number;
  message: string;
}

export interface IdentityProviderSyncLog {
  id: number;
  providerId: number;
  status: 'success' | 'failed' | 'partial';
  triggerType: string;
  total: number;
  created: number;
  linked: number;
  updated: number;
  skipped: number;
  failed: number;
  message?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

// ─── 个人会话 ──────────────────────────────────────────────────────────────────
export interface UserSession {
  tokenId: string;
  ip: string;
  location?: string | null;
  browser: string;
  os: string;
  loginAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

// ─── 个人 API Token ────────────────────────────────────────────────────────────
export interface UserApiToken {
  id: number;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserApiTokenCreated {
  id: number;
  name: string;
  token: string; // 完整 token，仅创建时返回
  createdAt: string;
}

export interface UserAiConfig {
  id: number;
  userId: number;
  name: string | null;
  /** Mastra provider ID 或 'custom' */
  providerId: string;
  baseUrl: string | null;
  apiKey: string | null;
  /** 自定义请求头（组织 ID 等，随请求透传） */
  headers: Record<string, string> | null;
  /** 启用的模型列表（聊天时可切换） */
  models: string[];
  /** 默认模型（须包含在 models 中） */
  defaultModel: string | null;
  modelSettings: AiModelSettings | null;
  /** 服务商特定选项（按 provider 分组透传） */
  providerOptions: Record<string, Record<string, unknown>> | null;
  /** 模型能力标签（vision / tools） */
  capabilities: AiModelCapabilities | null;
  systemPrompt: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 意见反馈 ────────────────────────────────────────────────────────────────
export type UserFeedbackCategory = 'suggestion' | 'bug' | 'ux' | 'other';

export type UserFeedbackStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface UserFeedback {
  id: number;
  userId: number;
  /** 提交人昵称（JOIN 后附加） */
  userNickname?: string | null;
  /** 满意度评分 1-5，可空 */
  score: number | null;
  category: UserFeedbackCategory;
  content: string | null;
  /** 提交时所在页面路由 */
  pagePath: string | null;
  /** 提交时活跃的会话回放 ID（反馈联动） */
  replayId: string | null;
  status: UserFeedbackStatus;
  handleRemark: string | null;
  handledBy: number | null;
  /** 处理人昵称（JOIN 后附加） */
  handlerNickname?: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 通讯录同步 ───────────────────────────────────────────────────────────────

/** 同步源的生命周期策略 */
export interface DirectorySyncLifecycle {
  /** 源侧消失或停用时禁用本地账号 */
  disableOnLeave: boolean;
  /** 禁用账号时强制下线其全部会话 */
  kickSessions: boolean;
  /** 新建账号授予的默认角色 */
  defaultRoleIds: number[];
}

/** 同步范围（为空 = 全量） */
export interface DirectorySyncScope {
  deptExternalIds?: string[];
  excludeUserExternalIds?: string[];
}

export interface DirectorySyncSource {
  id: number;
  name: string;
  type: DirectorySyncSourceType;
  status: EntityStatus;
  tenantId: number | null;
  /** LDAP/AD 源绑定的企业身份源 */
  identityProviderId: number | null;
  /** 绑定身份源名称（JOIN 后附加） */
  identityProviderName?: string | null;
  /** 平台 API 源绑定的 OAuth provider（如 dingtalk） */
  oauthProvider: string | null;
  matchKey: DirectorySyncMatchKey;
  /** 字段映射：本地字段 → 源侧标准字段（username/nickname/email/phone）或 __ignore__（不同步） */
  fieldMapping: Record<string, string>;
  scopeConfig: DirectorySyncScope;
  conflictPolicy: DirectorySyncConflictPolicy;
  lifecycle: DirectorySyncLifecycle;
  syncDepartments: boolean;
  cronExpression: string | null;
  circuitBreakerPercent: number;
  /** 企业微信通讯录 Secret 是否已配置（明文不回显） */
  contactSecretSet?: boolean;
  /** 回调 Token / SCIM Bearer Token 是否已配置（明文不回显） */
  callbackTokenSet?: boolean;
  /** 回调 AES Key 是否已配置（明文不回显） */
  callbackAesKeySet?: boolean;
  /** 回调 / SCIM URL 的随机路径段 */
  callbackUrlKey: string | null;
  /** 最近一次收到平台回调事件的时间 */
  callbackLastEventAt: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: DirectorySyncRunStatus | null;
  remark: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectorySyncRun {
  id: number;
  sourceId: number;
  /** 源名称（JOIN 后附加） */
  sourceName?: string | null;
  triggerType: DirectorySyncTriggerType;
  dryRun: boolean;
  status: DirectorySyncRunStatus;
  totalFetched: number;
  deptCreated: number;
  deptUpdated: number;
  userCreated: number;
  userLinked: number;
  userUpdated: number;
  userDisabled: number;
  skipped: number;
  conflictCount: number;
  failedCount: number;
  message: string | null;
  errorMessage: string | null;
  triggeredBy: number | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface DirectorySyncRunItem {
  id: number;
  runId: number;
  entityType: DirectorySyncEntityType;
  externalId: string;
  name: string | null;
  action: DirectorySyncItemAction;
  applied: boolean;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  message: string | null;
  createdAt: string;
}

export interface DirectorySyncConflict {
  id: number;
  sourceId: number;
  /** 源名称（JOIN 后附加） */
  sourceName?: string | null;
  runId: number | null;
  entityType: DirectorySyncEntityType;
  externalId: string;
  name: string | null;
  conflictType: DirectorySyncConflictType;
  sourceData: Record<string, unknown> | null;
  localData: Record<string, unknown> | null;
  candidateUserIds: number[];
  status: DirectorySyncConflictStatus;
  resolution: DirectorySyncResolution | null;
  resolvedBy: number | null;
  /** 裁决人昵称（JOIN 后附加） */
  resolvedByNickname?: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 同步结果摘要（提交手动同步 / 引擎返回） */
export interface DirectorySyncRunResult {
  runId: number;
  status: DirectorySyncRunStatus;
  message: string;
}
