import * as z from 'zod';
import { partialForUpdate, webhookUrlSchema } from '../core/validation';
import { CONFIG_TYPES, FILE_OBJECT_ACL_SUPPORT, MONITOR_ALERT_EVENT_STATUSES, MONITOR_ALERT_HANDLE_STATUSES, MONITOR_ALERT_LEVELS, MONITOR_ALERT_NOTIFY_STATUSES, MONITOR_ALERT_OVERVIEW_RANGES, MONITOR_METRICS, PRESIGNED_EXPIRY_DEFAULT_SECONDS, PRESIGNED_EXPIRY_MAX_SECONDS, PRESIGNED_EXPIRY_MIN_SECONDS } from './constants';

// ─── 字典 Schema ──────────────────────────────────────────────────────────────
export const createDictSchema = z.object({
  name: z.string().min(1, '字典名称不能为空').max(64),
  code: z.string().min(1, '字典编码不能为空').max(64).regex(/^[a-z_]+$/, '字典编码只能包含小写字母和下划线'),
  description: z.string().max(256).optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateDictSchema = partialForUpdate(createDictSchema);

export const createDictItemSchema = z.object({
  label: z.string().min(1, '标签不能为空').max(64),
  value: z.string().min(1, '键值不能为空').max(64),
  color: z.string().max(32).nullish(),
  sort: z.number().int().default(0),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).nullish(),
  parentId: z.number().int().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateDictItemSchema = partialForUpdate(createDictItemSchema);

// ─── 文件管理 Schema ─────────────────────────────────────────────────────────
const baseFileStorageConfigSchema = z.object({
  name: z.string().min(1, '配置名称不能为空').max(64),
  provider: z.enum(['local', 'oss', 's3', 'cos', 'obs', 'kodo', 'bos', 'azure', 'sftp']),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  isDefault: z.boolean().default(false),
  basePath: z.string().max(256).optional(),
  // 对象读写权限（仅 oss/s3/cos/obs/bos 生效）；default = 继承 Bucket
  objectAcl: z.enum(['default', 'private', 'public-read', 'public-read-write']).default('default'),
  // 文件访问 URL 策略
  urlStrategy: z.enum(['proxy', 'public', 'presigned']).default('proxy'),
  // 自定义访问域名（CDN/加速域名），public 策略优先使用
  publicBaseUrl: z.string().max(512).regex(/^https?:\/\/.+/, '访问域名必须以 http:// 或 https:// 开头').optional().or(z.literal('')),
  // 临时签名有效期（秒）
  presignedExpirySeconds: z.number().int()
    .min(PRESIGNED_EXPIRY_MIN_SECONDS, `签名有效期不能小于 ${PRESIGNED_EXPIRY_MIN_SECONDS} 秒`)
    .max(PRESIGNED_EXPIRY_MAX_SECONDS, `签名有效期不能大于 ${PRESIGNED_EXPIRY_MAX_SECONDS} 秒（7 天）`)
    .default(PRESIGNED_EXPIRY_DEFAULT_SECONDS),
  // 本地存储
  localRootPath: z.string().max(512).optional(),
  // 阿里云 OSS
  ossRegion: z.string().max(64).optional(),
  ossEndpoint: z.string().max(128).optional(),
  ossBucket: z.string().max(128).optional(),
  ossAccessKeyId: z.string().max(128).optional(),
  ossAccessKeySecret: z.string().max(256).optional(),
  // S3 兼容存储
  s3Region: z.string().max(64).optional(),
  s3Endpoint: z.string().max(256).optional(),
  s3Bucket: z.string().max(128).optional(),
  s3AccessKeyId: z.string().max(128).optional(),
  s3SecretAccessKey: z.string().max(256).optional(),
  s3ForcePathStyle: z.boolean().optional(),
  // 腾讯云 COS
  cosRegion: z.string().max(64).optional(),
  cosBucket: z.string().max(128).optional(),
  cosSecretId: z.string().max(128).optional(),
  cosSecretKey: z.string().max(256).optional(),
  // 华为云 OBS
  obsEndpoint: z.string().max(256).optional(),
  obsBucket: z.string().max(128).optional(),
  obsAccessKeyId: z.string().max(128).optional(),
  obsSecretAccessKey: z.string().max(256).optional(),
  // 七牛云 Kodo
  kodoAccessKey: z.string().max(128).optional(),
  kodoSecretKey: z.string().max(256).optional(),
  kodoBucket: z.string().max(128).optional(),
  kodoRegion: z.string().max(64).optional(),
  kodoEndpoint: z.string().max(256).optional(),
  // 百度云 BOS
  bosEndpoint: z.string().max(256).optional(),
  bosBucket: z.string().max(128).optional(),
  bosAccessKeyId: z.string().max(128).optional(),
  bosSecretAccessKey: z.string().max(256).optional(),
  // Azure Blob Storage
  azureAccountName: z.string().max(128).optional(),
  azureAccountKey: z.string().max(256).optional(),
  azureContainerName: z.string().max(128).optional(),
  azureEndpoint: z.string().max(256).optional(),
  // SFTP
  sftpHost: z.string().max(256).optional(),
  sftpPort: z.number().int().min(1).max(65535).optional(),
  sftpUsername: z.string().max(128).optional(),
  sftpPassword: z.string().max(256).optional(),
  sftpPrivateKey: z.string().optional(),
  sftpRootPath: z.string().max(512).optional(),
  sftpBaseUrl: z.string().max(512).optional(),
  remark: z.string().max(256).optional(),
});

type FileStorageConfigBase = z.infer<typeof baseFileStorageConfigSchema>;

/** URL 策略与 provider/ACL 的矛盾校验；create 全量、update partial 双方共用（partial 时缺失字段跳过对应检查） */
function addUrlStrategyIssues(data: Partial<FileStorageConfigBase>, ctx: z.RefinementCtx) {
  if (!data.urlStrategy || !data.provider) return;
  const supportedAcls = FILE_OBJECT_ACL_SUPPORT[data.provider];
  if (data.urlStrategy === 'presigned' && (data.provider === 'local' || data.provider === 'sftp')) {
    ctx.addIssue({ code: 'custom', message: '本地磁盘 / SFTP 不支持临时签名直链，请选择服务端代理或公开直链', path: ['urlStrategy'] });
  }
  if (data.urlStrategy === 'public') {
    if (supportedAcls && !['public-read', 'public-read-write'].includes(data.objectAcl ?? 'default')) {
      ctx.addIssue({ code: 'custom', message: '公开直链要求对象读写权限为 public-read 或 public-read-write', path: ['objectAcl'] });
    }
    if (data.provider === 'local' && !data.publicBaseUrl) {
      ctx.addIssue({ code: 'custom', message: '本地磁盘使用公开直链需要配置访问域名', path: ['publicBaseUrl'] });
    }
    if (data.provider === 'sftp' && !data.publicBaseUrl && !data.sftpBaseUrl) {
      ctx.addIssue({ code: 'custom', message: 'SFTP 使用公开直链需要配置访问域名或 SFTP 访问地址', path: ['publicBaseUrl'] });
    }
    if (data.provider === 'kodo' && !data.publicBaseUrl && !data.kodoEndpoint) {
      ctx.addIssue({ code: 'custom', message: '七牛云 Kodo 使用公开直链需要配置访问域名或下载域名', path: ['publicBaseUrl'] });
    }
  }
}

export const createFileStorageConfigSchema = baseFileStorageConfigSchema.superRefine((data, ctx) => {
  const supportedAcls = FILE_OBJECT_ACL_SUPPORT[data.provider];
  if (data.objectAcl !== 'default' && !(supportedAcls ?? []).includes(data.objectAcl)) {
    const message = supportedAcls
      ? `该存储类型的对象读写权限仅支持：${supportedAcls.join(' / ')}`
      : '该存储类型不支持设置对象读写权限';
    ctx.addIssue({ code: 'custom', message, path: ['objectAcl'] });
  }
  addUrlStrategyIssues(data, ctx);
  if (data.provider === 'local' && !data.localRootPath) {
    ctx.addIssue({ code: 'custom', message: '本地磁盘配置需要填写存储目录', path: ['localRootPath'] });
  }
  if (data.provider === 'oss') {
    const requiredFields: Array<keyof typeof data> = ['ossRegion', 'ossEndpoint', 'ossBucket', 'ossAccessKeyId', 'ossAccessKeySecret'];
    for (const field of requiredFields) {
      if (!data[field]) {
        ctx.addIssue({ code: 'custom', message: 'OSS 配置项不能为空', path: [field] });
      }
    }
  }
  if (data.provider === 's3') {
    const requiredFields: Array<keyof typeof data> = ['s3Region', 's3Bucket', 's3AccessKeyId', 's3SecretAccessKey'];
    for (const field of requiredFields) {
      if (!data[field]) {
        ctx.addIssue({ code: 'custom', message: 'S3 配置项不能 为空', path: [field] });
      }
    }
  }
  if (data.provider === 'cos') {
    const requiredFields: Array<keyof typeof data> = ['cosRegion', 'cosBucket', 'cosSecretId', 'cosSecretKey'];
    for (const field of requiredFields) {
      if (!data[field]) {
        ctx.addIssue({ code: 'custom', message: '腾讯云 COS 配 置项不能为空', path: [field] });
      }
    }
  }
  if (data.provider === 'obs') {
    const requiredFields: Array<keyof typeof data> = ['obsEndpoint', 'obsBucket', 'obsAccessKeyId', 'obsSecretAccessKey'];
    for (const field of requiredFields) {
      if (!data[field]) ctx.addIssue({ code: 'custom', message: '华为云 OBS 配置项不能为空', path: [field] });
    }
  }
  if (data.provider === 'kodo') {
    const requiredFields: Array<keyof typeof data> = ['kodoAccessKey', 'kodoSecretKey', 'kodoBucket'];
    for (const field of requiredFields) {
      if (!data[field]) ctx.addIssue({ code: 'custom', message: '七牛云 Kodo 配置项不能为空', path: [field] });
    }
  }
  if (data.provider === 'bos') {
    const requiredFields: Array<keyof typeof data> = ['bosEndpoint', 'bosBucket', 'bosAccessKeyId', 'bosSecretAccessKey'];
    for (const field of requiredFields) {
      if (!data[field]) ctx.addIssue({ code: 'custom', message: '百度云 BOS 配置项不能为空', path: [field] });
    }
  }
  if (data.provider === 'azure') {
    const requiredFields: Array<keyof typeof data> = ['azureAccountName', 'azureAccountKey', 'azureContainerName'];
    for (const field of requiredFields) {
      if (!data[field]) ctx.addIssue({ code: 'custom', message: 'Azure Blob 配置项不能为空', path: [field] });
    }
  }
  if (data.provider === 'sftp') {
    const requiredFields: Array<keyof typeof data> = ['sftpHost', 'sftpUsername'];
    for (const field of requiredFields) {
      if (!data[field]) ctx.addIssue({ code: 'custom', message: 'SFTP 配置项不能为空', path: [field] });
    }
  }
});

export const updateFileStorageConfigSchema = partialForUpdate(baseFileStorageConfigSchema).superRefine(addUrlStrategyIssues);

// ─── 分片上传 ─────────────────────────────────────────────────────────────────
export const initChunkUploadSchema = z.object({
  fileName: z.string().min(1, '文件名不能为空').max(256),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string().max(128).optional(),
  chunkSize: z.number().int().positive().max(100 * 1024 * 1024),
});

export const completeChunkUploadSchema = z.object({
  uploadId: z.string().min(1).max(64),
});

export type InitChunkUploadInput = z.infer<typeof initChunkUploadSchema>;

export type CompleteChunkUploadInput = z.infer<typeof completeChunkUploadSchema>;

export type CreateDictInput = z.infer<typeof createDictSchema>;

export type UpdateDictInput = z.infer<typeof updateDictSchema>;

export type CreateDictItemInput = z.infer<typeof createDictItemSchema>;

export type UpdateDictItemInput = z.infer<typeof updateDictItemSchema>;

export type CreateFileStorageConfigInput = z.infer<typeof createFileStorageConfigSchema>;

export type UpdateFileStorageConfigInput = z.infer<typeof updateFileStorageConfigSchema>;

// ─── 系统参数配置 Schema ─────────────────────────────────────────────────────
export const createSystemConfigSchema = z.object({
  configKey: z.string().min(1, '键名不能为空').max(128).regex(/^[\w.:]+$/, '键名只能包含字母、数字、下划线、点号和冒号'),
  configName: z.string().min(1, '配置名称不能为空').max(128),
  configValue: z.string().max(4096),
  configType: z.enum(CONFIG_TYPES).default('string'),
  description: z.string().max(256).default(''),
});

export const updateSystemConfigSchema = partialForUpdate(createSystemConfigSchema);

export type CreateSystemConfigInput = z.infer<typeof createSystemConfigSchema>;

export type UpdateSystemConfigInput = z.infer<typeof updateSystemConfigSchema>;

// ─── 定时任务 Schema ────────────────────────────────────────────────────────
export const createCronJobSchema = z.object({
  name: z.string().min(1, '任务名称不能为空').max(64),
  cronExpression: z.string().min(1, 'Cron 表达式不能为空').max(128),
  handler: z.string().min(1, '处理器不能为空').max(128),
  params: z.string().max(4096).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).default('disabled'),
  description: z.string().max(256).default(''),
  retryCount: z.number().int().min(0, '重试次数不能为负').max(10).default(0),
  /** 重试间隔，单位：秒 */
  retryInterval: z.number().int().min(0, '重试间隔不能为负').default(0),
  retryBackoff: z.boolean().default(false),
  monitorTimeout: z.number().int().min(0).nullable().optional(),
});

export const updateCronJobSchema = partialForUpdate(createCronJobSchema);

export type CreateCronJobInput = z.infer<typeof createCronJobSchema>;

export type UpdateCronJobInput = z.infer<typeof updateCronJobSchema>;

// ─── 地区管理 Schema ───────────────────────────────────────────────────────────
export const createRegionSchema = z.object({
  code:       z.string().min(1, '区划代码不能为空').max(12),
  name:       z.string().min(1, '名称不能为空').max(64),
  level:      z.enum(['province', 'city', 'county']),
  parentCode: z.string().max(12).nullable().optional(),
  sort:       z.coerce.number().int().default(0),
  status:     z.enum(['enabled', 'disabled']).default('enabled'),
});

export const updateRegionSchema = partialForUpdate(createRegionSchema);

export type CreateRegionInput = z.infer<typeof createRegionSchema>;

export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;

// ─── 数据库备份 Schema ─────────────────────────────────────────────────────
export const createBackupSchema = z.object({
  type: z.enum(['pg_dump', 'drizzle_export']),
  name: z.string().min(1, '备份名称不能为空').max(128).optional(),
});

export type CreateBackupInput = z.infer<typeof createBackupSchema>;

// ─── 标签管理 Schema ─────────────────────────────────────────────────────────
export const createTagSchema = z.object({
  name:        z.string().min(1, '标签名称不能为空').max(50),
  color:       z.string().max(20).optional(),
  groupName:   z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  status:      z.enum(['enabled', 'disabled']).default('enabled'),
  sortOrder:   z.number().int().default(0),
});

export const updateTagSchema = partialForUpdate(createTagSchema);

export type CreateTagInput = z.infer<typeof createTagSchema>;

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// ─── AI 分享 / 知识库 Schema ──────────────────────────────────────────────────

// ─── 数据脱敏配置 Schema ──────────────────────────────────────────────────────

export const maskTypeValues = ['phone', 'email', 'id_card', 'name', 'bank_card', 'custom'] as const;

export const customMaskRuleSchema = z.object({
  prefixKeep: z.number().int().min(0).max(20),
  suffixKeep: z.number().int().min(0).max(20),
  maskChar:   z.string().max(1).optional(),
});

export const createDataMaskConfigSchema = z.object({
  entity:          z.string().min(1, '实体名称不能为空').max(64),
  field:           z.string().min(1, '字段名称不能为空').max(64),
  label:           z.string().min(1, '字段标签不能为空').max(64),
  maskType:        z.enum(maskTypeValues),
  customRule:      customMaskRuleSchema.nullable().optional(),
  exemptRoleCodes: z.array(z.string().max(64)).default([]),
  enabled:         z.boolean().default(true),
  remark:          z.string().max(256).optional(),
});

export const updateDataMaskConfigSchema = partialForUpdate(createDataMaskConfigSchema);

export type CreateDataMaskConfigInput = z.infer<typeof createDataMaskConfigSchema>;

export type UpdateDataMaskConfigInput = z.infer<typeof updateDataMaskConfigSchema>;

// ─── 系统监控告警规则 ─────────────────────────────────────────────────────────
// 指标全集是 constants.ts 的 MONITOR_METRICS（枚举 SSOT），此处只做引用

const monitorAlertRuleBaseSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(128),
  metric: z.enum(MONITOR_METRICS),
  operator: z.enum(['gt', 'gte', 'lt', 'lte']).default('gt'),
  threshold: z.number(),
  durationMinutes: z.number().int().min(0).max(1440).default(0),
  level: z.enum(['info', 'warning', 'critical']).default('warning'),
  channels: z.array(z.enum(['email', 'webhook', 'inapp'])).default([]),
  webhookUrl: webhookUrlSchema.nullable().optional(),
  recipientUserIds: z.array(z.number().int().positive()).max(100).default([]),
  recipientEmails: z.array(z.email('邮箱格式不正确').max(254)).max(50).default([]),
  silenceMinutes: z.number().int().min(0).max(10_080).default(30),
  enabled: z.boolean().default(true),
});

function validateMonitorAlertDelivery(
  value: {
    enabled?: boolean;
    channels?: string[];
    webhookUrl?: string | null;
    recipientUserIds?: number[];
    recipientEmails?: string[];
  },
  ctx: z.RefinementCtx,
) {
  if (value.enabled === false) return;
  const channels = value.channels ?? [];
  if (channels.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['channels'], message: '启用告警时至少选择一个通知渠道' });
  }
  if (channels.includes('webhook') && !value.webhookUrl) {
    ctx.addIssue({ code: 'custom', path: ['webhookUrl'], message: 'Webhook 渠道必须配置有效 URL' });
  }
  if (channels.includes('inapp') && !(value.recipientUserIds?.length)) {
    ctx.addIssue({ code: 'custom', path: ['recipientUserIds'], message: '站内信渠道必须选择接收用户' });
  }
  if (
    channels.includes('email')
    && !(value.recipientUserIds?.length)
    && !(value.recipientEmails?.length)
  ) {
    ctx.addIssue({ code: 'custom', path: ['recipientEmails'], message: '邮件渠道必须选择接收用户或填写额外邮箱' });
  }
}

export const createMonitorAlertRuleSchema = monitorAlertRuleBaseSchema.superRefine(validateMonitorAlertDelivery);

export const updateMonitorAlertRuleSchema = partialForUpdate(monitorAlertRuleBaseSchema).superRefine((value, ctx) => {
  if (value.enabled === true && value.channels !== undefined) validateMonitorAlertDelivery(value, ctx);
});

/**
 * 查询参数里的布尔值：HTTP query 只有字符串，`z.boolean()` 会把 `?enabled=false` 判成校验失败。
 * 前端不传该参数即代表「不筛选」。
 */
const queryBoolean = z.enum(['true', 'false']).transform((value) => value === 'true').optional();

/**
 * 时间范围端点：与服务端 `dateRangeBound` 的格式约定保持一致
 * （同时接受 `YYYY-MM-DD` 与 `YYYY-MM-DD HH:mm:ss`），裸字符串会让 `?endTime=abc` 被静默当成无筛选。
 */
const queryDateRangeBound = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/, '时间格式必须为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss')
  .optional();

export const monitorAlertRuleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(128).optional(),
  metric: z.enum(MONITOR_METRICS).optional(),
  level: z.enum(MONITOR_ALERT_LEVELS).optional(),
  /** 规则是否参与定时评估 */
  enabled: queryBoolean,
  /** 规则当前是否处于告警中 */
  state: z.enum(['ok', 'firing']).optional(),
});

export const monitorAlertEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(128).optional(),
  metric: z.enum(MONITOR_METRICS).optional(),
  level: z.enum(MONITOR_ALERT_LEVELS).optional(),
  status: z.enum(MONITOR_ALERT_EVENT_STATUSES).optional(),
  notifyStatus: z.enum(MONITOR_ALERT_NOTIFY_STATUSES).optional(),
  handleStatus: z.enum(MONITOR_ALERT_HANDLE_STATUSES).optional(),
  ruleId: z.coerce.number().int().positive().optional(),
  startTime: queryDateRangeBound,
  endTime: queryDateRangeBound,
});

/**
 * 人工处理告警事件。
 * `pending` 表示撤销认领，会一并清空处理人与备注，让事件重新回到「没人管」的池子里。
 */
export const handleMonitorAlertEventSchema = z.object({
  handleStatus: z.enum(MONITOR_ALERT_HANDLE_STATUSES),
  note: z.string().max(500).nullish(),
});

export const batchHandleMonitorAlertEventsSchema = handleMonitorAlertEventSchema.extend({
  ids: z.array(z.number().int().positive()).min(1, '请至少选择一条告警').max(200),
});

export const monitorAlertOverviewQuerySchema = z.object({
  range: z.enum(MONITOR_ALERT_OVERVIEW_RANGES).default('24h'),
});

export const monitorHistoryQuerySchema = z.object({
  range: z.enum(['1h', '6h', '24h', '7d', '30d']).default('1h'),
});

export type CreateMonitorAlertRuleInput = z.infer<typeof createMonitorAlertRuleSchema>;

export type UpdateMonitorAlertRuleInput = z.infer<typeof updateMonitorAlertRuleSchema>;

export type MonitorAlertRuleQuery = z.infer<typeof monitorAlertRuleQuerySchema>;

export type MonitorAlertEventQuery = z.infer<typeof monitorAlertEventQuerySchema>;

export type HandleMonitorAlertEventInput = z.infer<typeof handleMonitorAlertEventSchema>;

export type BatchHandleMonitorAlertEventsInput = z.infer<typeof batchHandleMonitorAlertEventsSchema>;

export type MonitorAlertOverviewQuery = z.infer<typeof monitorAlertOverviewQuerySchema>;

export type MonitorHistoryQuery = z.infer<typeof monitorHistoryQuerySchema>;

export const uploadCertSchema = z.object({
  name: z.string().min(1).max(128),
  domain: z.string().min(1).max(256),
  certContent: z.string().min(1),
  keyContent: z.string().min(1),
});

export type UploadCertSchemaInput = z.infer<typeof uploadCertSchema>;

// 多客服会话治理（接入/转接/超时自动路由/会话分配）
export const acceptMpKfSessionSchema = z.object({
  kfId: z.number().int().positive(),
});

export const closeMpKfSessionSchema = z.object({
  remark: z.string().max(255).optional(),
});

export const rateMpKfSessionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  remark: z.string().max(255).optional(),
});

export const replyMpKfSessionSchema = z.object({
  msgType: z.enum(['text', 'image', 'voice', 'video', 'news']).default('text'),
  content: z.string().max(2000).optional(),
  mediaId: z.string().max(128).optional(),
}).refine((v) => v.msgType !== 'text' || (v.content && v.content.trim().length > 0), {
  message: '文本消息内容不能为空', path: ['content'],
}).refine((v) => v.msgType === 'text' || !!v.mediaId, {
  message: '该消息类型需提供 mediaId', path: ['mediaId'],
});

export type AcceptMpKfSessionInput = z.infer<typeof acceptMpKfSessionSchema>;

export type CloseMpKfSessionInput = z.infer<typeof closeMpKfSessionSchema>;

export type RateMpKfSessionInput = z.infer<typeof rateMpKfSessionSchema>;

export type ReplyMpKfSessionInput = z.infer<typeof replyMpKfSessionSchema>;

export const handleUserFeedbackSchema = z.object({
  status: z.enum(['pending', 'processing', 'resolved', 'ignored']),
  handleRemark: z.string().max(500, '处理备注不能超过 500 字').nullable().optional(),
});

export type HandleUserFeedbackInput = z.input<typeof handleUserFeedbackSchema>;
