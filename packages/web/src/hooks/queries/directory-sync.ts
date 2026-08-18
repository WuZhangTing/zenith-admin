import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  DirectorySyncSource, DirectorySyncRun, DirectorySyncRunItem, DirectorySyncConflict,
  ResolveDirectorySyncConflictInput,
} from '@zenith/shared/identity';
import type { AsyncTask } from '@zenith/shared/tasks';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 同步源（标准 CRUD，路径与资源名不一致故覆盖 path）───────────────────────────
export interface DirectorySyncSourceListParams extends CrudListParams {
  keyword?: string;
  type?: string;
  status?: string;
}

export const {
  keys: directorySyncSourceKeys,
  useList: useDirectorySyncSourceList,
  useDetail: useDirectorySyncSourceDetail,
  useSave: useSaveDirectorySyncSource,
  useDelete: useDeleteDirectorySyncSources,
} = createCrudQueries<DirectorySyncSource, DirectorySyncSourceListParams>({
  resource: 'directory-sync-sources',
  path: '/api/directory-sync/sources',
  deleteMode: 'single',
});

/** 测试连接：只读诊断，无副作用，不失效任何缓存 */
export function useTestDirectorySyncSource() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<{ ok: boolean; message: string; sampleUsers: Array<{ externalId: string; username: string; nickname: string }> }>(
        `/api/directory-sync/sources/${id}/test`,
      ).then(unwrap),
  });
}

/**
 * 立即同步 / 预览差异：提交任务中心作业。
 * 同步真正落库发生在后台任务完成时，此处仅失效运行记录列表（提交后立刻出现 running 记录）；
 * 源的 lastRunAt/lastRunStatus 由记录页轮询兜底，不在提交时失效源列表。
 */
export function useRunDirectorySyncSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dryRun }: { id: number; dryRun: boolean }) =>
      request.post<AsyncTask>(`/api/directory-sync/sources/${id}/${dryRun ? 'preview' : 'run'}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: directorySyncRunKeys.lists });
    },
  });
}

// ─── 同步记录（独立生命周期，另起命名空间）───────────────────────────────────────
export const directorySyncRunKeys = {
  all: ['directory-sync-runs'] as const,
  lists: ['directory-sync-runs', 'list'] as const,
  list: (params: DirectorySyncRunListParams) => ['directory-sync-runs', 'list', params] as const,
  detail: (id: number | undefined) => ['directory-sync-runs', 'detail', id] as const,
  items: (runId: number | undefined, params: DirectorySyncRunItemListParams) =>
    ['directory-sync-runs', 'items', runId, params] as const,
};

export interface DirectorySyncRunListParams extends CrudListParams {
  sourceId?: number;
  status?: string;
  startTime?: string;
  endTime?: string;
}

function hasRunningRun(data: PaginatedResponse<DirectorySyncRun> | undefined): boolean {
  return (data?.list ?? []).some((run) => run.status === 'running');
}

export function useDirectorySyncRunList(params: DirectorySyncRunListParams) {
  return useQuery({
    queryKey: directorySyncRunKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<DirectorySyncRun>>(`/api/directory-sync/runs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    // 有进行中的同步时轮询刷新
    refetchInterval: (query) => (hasRunningRun(query.state.data) ? 5000 : false),
  });
}

export function useDirectorySyncRunDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: directorySyncRunKeys.detail(id),
    queryFn: () => request.get<DirectorySyncRun>(`/api/directory-sync/runs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export interface DirectorySyncRunItemListParams extends CrudListParams {
  action?: string;
  entityType?: string;
}

export function useDirectorySyncRunItems(runId: number | undefined, params: DirectorySyncRunItemListParams, enabled = true) {
  return useQuery({
    queryKey: directorySyncRunKeys.items(runId, params),
    queryFn: () => request.get<PaginatedResponse<DirectorySyncRunItem>>(
      `/api/directory-sync/runs/${runId}/items${toQueryString(params)}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && runId !== undefined,
  });
}

/** 失败重试：对所属源重新提交同步任务，新 running 记录随后出现在列表 */
export function useRetryDirectorySyncRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => request.post<AsyncTask>(`/api/directory-sync/runs/${runId}/retry`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: directorySyncRunKeys.lists });
    },
  });
}

// ─── 冲突处理（独立生命周期，另起命名空间）───────────────────────────────────────
export const directorySyncConflictKeys = {
  all: ['directory-sync-conflicts'] as const,
  lists: ['directory-sync-conflicts', 'list'] as const,
  list: (params: DirectorySyncConflictListParams) => ['directory-sync-conflicts', 'list', params] as const,
};

export interface DirectorySyncConflictListParams extends CrudListParams {
  keyword?: string;
  sourceId?: number;
  status?: string;
}

export function useDirectorySyncConflictList(params: DirectorySyncConflictListParams) {
  return useQuery({
    queryKey: directorySyncConflictKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<DirectorySyncConflict>>(
      `/api/directory-sync/conflicts${toQueryString(params)}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/**
 * 裁决冲突：采用源值时会更新用户/绑定，但本页只挂载冲突列表，
 * 用户列表等所有者域查询未挂载时失效代价为零，不额外广播。
 */
export function useResolveDirectorySyncConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...values }: ResolveDirectorySyncConflictInput & { id: number }) =>
      request.post<DirectorySyncConflict>(`/api/directory-sync/conflicts/${id}/resolve`, values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: directorySyncConflictKeys.lists });
    },
  });
}

export function useIgnoreDirectorySyncConflicts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.post<null>('/api/directory-sync/conflicts/ignore', { ids }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: directorySyncConflictKeys.lists });
    },
  });
}
