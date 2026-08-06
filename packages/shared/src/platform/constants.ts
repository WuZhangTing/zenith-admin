import { createLabelOptions } from '../core/enum-options';

export const FILE_STORAGE_PROVIDERS = ['local', 'oss', 's3', 'cos', 'obs', 'kodo', 'bos', 'azure', 'sftp'] as const;

export const FILE_OBJECT_ACLS = ['default', 'private', 'public-read', 'public-read-write'] as const;

/**
 * 各 provider 支持的对象级读写权限（canned ACL）；default = 继承 Bucket（上传时不发送 ACL 参数）。
 * COS 对象级 ACL 无 public-read-write；BOS 对象级 ACL 仅 private / public-read。
 * 未列出的 provider（local/kodo/azure/sftp）不支持对象级 ACL。
 */
export const FILE_OBJECT_ACL_SUPPORT: Partial<Record<(typeof FILE_STORAGE_PROVIDERS)[number], readonly (typeof FILE_OBJECT_ACLS)[number][]>> = {
  oss: ['default', 'private', 'public-read', 'public-read-write'],
  s3: ['default', 'private', 'public-read', 'public-read-write'],
  cos: ['default', 'private', 'public-read'],
  obs: ['default', 'private', 'public-read', 'public-read-write'],
  bos: ['default', 'private', 'public-read'],
};

/** 文件访问 URL 策略：proxy=服务端代理（兜底）；public=永久公开直链；presigned=临时签名直链 */
export const FILE_URL_STRATEGIES = ['proxy', 'public', 'presigned'] as const;

export const FILE_URL_STRATEGY_LABELS: Record<(typeof FILE_URL_STRATEGIES)[number], string> = {
  proxy: '服务端代理',
  public: '公开直链',
  presigned: '临时签名直链',
};

export const FILE_URL_STRATEGY_OPTIONS: Array<{ value: (typeof FILE_URL_STRATEGIES)[number]; label: string }> =
  createLabelOptions(FILE_URL_STRATEGIES, FILE_URL_STRATEGY_LABELS);

/** 临时签名有效期（秒）：默认 30 分钟，限制在 1 分钟 ~ 7 天（S3 SigV4 上限） */
export const PRESIGNED_EXPIRY_DEFAULT_SECONDS = 1800;

export const PRESIGNED_EXPIRY_MIN_SECONDS = 60;

export const PRESIGNED_EXPIRY_MAX_SECONDS = 604_800;

/** 存储提供方展示名（配置页/文件管理/统计面板统一复用） */
export const FILE_STORAGE_PROVIDER_LABELS: Record<(typeof FILE_STORAGE_PROVIDERS)[number], string> = {
  local: '本地磁盘',
  oss: '阿里云 OSS',
  s3: 'S3 兼容存储',
  cos: '腾讯云 COS',
  obs: '华为云 OBS',
  kodo: '七牛云 Kodo',
  bos: '百度云 BOS',
  azure: 'Azure Blob',
  sftp: 'SFTP',
};

/** 存储提供方下拉选项（与 FILE_STORAGE_PROVIDER_LABELS 自动同步） */
export const FILE_STORAGE_PROVIDER_OPTIONS: Array<{ value: (typeof FILE_STORAGE_PROVIDERS)[number]; label: string }> =
  createLabelOptions(FILE_STORAGE_PROVIDERS, FILE_STORAGE_PROVIDER_LABELS);

export const CONFIG_TYPES = ['string', 'number', 'boolean', 'json'] as const;

export const CRON_JOB_STATUSES = ['enabled', 'disabled'] as const;

export const CRON_RUN_STATUSES = ['success', 'fail', 'running'] as const;

/** 定时任务执行状态标签（列表页/仪表盘统一复用） */
export const CRON_RUN_STATUS_LABELS: Record<(typeof CRON_RUN_STATUSES)[number], string> = {
  success: '成功',
  fail: '失败',
  running: '运行中',
};

export const BACKUP_TYPES = ['pg_dump', 'drizzle_export'] as const;

export const BACKUP_STATUSES = ['pending', 'running', 'success', 'failed'] as const;

/** 内置「Zenith 助手」系统号 code（全局唯一、内置不可删、全员订阅） */
export const SYSTEM_CHANNEL_CODE = 'system-assistant';

/** 地区层级标签（regions 前端页面 / server 导出统一复用） */
export const REGION_LEVEL_LABELS = {
  province: '省级',
  city: '地级',
  county: '县级',
} as const;
