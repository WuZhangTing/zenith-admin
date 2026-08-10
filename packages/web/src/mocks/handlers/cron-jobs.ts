import { http } from 'msw';
import { ok, badRequest, notFound, pageParams, paginate } from '@/mocks/utils/handlers';
import { mockCronJobs, getNextCronJobId } from '@/mocks/data/system';
import { mockDateTime, mockDateTimeOffset, mockDateOffset } from '@/mocks/utils/date';
import type { CronJob } from '@zenith/shared/platform';

export const cronJobsHandlers = [
  // 获取可用任务处理器列表（必须在 :id 路由之前声明）
  http.get('/api/cron-jobs/handlers', () => {
    return ok(['emailNotification', 'dataCleanup', 'reportGeneration', 'cacheRefresh']);
  }),

  // 全量执行日志（必须在 :id 路由之前声明）
  http.get('/api/cron-jobs/logs', ({ request }) => {
    const url = new URL(request.url);

    const statuses: Array<'success' | 'fail' | 'running'> = ['success', 'success', 'success', 'fail', 'running'];
    const allLogs = mockCronJobs.flatMap((job, i) =>
      Array.from({ length: 5 }, (_, j) => ({
        id: i * 5 + j + 1,
        jobId: job.id,
        jobName: job.name,
        executionCount: i * 5 + j + 1,
        startedAt: mockDateTimeOffset(-(i * 5 + j + 1) * 1800000),
        endedAt: mockDateTimeOffset(-(i * 5 + j + 1) * 1800000 + 1200 + j * 200),
        durationMs: 1200 + j * 200,
        status: statuses[j % statuses.length],
        output: statuses[j % statuses.length] === 'fail' ? 'Error: Connection timeout' : 'Completed successfully',
      }))
    ).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

    return ok(paginate(allLogs, url, 20));
  }),

  // 按任务 ID 查询执行日志（必须在 :id 路由之前声明）
  http.get('/api/cron-jobs/:id/logs', ({ params, request }) => {
    const url = new URL(request.url);
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');

    const statuses: Array<'success' | 'fail' | 'running'> = ['success', 'success', 'fail', 'success', 'running'];
    const logs = Array.from({ length: 10 }, (_, j) => ({
      id: j + 1,
      jobId: job.id,
      jobName: job.name,
      executionCount: j + 1,
      startedAt: mockDateTimeOffset(-(j + 1) * 3600000),
      endedAt: mockDateTimeOffset(-(j + 1) * 3600000 + 1500 + j * 100),
      durationMs: 1500 + j * 100,
      status: statuses[j % statuses.length],
      output: statuses[j % statuses.length] === 'fail' ? 'Error: timeout' : 'OK',
    }));

    return ok(paginate(logs, url, 20));
  }),

  // 任务执行统计
  http.get('/api/cron-jobs/stats', () => {
    const statuses: Array<'success' | 'fail' | 'running'> = ['success', 'success', 'success', 'fail', 'running'];

    const perJob = mockCronJobs.map((job, i) => {
      const totalRuns = 20 + (i * 7 % 80);
      const successCount = Math.floor(totalRuns * (0.7 + (i * 3 % 30) / 100));
      const failCount = totalRuns - successCount;
      // 近 10 次执行状态（确定性生成；第 2 个任务演示连续失败告警）
      let recentResults: Array<'success' | 'fail' | 'running'>;
      if (i === 1) {
        recentResults = ['success', 'success', 'fail', 'success', 'success', 'success', 'fail', 'fail', 'fail', 'fail'];
      } else {
        recentResults = Array.from({ length: Math.min(10, totalRuns) }, (_, j) =>
          (j * 7 + i * 3) % 9 === 0 ? 'fail' : 'success');
      }
      let consecutiveFails = 0;
      for (let j = recentResults.length - 1; j >= 0; j--) {
        if (recentResults[j] === 'running') continue;
        if (recentResults[j] !== 'fail') break;
        consecutiveFails++;
      }
      const avgDurationMs = 800 + (i * 137 % 2600);
      return {
        jobId: job.id, jobName: job.name, totalRuns, successCount, failCount,
        successRate: Math.round((successCount / totalRuns) * 100),
        avgDurationMs,
        p95DurationMs: Math.round(avgDurationMs * (1.6 + (i % 4) * 0.45)),
        recentResults,
        consecutiveFails,
        lastRunStatus: job.lastRunStatus ?? (failCount > successCount ? 'fail' : 'success'),
        lastRunAt: job.lastRunAt ?? mockDateTimeOffset(-(i + 1) * 1800000),
      };
    });

    // 近 14 天趋势（确定性生成）
    const dailyStats = Array.from({ length: 14 }, (_, idx) => {
      const offset = idx - 13;
      const total = 12 + ((idx * 5 + 3) % 22);
      const failCount = (idx * 3) % 5;
      return {
        date: mockDateOffset(offset), total, successCount: total - failCount, failCount,
        avgDurationMs: 900 + ((idx * 173) % 1400),
      };
    });

    // 近 7 天按小时执行分布（凌晨批处理高峰 + 工作时段小幅增量）
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => {
      let total = 2 + ((hour * 3) % 5);
      if (hour >= 1 && hour <= 4) total += 14 - hour * 2;
      if (hour >= 9 && hour <= 18) total += 4;
      let failCount = 0;
      if ((hour * 7) % 11 === 0) failCount = 2;
      else if (hour % 5 === 0) failCount = 1;
      return { hour, total, failCount };
    });

    // 最近 12 条执行记录
    const recentLogs = Array.from({ length: 12 }, (_, j) => {
      const job = mockCronJobs[j % mockCronJobs.length];
      const status = statuses[j % statuses.length];
      let output: string;
      if (status === 'fail') output = 'Error: Connection timeout after 30000ms';
      else if (status === 'running') output = '任务执行中…';
      else output = `任务「${job.name}」执行成功，处理 ${100 + j * 13} 条记录`;
      return {
        id: j + 1,
        jobId: job.id,
        jobName: job.name,
        status,
        durationMs: status === 'running' ? null : 600 + (j * 211 % 3200),
        startedAt: mockDateTimeOffset(-(j + 1) * 900000),
        executionCount: 1 + (j % 3),
        output,
      };
    });

    return ok({
      totalJobs: mockCronJobs.length,
      enabledJobs: mockCronJobs.filter(j => j.status === 'enabled').length,
      runningJobs: 1,
      todayRuns: 24, todaySuccesses: 21, todayFails: 3,
      todayAvgDurationMs: 1450,
      perJob,
      dailyStats,
      hourlyStats,
      recentLogs,
    });
  }),

  // 定时任务列表（分页）
  http.get('/api/cron-jobs', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const keyword = url.searchParams.get('keyword') ?? '';

    let list = mockCronJobs.filter((j) => {
      if (keyword && !j.name.includes(keyword) && !j.handler.includes(keyword)) return false;
      return true;
    });
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  // 获取单个任务
  http.get('/api/cron-jobs/:id', ({ params }) => {
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');
    return ok(job);
  }),

  // 新增任务
  http.post('/api/cron-jobs', async ({ request }) => {
    const body = await request.json() as Partial<CronJob>;
    const newJob: CronJob = {
      id: getNextCronJobId(),
      name: body.name ?? '',
      cronExpression: body.cronExpression ?? '0 * * * * *',
      handler: body.handler ?? '',
      params: body.params ?? null,
      status: body.status ?? 'enabled',
      description: body.description ?? '',
      retryCount: body.retryCount ?? 0,
      retryInterval: body.retryInterval ?? 0,
      retryBackoff: body.retryBackoff ?? false,
      monitorTimeout: body.monitorTimeout ?? null,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunMessage: null,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockCronJobs.push(newJob);
    return ok(newJob, '新增成功');
  }),

  // 更新任务
  http.put('/api/cron-jobs/:id', async ({ params, request }) => {
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');
    const body = await request.json() as Partial<CronJob>;
    Object.assign(job, body, { updatedAt: mockDateTime() });
    return ok(job, '更新成功');
  }),

  // 清除所有执行日志（必须在 DELETE /:id 之前声明）
  http.delete('/api/cron-jobs/logs/clean', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 180;
    return ok(null, `已清除 ${days} 天前的日志`);
  }),

  // 清除单任务执行日志（必须在 DELETE /:id 之前声明）
  http.delete('/api/cron-jobs/:id/logs/clean', ({ params, request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 180;
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');
    return ok(null, `已清除「${job.name}」${days} 天前的日志`);
  }),

  // 删除任务
  http.delete('/api/cron-jobs/:id', ({ params }) => {
    const index = mockCronJobs.findIndex((j) => j.id === Number(params.id));
    if (index === -1) return notFound('任务不存在');
    mockCronJobs.splice(index, 1);
    return ok(null, '删除成功');
  }),

  // 立即执行任务（demo 模式仅更新 lastRunAt）
  http.post('/api/cron-jobs/:id/run', ({ params }) => {
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');
    job.lastRunAt = mockDateTime();
    job.lastRunStatus = 'success';
    job.lastRunMessage = 'Demo 模式：模拟执行成功';
    job.updatedAt = mockDateTime();
    return ok(job, '执行成功');
  }),

  // 更新任务状态
  http.put('/api/cron-jobs/:id/status', async ({ params, request }) => {
    const job = mockCronJobs.find((j) => j.id === Number(params.id));
    if (!job) return notFound('任务不存在');
    const body = await request.json() as { status?: 'enabled' | 'disabled' };
    if (body.status !== 'enabled' && body.status !== 'disabled') {
      return badRequest('状态值无效');
    }
    job.status = body.status;
    job.updatedAt = mockDateTime();
    return ok(job, '操作成功');
  }),
];
