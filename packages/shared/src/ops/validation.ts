import { z } from 'zod';
import { partialForUpdate } from '../core/validation';
import {
  APP_ARCHES,
  APP_CLIENT_REPORTABLE_EVENT_TYPES,
  APP_PLATFORMS,
  APP_RELEASE_CHANNELS,
  APP_SEMVER_RE,
} from './constants';

// ─── 进程管理 ────────────────────────────────────────────────────────────────
export const killProcessSchema = z.object({
  signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP']).default('SIGTERM'),
});

export const setProcessPrioritySchema = z.object({
  /** Nice value -20~19 for Linux/macOS */
  nice: z.number().int().min(-20).max(19).optional(),
  /** Priority class for Windows */
  priorityClass: z.enum(['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High', 'RealTime']).optional(),
});

export type KillProcessInput = z.infer<typeof killProcessSchema>;

export type SetProcessPriorityInput = z.infer<typeof setProcessPrioritySchema>;

// ─── SQL 收藏夹 ─────────────────────────────────────────────────────────────────
export const createDbQueryFavoriteSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  sql: z.string().min(1, 'SQL 不能为空'),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

export const updateDbQueryFavoriteSchema = partialForUpdate(createDbQueryFavoriteSchema);

export type CreateDbQueryFavoriteInput = z.infer<typeof createDbQueryFavoriteSchema>;

export type UpdateDbQueryFavoriteInput = z.infer<typeof updateDbQueryFavoriteSchema>;

// ─── 数据保留策略 ────────────────────────────────────────────────────────────
/** 保留天数上限 10 年，足够覆盖等保与审计留存要求 */
export const RETENTION_MAX_DAYS = 3650;

export const RETENTION_MIN_BATCH_SIZE = 100;

export const RETENTION_MAX_BATCH_SIZE = 50_000;

export const updateRetentionPolicySchema = z.object({
  enabled: z.boolean().optional(),
  retentionDays: z.number().int().min(0, '保留天数不能为负').max(RETENTION_MAX_DAYS).optional(),
  batchSize: z.number().int().min(RETENTION_MIN_BATCH_SIZE).max(RETENTION_MAX_BATCH_SIZE).optional(),
});

export type UpdateRetentionPolicyInput = z.infer<typeof updateRetentionPolicySchema>;

// ─── 应用版本管理（在线升级）──────────────────────────────────────────────────

const semverSchema = z.string().max(32).regex(APP_SEMVER_RE, '版本号须为 semver 格式，如 1.2.3');

export const createClientAppSchema = z.object({
  appKey: z
    .string()
    .min(1, 'appKey 不能为空')
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'appKey 仅允许小写字母、数字与连字符'),
  name: z.string().min(1, '名称不能为空').max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});

/** appKey 是客户端侧标识，创建后不可修改（改了会导致在网客户端失联） */
export const updateClientAppSchema = partialForUpdate(createClientAppSchema).omit({ appKey: true });

export type CreateClientAppInput = z.infer<typeof createClientAppSchema>;
export type UpdateClientAppInput = z.infer<typeof updateClientAppSchema>;

export const createAppReleaseSchema = z.object({
  appId: z.number().int().positive(),
  channel: z.enum(APP_RELEASE_CHANNELS).default('stable'),
  version: semverSchema,
  notes: z.string().max(20000).optional(),
  mandatory: z.boolean().default(false),
  minVersion: semverSchema.nullable().optional(),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
});

/** 所属应用创建后不可更换 */
export const updateAppReleaseSchema = partialForUpdate(createAppReleaseSchema).omit({ appId: true });

export type CreateAppReleaseInput = z.infer<typeof createAppReleaseSchema>;
export type UpdateAppReleaseInput = z.infer<typeof updateAppReleaseSchema>;

/** 调整灰度比例（发布后可单独调整，不走完整更新） */
export const setAppReleaseRolloutSchema = z.object({
  rolloutPercent: z.number().int().min(0).max(100),
});

export type SetAppReleaseRolloutInput = z.infer<typeof setAppReleaseRolloutSchema>;

/** 外链制品（iOS App Store / TestFlight 等）；文件制品走 multipart 上传 */
export const createExternalArtifactSchema = z.object({
  platform: z.enum(APP_PLATFORMS),
  arch: z.enum(APP_ARCHES).default('universal'),
  externalUrl: z.string().url('必须是合法的 URL').max(500),
  fileName: z.string().min(1, '显示名不能为空').max(255),
});

export type CreateExternalArtifactInput = z.infer<typeof createExternalArtifactSchema>;

/** 公开 check API 查询参数 */
export const checkAppUpdateQuerySchema = z.object({
  app: z.string().min(1).max(64),
  platform: z.enum(APP_PLATFORMS),
  arch: z.enum(APP_ARCHES).optional(),
  channel: z.enum(APP_RELEASE_CHANNELS).default('stable'),
  version: semverSchema,
  deviceId: z.string().max(64).optional(),
});

export type CheckAppUpdateQuery = z.infer<typeof checkAppUpdateQuerySchema>;

/** 公开安装回执上报（download / check 由服务端记录，不接受客户端上报） */
export const reportAppReleaseEventSchema = z.object({
  app: z.string().min(1).max(64),
  eventType: z.enum(APP_CLIENT_REPORTABLE_EVENT_TYPES),
  channel: z.enum(APP_RELEASE_CHANNELS).default('stable'),
  platform: z.enum(APP_PLATFORMS),
  arch: z.enum(APP_ARCHES).optional(),
  /** 目标版本（本次安装的版本） */
  version: semverSchema,
  deviceId: z.string().max(64).optional(),
});

export type ReportAppReleaseEventInput = z.infer<typeof reportAppReleaseEventSchema>;

