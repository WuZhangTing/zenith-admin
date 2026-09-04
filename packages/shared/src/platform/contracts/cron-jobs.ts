import * as z from 'zod';
import { auditFieldsSchema, idParam, paginated, paginationQuery } from '../../core/api-schemas';
import { defineContract, op } from '../../core/contract';
import { CRON_JOB_STATUSES, CRON_RUN_STATUSES } from '../constants';
import { createCronJobSchema, cronJobStatusSchema, cronValidateSchema, updateCronJobSchema } from '../validation';

// ─── 实体 ────────────────────────────────────────────────────────────────────

export const cronJobSchema = z.object({
  id: z.int(),
  name: z.string().meta({ example: '数据库备份' }),
  cronExpression: z.string().meta({ example: '0 0 2 * * *' }),
  handler: z.string().meta({ example: 'backupDatabase' }),
  params: z.string().nullable(),
  status: z.enum(CRON_JOB_STATUSES),
  description: z.string(),
  retryCount: z.int(),
  retryInterval: z.int().meta({ description: '重试间隔，单位：秒' }),
  retryBackoff: z.boolean(),
  monitorTimeout: z.int().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: z.enum(CRON_RUN_STATUSES).nullable(),
  lastRunMessage: z.string().nullable(),
  ...auditFieldsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'CronJob' });

export type CronJob = z.infer<typeof cronJobSchema>;

export const cronJobLogSchema = z.object({
  id: z.int(),
  jobId: z.int(),
  jobName: z.string(),
  executionCount: z.int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationMs: z.int().nullable(),
  status: z.enum(CRON_RUN_STATUSES),
  output: z.string().nullable(),
}).meta({ id: 'CronJobLog' });

export type CronJobLog = z.infer<typeof cronJobLogSchema>;

export const cronJobStatsPerJobSchema = z.object({
  jobId: z.int(),
  jobName: z.string(),
  totalRuns: z.int(),
  successCount: z.int(),
  failCount: z.int(),
  successRate: z.number(),
  avgDurationMs: z.int().nullable(),
  p95DurationMs: z.int().nullable().meta({ description: 'P95 耗时（长尾性能），无已完成执行时为 null' }),
  recentResults: z.array(z.enum(CRON_RUN_STATUSES)).meta({ description: '近 10 次执行状态（旧 → 新）' }),
  consecutiveFails: z.int().meta({ description: '当前连续失败次数（最近一次成功后归零）' }),
  lastRunStatus: z.enum(CRON_RUN_STATUSES).nullable(),
  lastRunAt: z.string().nullable(),
}).meta({ id: 'CronJobStatsPerJob' });

export type CronJobStatsPerJob = z.infer<typeof cronJobStatsPerJobSchema>;

export const cronJobDailyStatSchema = z.object({
  date: z.string().meta({ example: '2026-06-22' }),
  total: z.int(),
  successCount: z.int(),
  failCount: z.int(),
  avgDurationMs: z.int().nullable().meta({ description: '当日已完成执行的平均耗时' }),
}).meta({ id: 'CronJobDailyStat' });

export type CronJobDailyStat = z.infer<typeof cronJobDailyStatSchema>;

export const cronJobHourlyStatSchema = z.object({
  hour: z.int().min(0).max(23),
  total: z.int(),
  failCount: z.int(),
}).meta({ id: 'CronJobHourlyStat' });

export type CronJobHourlyStat = z.infer<typeof cronJobHourlyStatSchema>;

export const cronJobRecentLogSchema = z.object({
  id: z.int(),
  jobId: z.int(),
  jobName: z.string(),
  status: z.enum(CRON_RUN_STATUSES),
  durationMs: z.int().nullable(),
  startedAt: z.string(),
  executionCount: z.int(),
  output: z.string().nullable(),
}).meta({ id: 'CronJobRecentLog' });

export type CronJobRecentLog = z.infer<typeof cronJobRecentLogSchema>;

export const cronJobStatsSchema = z.object({
  totalJobs: z.int(),
  enabledJobs: z.int(),
  runningJobs: z.int(),
  todayRuns: z.int(),
  todaySuccesses: z.int(),
  todayFails: z.int(),
  todayAvgDurationMs: z.int().nullable(),
  perJob: z.array(cronJobStatsPerJobSchema),
  dailyStats: z.array(cronJobDailyStatSchema),
  hourlyStats: z.array(cronJobHourlyStatSchema).meta({ description: '近 7 天按小时执行分布（识别调度高峰）' }),
  recentLogs: z.array(cronJobRecentLogSchema),
}).meta({ id: 'CronJobStats' });

export type CronJobStats = z.infer<typeof cronJobStatsSchema>;

export const cronValidateResultSchema = z.object({ valid: z.boolean() }).meta({ id: 'CronValidateResult' });

export type CronValidateResult = z.infer<typeof cronValidateResultSchema>;

// ─── 契约 ────────────────────────────────────────────────────────────────────

export const cronJobListQuery = paginationQuery.extend({
  keyword: z.string().optional().meta({ description: '按任务名称模糊匹配' }),
});

export const cronJobLogListQuery = paginationQuery.extend({
  jobId: z.coerce.number().int().positive().optional(),
});

export const cronJobClearLogsQuery = z.object({
  days: z.coerce.number().int().min(1).max(3650).default(180).meta({ description: '清除多少天之前的日志' }),
});

export const cronJobContract = defineContract('/api/cron-jobs', {
  handlers: op.get('/handlers', { response: z.array(z.string()), summary: '已注册 Handler' }),
  validate: op.post('/validate', { body: cronValidateSchema, response: cronValidateResultSchema, summary: '校验 Cron 表达式' }),
  list: op.get('/', { query: cronJobListQuery, response: paginated(cronJobSchema), summary: '任务列表' }),
  logs: op.get('/logs', { query: cronJobLogListQuery, response: paginated(cronJobLogSchema), summary: '所有执行日志' }),
  clearLogs: op.delete('/logs/clean', { query: cronJobClearLogsQuery, summary: '清除所有执行日志' }),
  stats: op.get('/stats', { response: cronJobStatsSchema, summary: '任务统计' }),
  create: op.post('/', { body: createCronJobSchema, response: cronJobSchema, summary: '新增任务' }),
  detail: op.get('/{id}', { params: idParam, response: cronJobSchema, summary: '任务详情' }),
  update: op.put('/{id}', { params: idParam, body: updateCronJobSchema, response: cronJobSchema, summary: '更新任务' }),
  remove: op.delete('/{id}', { params: idParam, summary: '删除任务' }),
  run: op.post('/{id}/run', { params: idParam, summary: '手动执行' }),
  setStatus: op.put('/{id}/status', { params: idParam, body: cronJobStatusSchema, summary: '切换状态' }),
  jobLogs: op.get('/{id}/logs', { params: idParam, query: paginationQuery, response: paginated(cronJobLogSchema), summary: '单任务日志' }),
  clearJobLogs: op.delete('/{id}/logs/clean', { params: idParam, query: cronJobClearLogsQuery, summary: '清除单任务执行日志' }),
}, { tags: ['CronJobs'] });
