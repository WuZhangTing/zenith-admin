import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AsyncTask, ImportEntityMeta } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { asyncTaskKeys } from './async-tasks';

export const importJobKeys = {
  all: ['import-jobs'] as const,
  entities: ['import-jobs', 'entities'] as const,
  task: (id: number) => ['import-jobs', 'task', id] as const,
};

/** 可导入实体（按权限过滤，登录期内稳定） */
export function useImportEntities(enabled = true) {
  return useQuery({
    queryKey: importJobKeys.entities,
    queryFn: () => request.get<ImportEntityMeta[]>('/api/import-jobs/entities', { silent: true }).then(unwrap),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** 提交导入任务（文件先经 /api/files/upload 上传拿 fileId） */
export function useSubmitImportJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, fileId, dryRun, context }: {
      entity: string; fileId: string; dryRun?: boolean; context?: Record<string, unknown>;
    }) =>
      request.post<AsyncTask>('/api/import-jobs', { entity, fileId, dryRun, context }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: asyncTaskKeys.lists });
    },
  });
}

/** 导入任务详情轮询（运行期 1s 一拉，终态停止） */
export function useImportTaskPolling(taskId: number | null) {
  return useQuery({
    queryKey: importJobKeys.task(taskId ?? 0),
    queryFn: () => request.get<AsyncTask>(`/api/async-tasks/${taskId}`, { silent: true }).then(unwrap),
    enabled: taskId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'running' ? 1000 : false;
    },
  });
}

/** 下载导入模板（带鉴权的二进制下载） */
export function downloadImportTemplate(entity: string, title: string) {
  return request.download(`/api/import-jobs/${encodeURIComponent(entity)}/template`, `${title}导入模板.xlsx`);
}
