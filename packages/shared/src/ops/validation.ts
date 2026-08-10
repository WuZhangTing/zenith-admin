import { z } from 'zod';
import { partialForUpdate } from '../core/validation';

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

