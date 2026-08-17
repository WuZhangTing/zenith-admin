// ─── OAuth2 服务端 ─────────────────────────────────────────────────────────

export interface OAuth2Client {
  id: number;
  clientId: string;
  clientSecretPrefix?: string | null;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: string[];
  isPublic: boolean;
  /** 开放平台：绑定的限流套餐 ID */
  ratePlanId?: number | null;
  /** 开放平台：调用开放 API 时是否强制 HMAC 签名验签 */
  signEnabled?: boolean;
  /** 开放 API 来源 IP/CIDR 白名单；空数组表示不限制 */
  ipAllowlist: string[];
  environment: 'production' | 'sandbox';
  reviewStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  reviewComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: number | null;
  previousSecretExpiresAt?: string | null;
  status: 'enabled' | 'disabled';
  ownerId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 创建应用时一次性返回，包含明文 secret */
export interface OAuth2ClientCreated extends OAuth2Client {
  clientSecret: string;
}

export interface OAuth2Token {
  id: number;
  tokenType: 'access' | 'refresh';
  tokenPrefix?: string | null;
  clientId: string;
  userId?: number | null;
  scopes: string[];
  expiresAt?: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface OAuth2UserGrant {
  id: number;
  userId: number;
  username: string | null;
  nickname: string | null;
  clientId: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

/** 「我的已授权应用」条目（用户视角） */
export interface OAuth2MyGrant {
  id: number;
  clientId: string;
  appName: string;
  appLogoUrl: string | null;
  appDescription: string | null;
  environment: 'production' | 'sandbox';
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── 开放平台 / 开发者门户 ────────────────────────────────────────────────────

/** API Scope 注册表项 */
export interface ApiScope {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  scopeGroup: string;
  status: 'enabled' | 'disabled';
  /** 引用该 scope 的应用数量，> 0 时不可删除 */
  usedByAppCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 限流套餐（Rate Plan / Tier） */
export interface RatePlan {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  /** 每秒请求上限（QPS），0=不限 */
  qpsLimit: number;
  /** 每日调用配额，0=不限 */
  dailyQuota: number;
  /** 每月调用配额，0=不限 */
  monthlyQuota: number;
  isDefault: boolean;
  status: 'enabled' | 'disabled';
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 开放 API 调用日志 */
export interface OpenApiCallLog {
  id: number;
  clientId: string;
  appName?: string | null;
  method: string;
  path: string;
  statusCode: number;
  success: boolean;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  scope?: string | null;
  /** 鉴权通道：bearer = OAuth2 令牌；signature = AppKey + HMAC */
  authChannel?: 'bearer' | 'signature' | null;
  /** 用户授权令牌对应的用户；client_credentials 与签名通道为空 */
  userId?: number | null;
  errorMessage?: string | null;
  requestId?: string | null;
  environment: 'production' | 'sandbox';
  createdAt: string;
}

export interface OpenAppQuotaUsageItem {
  used: number;
  limit: number;
  percentage: number;
}

export interface OpenAppQuotaUsage {
  clientId: string;
  environment: 'production' | 'sandbox';
  planCode: string | null;
  planName: string | null;
  qps: OpenAppQuotaUsageItem;
  daily: OpenAppQuotaUsageItem;
  monthly: OpenAppQuotaUsageItem;
}

export interface OpenApiDebugResult {
  requestUrl: string;
  method: string;
  requestHeaders: Record<string, string>;
  stringToSign?: string;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody: string;
  durationMs: number;
}

/** 可调试的开放 API 端点目录条目 */
export interface OpenApiDebugEndpoint {
  method: string;
  path: string;
  summary: string;
  scope: string | null;
}

/** 调用统计总览 */
export interface OpenApiStatsOverview {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgDurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  percentilesPartial: boolean;
  percentileRetentionDays: number;
  activeApps: number;
  todayCalls: number;
}

/** 调用趋势点（按小时/天聚合） */
export interface OpenApiStatsTrendPoint {
  time: string;
  total: number;
  success: number;
  failed: number;
}

/** 按应用/端点聚合统计项 */
export interface OpenApiStatsGroupItem {
  key: string;
  label: string;
  total: number;
  success: number;
  failed: number;
  avgDurationMs: number;
}

/** 签名验签结果 */
export interface OpenSignatureResult {
  signature: string;
  stringToSign: string;
  matched?: boolean;
}

/** 应用级 Webhook 订阅 */
export interface AppWebhookSubscription {
  id: number;
  clientId: string;
  name: string;
  url: string;
  signMode: 'hmacSha256' | 'none';
  events: string[];
  headers?: Record<string, string> | null;
  status: 'enabled' | 'disabled';
  /** 是否已配置签名密钥 */
  hasSecret: boolean;
  /** 密钥掩码（仅展示前后各 4 位） */
  secretMasked?: string | null;
  lastDeliveryAt?: string | null;
  consecutiveFailures: number;
  autoDisabledAt?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 创建/重置时一次性返回明文 secret */
export interface AppWebhookSubscriptionCreated extends AppWebhookSubscription {
  secret: string;
}

/** Webhook 投递记录 */
export interface AppWebhookDelivery {
  id: number;
  subscriptionId: number;
  clientId: string;
  eventType: string;
  eventId: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempt: number;
  requestUrl?: string | null;
  responseStatus?: number | null;
  responseBody?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  nextRetryAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

/** 事件类型元数据（供订阅界面选择） */
export interface OpenWebhookEventMeta {
  code: string;
  label: string;
}

/** /api/oauth2/token 响应体（标准 OAuth2 格式）*/
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/** /api/oauth2/userinfo 响应体 */
export interface OAuth2UserInfo {
  sub: string;
  name?: string;
  nickname?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
}

/** /api/oauth2/token/introspect 响应体 */
export interface OAuth2IntrospectResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  token_type?: string;
}

/** 前端 /oauth2/authorize 页面所需的应用信息 */
export interface OAuth2AuthorizeInfo {
  clientId: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  requestedScopes: string[];
  /** 每个申请 scope 的展示信息（取自 API Scope 表） */
  scopeDetails: Array<{
    code: string;
    name: string;
    description: string | null;
    granted: boolean;
  }>;
  alreadyGranted: boolean;
  /** 授权端点是否强制 PKCE */
  requiresPkce: boolean;
}
