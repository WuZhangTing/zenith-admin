import 'dotenv/config';
import * as z from 'zod';

// ─── HTTP Log Types ──────────────────────────────────────────────────────────────────────────────

export type HttpLogLevel = 'off' | 'access' | 'headers' | 'body' | 'full';
export type HttpLogFormat = 'text' | 'json' | 'curl';
export type HttpLogMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

const httpLogLevelEnum = z.enum(['off', 'access', 'headers', 'body', 'full']);
const httpLogFormatEnum = z.enum(['text', 'json', 'curl']);
// 布尔环境变量：基于 z.stringbool（'true'/'1'/'yes'/'on' → true，'false'/'0'/'no'/'off' → false，
// 大小写不敏感）；空串与缺省回落默认值；其余取值启动即报错（fail-fast，拼写错误不再被静默当 false）
const envBool = (def: boolean) => z.preprocess((v) => (v === '' ? undefined : v), z.stringbool().default(def));

// ─── Env Schema ───────────────────────────────────────────────────────────────────────────────────

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3300),
  JWT_SECRET: z.string().min(1).default('zenith-admin-secret'),
  /** 对外可访问的服务基地址，用于邮件退订链接等出站 URL 拼接 */
  PUBLIC_BASE_URL: z.string().default('http://localhost:3300'),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/zenith_admin'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(10),
  DATABASE_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
  DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: envBool(false),
  /** psql 可执行文件路径；留空时按 PATH 查找，用于数据库管理页的 psql 终端 */
  PSQL_PATH: z.string().default(''),
  MULTI_TENANT_MODE: envBool(false),
  /** License 执行模式：off = 不检查（默认，开发/演示零感知）；warn = 全功能可用但记录并提示；required = 强制校验 */
  LICENSE_MODE: z.enum(['off', 'warn', 'required']).default('off'),
  /** License 验签公钥（base64 SPKI DER，Ed25519）。留空时使用内置测试公钥（仅限非生产评估） */
  LICENSE_ISSUER_PUBLIC_KEY: z.string().default(''),
  SERVER_TIMING_ENABLED: envBool(false),
  REQUEST_BODY_LIMIT: z.coerce.number().int().min(0).default(0),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(0).default(0),
  ALLOWED_ORIGINS: z.string().default(''),
  TRUSTED_PROXY_CIDRS: z.string().default(''),
  REPORT_OUTBOUND_PRIVATE_ALLOWLIST: z.string().default(''),
  /** AI 出站请求（LLM/embeddings 网关）SSRF 内网允许清单；默认放行本机以兼容 Ollama 等本地网关 */
  AI_OUTBOUND_PRIVATE_ALLOWLIST: z.string().default('127.0.0.1,localhost'),
  /** 开发环境放开 /api/mastra 鉴权(Studio 免贴 token);NODE_ENV=production 时强制忽略 */
  MASTRA_STUDIO_ALLOW_ANONYMOUS: z.enum(['true', 'false']).default('false'),
  REPORT_PDF_FONT_PATH: z.string().default(''),
  REPORT_SLOW_QUERY_MS: z.coerce.number().int().min(1).default(3000),
  REPORT_DASHBOARD_MAX_CONCURRENT: z.coerce.number().int().min(1).max(20).default(5),
  REPORT_DATASET_MAX_ROWS: z.coerce.number().int().min(1).max(50000).default(5000),
  REPORT_DATASET_MAX_BYTES: z.coerce.number().int().min(1024).max(50 * 1024 * 1024).default(2 * 1024 * 1024),
  REPORT_CHATBI_USER_DAILY_TOKENS: z.coerce.number().int().min(1000).default(200_000),
  REPORT_CHATBI_TENANT_DAILY_TOKENS: z.coerce.number().int().min(1000).default(2_000_000),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_KEY_PREFIX: z.string().default('zenith:'),
  OPEN_RATE_LIMIT_FAIL_CLOSED: envBool(true),
  OPEN_WEBHOOK_AUTO_DISABLE_FAILURES: z.coerce.number().int().min(1).max(100).default(5),
  OPEN_SECRET_ROTATION_GRACE_HOURS: z.coerce.number().int().min(1).max(720).default(24),
  OPEN_GATEWAY_REQUIRE_APPROVAL: envBool(true),
  /** Webhook 回调允许的私网/本机主机（逗号分隔，支持 host、*.suffix、CIDR）。开发环境用于本地联调 */
  OPEN_WEBHOOK_ALLOWED_HOSTS: z.string().default(''),
  OPEN_API_INTERNAL_BASE_URL: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_DIR: z.string().default('logs'),
  /** 轮转日志文件保留份数（按天轮转，1 份 = 1 天） */
  LOG_MAX_FILES: z.coerce.number().int().min(1).default(30),
  /** 控制台输出 pino-pretty 彩色单行（本地开发用）；默认 NDJSON。日志文件不受影响，始终 NDJSON */
  LOG_CONSOLE_PRETTY: envBool(false),
  // HTTP 入站日志
  HTTP_LOG_INCOMING_ENABLED: envBool(false),
  HTTP_LOG_INCOMING_LEVEL: httpLogLevelEnum.default('access'),
  HTTP_LOG_INCOMING_FORMAT: httpLogFormatEnum.default('json'),
  HTTP_LOG_INCOMING_MAX_BODY: z.coerce.number().int().min(0).default(65536),
  HTTP_LOG_INCOMING_RESPONSE_BODY: envBool(false),
  HTTP_LOG_INCOMING_EXCLUDE: z.string().default(''),
  HTTP_LOG_INCOMING_FILE: envBool(false),
  HTTP_LOG_INCOMING_METHOD_GET: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_POST: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_PUT: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_PATCH: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_DELETE: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_OPTIONS: httpLogLevelEnum.optional(),
  HTTP_LOG_INCOMING_METHOD_HEAD: httpLogLevelEnum.optional(),
  // HTTP 出站日志
  HTTP_LOG_OUTGOING_ENABLED: envBool(false),
  HTTP_LOG_OUTGOING_LEVEL: httpLogLevelEnum.default('full'),
  HTTP_LOG_OUTGOING_FORMAT: httpLogFormatEnum.default('json'),
  HTTP_LOG_OUTGOING_MAX_BODY: z.coerce.number().int().min(0).default(4096),
  HTTP_LOG_OUTGOING_RESPONSE_BODY: envBool(true),
  HTTP_LOG_OUTGOING_FILE: envBool(false),
  HTTP_LOG_OUTGOING_METHOD_GET: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_POST: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_PUT: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_PATCH: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_DELETE: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_OPTIONS: httpLogLevelEnum.optional(),
  HTTP_LOG_OUTGOING_METHOD_HEAD: httpLogLevelEnum.optional(),
  // OpenTelemetry
  OTEL_ENABLED: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('zenith-admin-server'),
  OTEL_SERVICE_VERSION: z.string().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  // OAuth
  OAUTH_GITHUB_CLIENT_ID: z.string().default(''),
  OAUTH_GITHUB_CLIENT_SECRET: z.string().default(''),
  OAUTH_DINGTALK_CLIENT_ID: z.string().default(''),
  OAUTH_DINGTALK_CLIENT_SECRET: z.string().default(''),
  OAUTH_WECHAT_WORK_CORP_ID: z.string().default(''),
  OAUTH_WECHAT_WORK_AGENT_ID: z.string().default(''),
  OAUTH_WECHAT_WORK_SECRET: z.string().default(''),
  OAUTH_CALLBACK_BASE_URL: z.string().default('http://localhost:5373'),
  SAML_ACS_BASE_URL: z.string().default(''),
  // WebRTC 音视频通话 ICE 服务器配置
  WEBRTC_STUN_URLS: z.string().default('stun:stun.l.google.com:19302'),
  WEBRTC_TURN_URLS: z.string().default(''),
  WEBRTC_TURN_USERNAME: z.string().default(''),
  WEBRTC_TURN_CREDENTIAL: z.string().default(''),
  // npm 运行时自动注入
  npm_package_version: z.string().optional(),
}).loose(); // 允许其他未声明的环境变量透传（如 NODE_APP_INSTANCE）

// ─── Parse & Validate ──────────────────────────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.');
    console.error(`  ${path}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// ─── HTTP 日志方法覆盖辅助 ───────────────────────────────────────────────────────────────────────────

function buildMethodOverrides(prefix: 'HTTP_LOG_INCOMING_METHOD' | 'HTTP_LOG_OUTGOING_METHOD'): Partial<Record<HttpLogMethod, HttpLogLevel>> {
  const methods: HttpLogMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
  const result: Partial<Record<HttpLogMethod, HttpLogLevel>> = {};
  for (const m of methods) {
    const val = env[`${prefix}_${m}`];
    if (val) result[m] = val;
  }
  return result;
}

// ─── HTTP Log Types ───────────────────────────────────────────────────────────

/**
 * HTTP 日志记录级别（从低到高）：
 * - off:     不记录任何内容
 * - access:  仅记录方法/URL/状态码/耗时（最轻量，无 body 开销）
 * - headers: access + 请求/响应 Headers
 * - body:    access + 请求/响应 Body（不含 Headers）
 * - full:    全量：access + Headers + Body（对标 Logbook 默认模式）
 */

// ─── Config Object ────────────────────────────────────────────────────────────

export const config = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ''),
  databaseUrl: env.DATABASE_URL,
  corsOrigin: env.CORS_ORIGIN,
  database: {
    maxConnections: env.DATABASE_MAX_CONNECTIONS,
    idleTimeoutSeconds: env.DATABASE_IDLE_TIMEOUT_SECONDS,
    connectTimeoutSeconds: env.DATABASE_CONNECT_TIMEOUT_SECONDS,
    ssl: env.DATABASE_SSL,
  },
  /** 数据库管理页 psql 终端：可执行文件路径覆盖（留空按 PATH 查找） */
  psqlPath: env.PSQL_PATH || undefined,
  multiTenantMode: env.MULTI_TENANT_MODE,
  licenseMode: env.LICENSE_MODE,
  licenseIssuerPublicKey: env.LICENSE_ISSUER_PUBLIC_KEY,
  serverTimingEnabled: env.SERVER_TIMING_ENABLED,
  requestBodyLimit: env.REQUEST_BODY_LIMIT,
  requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
  trustedProxyCidrs: env.TRUSTED_PROXY_CIDRS.split(',').map(s => s.trim()).filter(Boolean),
  ai: {
    /** AI 出站请求 SSRF 内网允许清单（LLM / embeddings 网关地址） */
    outboundPrivateAllowlist: env.AI_OUTBOUND_PRIVATE_ALLOWLIST.split(',').map(s => s.trim()).filter(Boolean),
    /** 开发环境放开 /api/mastra 鉴权;生产(NODE_ENV=production)强制忽略 */
    mastraStudioAllowAnonymous: env.MASTRA_STUDIO_ALLOW_ANONYMOUS === 'true' && process.env.NODE_ENV !== 'production',
  },
  report: {
    outboundPrivateAllowlist: env.REPORT_OUTBOUND_PRIVATE_ALLOWLIST.split(',').map(s => s.trim()).filter(Boolean),
    pdfFontPath: env.REPORT_PDF_FONT_PATH || undefined,
    slowQueryMs: env.REPORT_SLOW_QUERY_MS,
    dashboardMaxConcurrent: env.REPORT_DASHBOARD_MAX_CONCURRENT,
    datasetMaxRows: env.REPORT_DATASET_MAX_ROWS,
    datasetMaxBytes: env.REPORT_DATASET_MAX_BYTES,
    chatbiUserDailyTokens: env.REPORT_CHATBI_USER_DAILY_TOKENS,
    chatbiTenantDailyTokens: env.REPORT_CHATBI_TENANT_DAILY_TOKENS,
  },
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD ?? undefined,
    db: env.REDIS_DB,
    keyPrefix: env.REDIS_KEY_PREFIX,
  },
  openPlatform: {
    rateLimitFailClosed: env.OPEN_RATE_LIMIT_FAIL_CLOSED,
    webhookAutoDisableFailures: env.OPEN_WEBHOOK_AUTO_DISABLE_FAILURES,
    secretRotationGraceHours: env.OPEN_SECRET_ROTATION_GRACE_HOURS,
    gatewayRequireApproval: env.OPEN_GATEWAY_REQUIRE_APPROVAL,
    webhookAllowedHosts: env.OPEN_WEBHOOK_ALLOWED_HOSTS.split(',').map((s) => s.trim()).filter(Boolean),
    internalBaseUrl: env.OPEN_API_INTERNAL_BASE_URL || `http://127.0.0.1:${env.PORT}`,
  },
  log: {
    level: env.LOG_LEVEL,
    dir: env.LOG_DIR,
    maxFiles: env.LOG_MAX_FILES,
    pretty: env.LOG_CONSOLE_PRETTY,
  },
  httpLog: {
    incoming: {
      enabled: env.HTTP_LOG_INCOMING_ENABLED,
      level: env.HTTP_LOG_INCOMING_LEVEL,
      methods: buildMethodOverrides('HTTP_LOG_INCOMING_METHOD'),
      format: env.HTTP_LOG_INCOMING_FORMAT,
      maxBodyBytes: env.HTTP_LOG_INCOMING_MAX_BODY,
      logResponseBody: env.HTTP_LOG_INCOMING_RESPONSE_BODY,
      excludePaths: env.HTTP_LOG_INCOMING_EXCLUDE.split(',').map(s => s.trim()).filter(Boolean),
      separateFile: env.HTTP_LOG_INCOMING_FILE,
    },
    outgoing: {
      enabled: env.HTTP_LOG_OUTGOING_ENABLED,
      level: env.HTTP_LOG_OUTGOING_LEVEL,
      methods: buildMethodOverrides('HTTP_LOG_OUTGOING_METHOD'),
      format: env.HTTP_LOG_OUTGOING_FORMAT,
      maxBodyBytes: env.HTTP_LOG_OUTGOING_MAX_BODY,
      logResponseBody: env.HTTP_LOG_OUTGOING_RESPONSE_BODY,
      separateFile: env.HTTP_LOG_OUTGOING_FILE,
    },
  },
  otel: {
    enabled: env.OTEL_ENABLED === 'true' || (
      env.OTEL_ENABLED !== 'false' &&
      Boolean(env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || env.OTEL_EXPORTER_OTLP_ENDPOINT)
    ),
    serviceName: env.OTEL_SERVICE_NAME,
    serviceVersion: env.OTEL_SERVICE_VERSION ?? env.npm_package_version ?? 'unknown',
  },
  oauth: {
    github: {
      clientId: env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: env.OAUTH_GITHUB_CLIENT_SECRET,
    },
    dingtalk: {
      clientId: env.OAUTH_DINGTALK_CLIENT_ID,
      clientSecret: env.OAUTH_DINGTALK_CLIENT_SECRET,
    },
    wechatWork: {
      corpId: env.OAUTH_WECHAT_WORK_CORP_ID,
      agentId: env.OAUTH_WECHAT_WORK_AGENT_ID,
      secret: env.OAUTH_WECHAT_WORK_SECRET,
    },
    callbackBaseUrl: env.OAUTH_CALLBACK_BASE_URL,
    samlAcsBaseUrl: env.SAML_ACS_BASE_URL || `http://localhost:${env.PORT}`,
  },
  webrtc: {
    stunUrls: env.WEBRTC_STUN_URLS.split(',').map((s) => s.trim()).filter(Boolean),
    turnUrls: env.WEBRTC_TURN_URLS.split(',').map((s) => s.trim()).filter(Boolean),
    turnUsername: env.WEBRTC_TURN_USERNAME,
    turnCredential: env.WEBRTC_TURN_CREDENTIAL,
  },
};
