import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { CronJob, CronJobStats } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

export interface CronJobListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
}

export interface CronJobLog {
  id: number;
  jobId: number;
  jobName: string;
  executionCount: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: 'success' | 'fail' | 'running';
  output: string | null;
}

export interface CronJobLogsParams {
  jobId: number;
  page: number;
  pageSize: number;
}

export interface CronJobAllLogsParams {
  page: number;
  pageSize: number;
  jobId?: number;
}

export const cronJobKeys = {
  all: ['cron-jobs'] as const,
  handlers: ['cron-jobs', 'handlers'] as const,
  stats: ['cron-jobs', 'stats'] as const,
  lists: ['cron-jobs', 'list'] as const,
  list: (params: CronJobListParams) => ['cron-jobs', 'list', params] as const,
  detail: (id: number | undefined) => ['cron-jobs', 'detail', id] as const,
  logs: ['cron-jobs', 'logs'] as const,
  jobLogs: (params: CronJobLogsParams) => ['cron-jobs', 'logs', 'job', params] as const,
  allLogs: (params: CronJobAllLogsParams) => ['cron-jobs', 'logs', 'all', params] as const,
};

export function useCronJobList(params: CronJobListParams) {
  return useQuery({
    queryKey: cronJobKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<CronJob>>(`/api/cron-jobs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useCronJobHandlers() {
  return useQuery({
    queryKey: cronJobKeys.handlers,
    queryFn: () => request.get<string[]>('/api/cron-jobs/handlers').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCronJobDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: cronJobKeys.detail(id),
    queryFn: () => request.get<CronJob>(`/api/cron-jobs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCronJobStats() {
  return useQuery({
    queryKey: cronJobKeys.stats,
    queryFn: () => request.get<CronJobStats>('/api/cron-jobs/stats').then(unwrap),
  });
}

export function useCronJobLogs(params: CronJobLogsParams, enabled = true) {
  return useQuery({
    queryKey: cronJobKeys.jobLogs(params),
    queryFn: () => request.get<PaginatedResponse<CronJobLog>>(`/api/cron-jobs/${params.jobId}/logs${toQueryString({ page: params.page, pageSize: params.pageSize })}`).then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCronJobAllLogs(params: CronJobAllLogsParams, enabled = true) {
  return useQuery({
    queryKey: cronJobKeys.allLogs(params),
    queryFn: () => request.get<PaginatedResponse<CronJobLog>>(`/api/cron-jobs/logs${toQueryString(params)}`).then(unwrap),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSaveCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<CronJob> }) =>
      (id === undefined ? request.post<CronJob>('/api/cron-jobs', values) : request.put<CronJob>(`/api/cron-jobs/${id}`, values)).then(unwrap),
    onSuccess: (saved) => {
      // 写接口与详情接口同源（服务端同为 mapCronJob），可直接回填
      qc.setQueryData(cronJobKeys.detail(saved.id), saved);
      void qc.invalidateQueries({ queryKey: cronJobKeys.lists });
      // 概览含 totalJobs / enabledJobs 与 perJob.jobName，新增或改名都会变
      void qc.invalidateQueries({ queryKey: cronJobKeys.stats });
    },
  });
}

export function useDeleteCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/cron-jobs/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      // 实体已不存在：移除缓存，避免仍缓存的详情被失效后去请求必然 404 的资源
      qc.removeQueries({ queryKey: cronJobKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: cronJobKeys.lists });
      void qc.invalidateQueries({ queryKey: cronJobKeys.stats });
      // 执行日志按任务级联清理，且全量日志列表带 jobName
      void qc.invalidateQueries({ queryKey: cronJobKeys.logs });
    },
  });
}

/**
 * 手动执行：接口只返回提示文案（`okBody(null, msg)`），但副作用覆盖面很广——
 * 任务的 lastRunAt/lastRunStatus/lastRunMessage、执行日志、概览统计都会变。
 * 「命令型接口」不等于「无需失效」，判据是有没有已挂载的查询读了被改动的状态。
 */
export function useRunCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/cron-jobs/${id}/run`).then(unwrap),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: cronJobKeys.lists });
      void qc.invalidateQueries({ queryKey: cronJobKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: cronJobKeys.stats });
      void qc.invalidateQueries({ queryKey: cronJobKeys.logs });
    },
  });
}

export function useUpdateCronJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    // 状态接口返回 okBody(null, msg)，没有实体可回填，只能失效
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      request.put<null>(`/api/cron-jobs/${id}/status`, { status }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: cronJobKeys.lists });
      void qc.invalidateQueries({ queryKey: cronJobKeys.detail(id) });
      // 概览含 enabledJobs
      void qc.invalidateQueries({ queryKey: cronJobKeys.stats });
    },
  });
}

export function useClearCronJobLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ months, jobId }: { months: number; jobId?: number | null }) => {
      const url = jobId !== null && jobId !== undefined
        ? `/api/cron-jobs/${jobId}/logs/clean?months=${months}`
        : `/api/cron-jobs/logs/clean?months=${months}`;
      return request.delete<null>(url).then(unwrap);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: cronJobKeys.logs });
      // 概览的 recentLogs / dailyStats / perJob 均由日志聚合而来
      void qc.invalidateQueries({ queryKey: cronJobKeys.stats });
      // 任务本身字段不受影响，不动 lists / detail
    },
  });
}
