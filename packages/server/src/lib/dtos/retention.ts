/**
 * 数据保留策略 DTO
 */
import { z } from '@hono/zod-openapi';

export const RetentionPolicyDTO = z
  .object({
    key: z.string().openapi({ example: 'operation_logs' }),
    title: z.string().openapi({ example: '操作日志' }),
    module: z.string().openapi({ example: '系统管理' }),
    tableName: z.string().openapi({ example: 'operation_logs' }),
    timeColumn: z.string().openapi({ example: 'created_at' }),
    mode: z.enum(['age', 'ageAndCap', 'expiresAt', 'custom']),
    enabled: z.boolean(),
    /** 保留天数；0 表示不清理 */
    retentionDays: z.number().int(),
    /** 代码声明的默认保留天数 */
    defaultRetentionDays: z.number().int(),
    batchSize: z.number().int(),
    /** 是否按租户各自的保留设置执行 */
    perTenant: z.boolean(),
    capColumn: z.string().nullable(),
    capLimit: z.number().int().nullable(),
    description: z.string(),
    lastRunAt: z.string().nullable(),
    lastDeleted: z.number().int(),
  })
  .openapi('RetentionPolicy');

export const RetentionPreviewDTO = z
  .object({
    key: z.string(),
    /** 预计待删除行数 */
    pending: z.number().int(),
    /** 裁剪时间点；保留天数为 0 时返回 null */
    cutoff: z.string().nullable(),
  })
  .openapi('RetentionPreview');

export const RetentionRunResultDTO = z
  .object({
    key: z.string(),
    deleted: z.number().int(),
  })
  .openapi('RetentionRunResult');
