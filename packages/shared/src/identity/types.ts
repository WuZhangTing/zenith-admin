import type { AiProvider } from '../ai/constants';
import type { EntityStatus, PaginatedResponse } from '../core/types';
import type { OAuthProviderType } from './constants';

// ─── 租户 ─────────────────────────────────────────────────────────────────────
export interface Tenant {
  id: number;
  name: string;
  code: string;
  logo?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  status: EntityStatus;
  expireAt?: string | null;
  maxUsers?: number | null;
  packageId?: number | null;
  packageName?: string | null;
  userCount?: number;
  remark?: string | null;
  /** 自动初始化的租户管理员账号（仅创建响应返回，password 一次性可见） */
  initialAdmin?: { username: string; email: string; password: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantStats {
  id: number;
  name: string;
  code: string;
  status: EntityStatus;
  userCount: number;
  maxUsers: number | null;
  departmentCount: number;
  roleCount: number;
  positionCount: number;
  packageId: number | null;
  packageName: string | null;
  packageMenuCount: number;
  expireAt: string | null;
  /** 距到期天数；null=永不过期，负数=已过期 */
  daysToExpire: number | null;
}

export interface TenantPackage {
  id: number;
  name: string;
  status: EntityStatus;
  remark?: string | null;
  /** 关联的菜单 ID（详情接口返回）*/
  menuIds?: number[];
  /** 已关联菜单数量（列表接口返回）*/
  menuCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

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
  userPreview?: Array<{ id: number; nickname: string; avatar?: string | null }>;
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
  userPreview?: Array<{ id: number; nickname: string; avatar: string | null }>;
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
  userPreview?: Array<{ id: number; nickname: string; avatar?: string | null }>;
  createdAt: string;
  updatedAt: string;
}

// ─── 用户组 ────────────────────────────────────────────────────────────
export interface UserGroup {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  ownerId?: number | null;
  ownerName?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  memberCount?: number;
  memberPreview?: Array<{ id: number; nickname: string; avatar?: string | null }>;
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
  dailyStats: { date: string; count: number; successCount: number; failCount: number }[];
  userStats: { username: string; count: number }[];
  ipStats: { ip: string; count: number }[];
  ipFailStats: { ip: string; count: number }[];
  browserStats: { browser: string; count: number }[];
  osStats: { os: string; count: number }[];
  hourlyStats: { hour: number; count: number }[];
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
  createdAt: string;
  updatedAt: string;
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
  provider: AiProvider;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  temperature: string | null;
  maxTokens: number | null;
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
  status: UserFeedbackStatus;
  handleRemark: string | null;
  handledBy: number | null;
  /** 处理人昵称（JOIN 后附加） */
  handlerNickname?: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
