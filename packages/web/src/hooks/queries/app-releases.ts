/**
 * 应用版本管理域 hooks（应用 / 版本 / 制品 / 看板统计）。
 *
 * key 结构：client-apps 与 app-releases 是两个独立命名空间；
 * 看板统计读事件流水（另一份数据源），单独命名空间 app-release-stats，
 * 不随版本 CRUD 失效（发布 / 下载事件由客户端行为产生，刷新按钮手动回源）。
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  AppArtifact,
  AppRelease,
  AppReleaseStats,
  ClientApp,
  ClientDevice,
  CreateExternalArtifactInput,
} from '@zenith/shared/ops';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

// ─── 应用 ────────────────────────────────────────────────────────────────────

export interface ClientAppListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export const {
  keys: clientAppKeys,
  useList: useClientAppList,
  useSave: useSaveClientApp,
  useDelete: useDeleteClientApps,
  useLookup: useAllClientApps,
} = createCrudQueries<ClientApp, ClientAppListParams, Partial<ClientApp>>({
  resource: 'client-apps',
  path: '/api/app-releases/apps',
  lookup: true,
  deleteMode: 'single',
});

// ─── 版本 ────────────────────────────────────────────────────────────────────

export interface AppReleaseListParams extends CrudListParams {
  appId?: number;
  channel?: string;
  status?: string;
  keyword?: string;
}

/** 应用列表的 releaseCount / latestVersion 冗余列随版本增删与发布状态变化 */
function invalidateClientAppLists(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: clientAppKeys.lists });
}

export const {
  keys: appReleaseKeys,
  useList: useAppReleaseList,
  useDetail: useAppReleaseDetail,
  useSave: useSaveAppRelease,
  useDelete: useDeleteAppReleases,
} = createCrudQueries<AppRelease, AppReleaseListParams, Partial<AppRelease>>({
  resource: 'app-releases',
  path: '/api/app-releases/releases',
  deleteMode: 'single',
  onSaved: invalidateClientAppLists,
  onDeleted: invalidateClientAppLists,
});

/** 发布 / 撤回 / 灰度共用的失效：详情 + 列表 + 应用冗余列（latestVersion 随发布态变化） */
function invalidateReleaseLifecycle(qc: QueryClient, id: number) {
  void qc.invalidateQueries({ queryKey: appReleaseKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: appReleaseKeys.lists });
  invalidateClientAppLists(qc);
}

export function usePublishAppRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<AppRelease>(`/api/app-releases/releases/${id}/publish`).then(unwrap),
    onSuccess: (_saved, id) => invalidateReleaseLifecycle(qc, id),
  });
}

export function useRevokeAppRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<AppRelease>(`/api/app-releases/releases/${id}/revoke`).then(unwrap),
    onSuccess: (_saved, id) => invalidateReleaseLifecycle(qc, id),
  });
}

export function useSetAppReleaseRollout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rolloutPercent }: { id: number; rolloutPercent: number }) =>
      request.put<AppRelease>(`/api/app-releases/releases/${id}/rollout`, { rolloutPercent }).then(unwrap),
    onSuccess: (_saved, { id }) => invalidateReleaseLifecycle(qc, id),
  });
}

// ─── 制品（版本详情的子资源，写后失效所属版本详情与列表的制品计数）──────────

/** 制品变更不触及应用冗余列（版本数 / 最新版本号都与制品无关），不失效 client-apps */
function invalidateReleaseArtifacts(qc: QueryClient, releaseId: number) {
  void qc.invalidateQueries({ queryKey: appReleaseKeys.detail(releaseId) });
  void qc.invalidateQueries({ queryKey: appReleaseKeys.lists });
}

export function useUploadAppArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, formData, onProgress }: {
      releaseId: number;
      formData: FormData;
      onProgress?: (percent: number) => void;
    }) => request.postForm<AppArtifact>(`/api/app-releases/releases/${releaseId}/artifacts`, formData, { onProgress }).then(unwrap),
    onSuccess: (_data, { releaseId }) => invalidateReleaseArtifacts(qc, releaseId),
  });
}

export function useAddExternalArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ releaseId, values }: { releaseId: number; values: CreateExternalArtifactInput }) =>
      request.post<AppArtifact>(`/api/app-releases/releases/${releaseId}/artifacts/external`, values).then(unwrap),
    onSuccess: (_data, { releaseId }) => invalidateReleaseArtifacts(qc, releaseId),
  });
}

export function useDeleteAppArtifact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ artifactId }: { artifactId: number; releaseId: number }) =>
      request.delete<null>(`/api/app-releases/artifacts/${artifactId}`).then(unwrap),
    onSuccess: (_data, { releaseId }) => invalidateReleaseArtifacts(qc, releaseId),
  });
}

// ─── 看板统计 ────────────────────────────────────────────────────────────────

export const appReleaseStatsKeys = {
  all: ['app-release-stats'] as const,
  of: (appId: number | undefined, days: number) => ['app-release-stats', appId, days] as const,
};

export function useAppReleaseStats(appId: number | undefined, days: number) {
  return useQuery({
    queryKey: appReleaseStatsKeys.of(appId, days),
    queryFn: () => request.get<AppReleaseStats>(`/api/app-releases/stats?appId=${appId}&days=${days}`).then(unwrap),
    enabled: appId !== undefined,
  });
}

// ─── 统一设备中心（升级心跳 / 推送绑定共用的设备档案）───────────────────────

export interface ClientDeviceListParams extends CrudListParams {
  appId?: number;
  platform?: string;
  subjectType?: string;
  pushBound?: string;
  keyword?: string;
}

export const {
  keys: clientDeviceKeys,
  useList: useClientDeviceList,
} = createCrudQueries<ClientDevice, ClientDeviceListParams, never>({
  resource: 'client-devices',
  path: '/api/app-releases/devices',
});

/** 解绑推送:设备行的绑定人与推送标识变化,失效设备列表 */
export function useUnbindDevicePush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.put<null>(`/api/app-releases/devices/${id}/unbind`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientDeviceKeys.lists });
    },
  });
}

/** 删除设备档案:失效设备列表;在网统计随下次查询自然刷新,不强制失效 stats */
export function useDeleteClientDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/app-releases/devices/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientDeviceKeys.lists });
    },
  });
}
