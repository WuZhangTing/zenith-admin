import { z } from '@hono/zod-openapi';

export const AsyncTaskStatusDTO = z.enum(['pending', 'running', 'success', 'failed', 'cancelled']);

export const AsyncTaskDTO = z
  .object({
    id: z.number().int(),
    taskType: z.string(),
    title: z.string(),
    module: z.string().nullable(),
    status: AsyncTaskStatusDTO,
    payload: z.record(z.string(), z.unknown()),
    totalCount: z.number().int().nullable(),
    processedCount: z.number().int(),
    failedCount: z.number().int(),
    progressNote: z.string().nullable(),
    result: z.record(z.string(), z.unknown()).nullable(),
    errorMessage: z.string().nullable(),
    cancelRequested: z.boolean(),
    attempts: z.number().int(),
    maxAttempts: z.number().int(),
    nextRunAt: z.string().nullable(),
    createdBy: z.number().int().nullable(),
    createdByName: z.string().nullable(),
    tenantId: z.number().int().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('AsyncTask');

export const AsyncTaskTypeMetaDTO = z
  .object({
    taskType: z.string(),
    title: z.string(),
    module: z.string(),
    description: z.string().nullable(),
    allowConcurrent: z.boolean(),
    enabled: z.boolean(),
    maxAttempts: z.number().int(),
    retryDelayMs: z.number().int(),
    retentionDays: z.number().int().nullable(),
  })
  .openapi('AsyncTaskTypeMeta');

export const AsyncTaskItemDTO = z
  .object({
    id: z.number().int(),
    taskId: z.number().int(),
    itemKey: z.string(),
    label: z.string().nullable(),
    status: z.enum(['pending', 'success', 'failed', 'skipped']),
    message: z.string().nullable(),
    data: z.record(z.string(), z.unknown()).nullable(),
    attempt: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('AsyncTaskItem');

export const AsyncTaskStatsDTO = z
  .object({
    total: z.number().int(),
    pending: z.number().int(),
    running: z.number().int(),
    success: z.number().int(),
    failed: z.number().int(),
    cancelled: z.number().int(),
    avgDurationMs: z.number().int().nullable(),
    /** 近 24 小时完成任务耗时分位（毫秒） */
    duration: z.object({
      p50: z.number().int().nullable(),
      p95: z.number().int().nullable(),
      max: z.number().int().nullable(),
    }),
    /** 今日提交概览与昨日提交数 */
    today: z.object({
      submitted: z.number().int(),
      success: z.number().int(),
      failed: z.number().int(),
      yesterdaySubmitted: z.number().int(),
    }),
    daily: z.array(z.object({
      date: z.string(),
      submitted: z.number().int(),
      success: z.number().int(),
      failed: z.number().int(),
    })),
    /** 近 24 小时每小时提交/失败数（hour: YYYY-MM-DD HH:00） */
    hourly: z.array(z.object({
      hour: z.string(),
      submitted: z.number().int(),
      failed: z.number().int(),
    })),
    /** 已结束任务中的成功占比（百分比，保留一位小数） */
    successRate: z.number().nullable(),
    backlog: z.object({
      pending: z.number().int(),
      oldestPendingMinutes: z.number().int().nullable(),
    }),
    retried: z.number().int(),
    /** 重试后最终成功的任务数 */
    retriedRecovered: z.number().int(),
    /** 行级处理量累计 */
    items: z.object({
      processed: z.number().int(),
      failed: z.number().int(),
    }),
    /** 近 30 天提交人 Top 5 */
    topSubmitters: z.array(z.object({
      userId: z.number().int().nullable(),
      username: z.string(),
      count: z.number().int(),
      failed: z.number().int(),
    })),
    byType: z.array(z.object({
      taskType: z.string(),
      title: z.string(),
      module: z.string().nullable(),
      total: z.number().int(),
      running: z.number().int(),
      success: z.number().int(),
      failed: z.number().int(),
      successRate: z.number().nullable(),
      avgDurationMs: z.number().int().nullable(),
    })),
  })
  .openapi('AsyncTaskStats');

export const AsyncTaskBatchResultDTO = z
  .object({ affected: z.number().int() })
  .openapi('AsyncTaskBatchResult');

export const AsyncTaskCleanupResultDTO = z
  .object({ cleaned: z.number().int() })
  .openapi('AsyncTaskCleanupResult');
