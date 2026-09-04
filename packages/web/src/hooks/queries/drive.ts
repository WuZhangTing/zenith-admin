import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type {
  AdminUpdateDriveSpaceInput,
  CopyDriveNodesInput,
  CreateDepartmentDriveSpaceInput,
  CreateDriveFolderInput,
  CreateDriveNodeCommentInput,
  CreateDriveShareLinkInput,
  CreateDriveSpaceInput,
  CreateDriveTagInput,
  DriveActivity,
  DriveAdminStats,
  DriveCopyResult,
  DriveFileVersion,
  DriveNode,
  DriveNodeComment,
  DriveNodeDetail,
  DriveNodeListResult,
  DriveNodePermissionsResult,
  DriveNodeType,
  DrivePublicNode,
  DrivePublicShareMeta,
  DrivePublicShareSession,
  DriveRecentItem,
  DriveSearchItem,
  DriveSettings,
  DriveSettingsInput,
  DriveShareAccessLog,
  DriveShareLink,
  DriveShareLinkState,
  DriveSharedItem,
  DriveSpace,
  DriveSpaceMember,
  DriveSpaceType,
  DriveTag,
  MoveDriveNodesInput,
  SaveDriveNodePermissionsInput,
  SaveDriveSpaceMembersInput,
  SaveFromDriveShareInput,
  UpdateDriveShareLinkInput,
  UpdateDriveSpaceInput,
  UpdateDriveTagInput,
} from '@zenith/shared/drive';
import type { AsyncTask } from '@zenith/shared/tasks';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import type { CrudListParams } from '@/lib/crud-queries';

/**
 * 企业网盘域 hooks。
 *
 * key 分层（失效连坐面）：
 * - `['drive','spaces',…]`            空间列表 / 详情 / 我的空间
 * - `['drive','space-members',id]`    成员（独立生命周期）
 * - `['drive','dir',spaceId,parentId]` 目录内容（增删改移只打对应目录，不打全站）
 * - `['drive','node',id]`             节点详情
 * - `['drive','node-*',id]`           节点子资源：授权 / 版本 / 动态 / 评论 / 外链
 * - `['drive','views',name,…]`        跨空间个人视图：与我共享 / 收藏 / 最近 / 搜索 / 回收站
 * - `['drive','share-links',…]`       我的外链
 * - `['drive','tags',spaceId]`
 * - `['drive','admin',…]`             治理页
 */
export const driveKeys = {
  all: ['drive'] as const,
  spaces: ['drive', 'spaces'] as const,
  mySpaces: ['drive', 'spaces', 'my'] as const,
  spaceLists: ['drive', 'spaces', 'list'] as const,
  spaceList: (params: object) => ['drive', 'spaces', 'list', params] as const,
  spaceDetail: (id: number | undefined) => ['drive', 'spaces', 'detail', id] as const,
  spaceMembers: (id: number | undefined) => ['drive', 'space-members', id] as const,
  dirs: ['drive', 'dir'] as const,
  dir: (spaceId: number | undefined, parentId: number | null | undefined) => ['drive', 'dir', spaceId ?? 0, parentId ?? 0] as const,
  dirList: (spaceId: number | undefined, parentId: number | null | undefined, params: object) => ['drive', 'dir', spaceId ?? 0, parentId ?? 0, params] as const,
  node: (id: number | undefined) => ['drive', 'node', id] as const,
  permissions: (id: number | undefined) => ['drive', 'node-permissions', id] as const,
  versions: (id: number | undefined) => ['drive', 'node-versions', id] as const,
  activities: (id: number | undefined, params: object) => ['drive', 'node-activities', id, params] as const,
  activitiesOf: (id: number | undefined) => ['drive', 'node-activities', id] as const,
  comments: (id: number | undefined) => ['drive', 'node-comments', id] as const,
  nodeShareLinks: (id: number | undefined) => ['drive', 'node-share-links', id] as const,
  views: ['drive', 'views'] as const,
  view: (name: string, params: object) => ['drive', 'views', name, params] as const,
  viewOf: (name: string) => ['drive', 'views', name] as const,
  shareLinks: ['drive', 'share-links'] as const,
  shareLinkList: (params: object) => ['drive', 'share-links', 'list', params] as const,
  shareAccessLogs: (id: number, params: object) => ['drive', 'share-links', 'logs', id, params] as const,
  tags: (spaceId: number | undefined) => ['drive', 'tags', spaceId] as const,
  admin: ['drive', 'admin'] as const,
  adminSpaces: (params: object) => ['drive', 'admin', 'spaces', params] as const,
  adminSpacesPrefix: ['drive', 'admin', 'spaces'] as const,
  adminShareLinks: (params: object) => ['drive', 'admin', 'share-links', params] as const,
  adminShareLinksPrefix: ['drive', 'admin', 'share-links'] as const,
  adminActivities: (params: object) => ['drive', 'admin', 'activities', params] as const,
  adminActivitiesPrefix: ['drive', 'admin', 'activities'] as const,
  adminStats: ['drive', 'admin', 'stats'] as const,
  settings: ['drive', 'admin', 'settings'] as const,
  publicShare: (token: string, session: string | null) => ['drive', 'public', token, session] as const,
  publicChildren: (token: string, session: string | null, parentId: number | undefined) => ['drive', 'public', token, session, 'children', parentId ?? 0] as const,
};

// ─── 失效工具 ─────────────────────────────────────────────────────────────────

/** 目录内容变化：该目录的全部分页 / 排序变体 */
export function invalidateDir(qc: QueryClient, spaceId: number, parentId: number | null) {
  void qc.invalidateQueries({ queryKey: driveKeys.dir(spaceId, parentId) });
}

/** 节点自身变化（重命名 / 锁 / 标签 / 版本）：详情 + 所在目录 + 个人视图（收藏 / 最近 / 搜索的列表项） */
function invalidateNodeSurface(qc: QueryClient, node: Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>) {
  void qc.invalidateQueries({ queryKey: driveKeys.node(node.id) });
  invalidateDir(qc, node.spaceId, node.parentId);
  void qc.invalidateQueries({ queryKey: driveKeys.views });
}

/** 容量变化：我的空间侧栏与空间详情的 usedBytes */
function invalidateUsage(qc: QueryClient, spaceId: number) {
  void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
  void qc.invalidateQueries({ queryKey: driveKeys.spaceDetail(spaceId) });
  void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
}

// ─── 空间 ─────────────────────────────────────────────────────────────────────

export interface DriveSpaceListParams extends CrudListParams {
  keyword?: string;
  type?: DriveSpaceType;
  status?: string;
}

export function useMyDriveSpaces() {
  return useQuery({
    queryKey: driveKeys.mySpaces,
    queryFn: () => request.get<DriveSpace[]>('/api/drive/spaces/my').then(unwrap),
    staleTime: 60_000,
  });
}

export function useDriveSpaceList(params: DriveSpaceListParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.spaceList(params),
    queryFn: () => request.get<PaginatedResponse<DriveSpace>>(`/api/drive/spaces${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriveSpaceDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.spaceDetail(id),
    queryFn: () => request.get<DriveSpace>(`/api/drive/spaces/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

/** 新建 / 更新协作空间；新建时可带成员 */
export function useSaveDriveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: CreateDriveSpaceInput | UpdateDriveSpaceInput }) =>
      (id === undefined
        ? request.post<DriveSpace>('/api/drive/spaces', values)
        : request.put<DriveSpace>(`/api/drive/spaces/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: driveKeys.spaceDetail(saved.id) });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceMembers(saved.id) });
    },
  });
}

export function useDeleteDriveSpaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => request.delete<null>(`/api/drive/spaces/${id}`).then(unwrap))).then(() => null),
    onSuccess: (_d, ids) => {
      for (const id of ids) qc.removeQueries({ queryKey: driveKeys.spaceDetail(id) });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
    },
  });
}

export function useDriveSpaceMembers(spaceId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.spaceMembers(spaceId),
    queryFn: () => request.get<DriveSpaceMember[]>(`/api/drive/spaces/${spaceId}/members`).then(unwrap),
    enabled: enabled && spaceId !== undefined,
  });
}

/** 保存成员：成员子键 + 列表（memberCount）+ 我的空间（myRole 可能变化） */
export function useSaveDriveSpaceMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ spaceId, members }: { spaceId: number } & SaveDriveSpaceMembersInput) =>
      request.put<null>(`/api/drive/spaces/${spaceId}/members`, { members }).then(unwrap),
    onSuccess: (_d, { spaceId }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.spaceMembers(spaceId) });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceDetail(spaceId) });
    },
  });
}

export function useTransferDriveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ spaceId, ownerId }: { spaceId: number; ownerId: number }) =>
      request.post<DriveSpace>(`/api/drive/spaces/${spaceId}/transfer`, { ownerId }).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: driveKeys.spaceDetail(saved.id) });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
    },
  });
}

// ─── 目录与节点 ───────────────────────────────────────────────────────────────

export interface DriveDirParams {
  spaceId?: number;
  parentId?: number | null;
  keyword?: string;
  type?: DriveNodeType;
  sortBy?: 'name' | 'size' | 'updatedAt' | 'createdAt';
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function useDriveDir(params: DriveDirParams, enabled = true) {
  const { spaceId, parentId, ...rest } = params;
  return useQuery({
    queryKey: driveKeys.dirList(spaceId, parentId, rest),
    queryFn: () => request.get<DriveNodeListResult>(`/api/drive/nodes${toQueryString({
      ...rest,
      spaceId: parentId ? undefined : spaceId,
      parentId: parentId ?? undefined,
    })}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && (spaceId !== undefined || !!parentId),
  });
}

export function useDriveNode(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.node(id),
    queryFn: () => request.get<DriveNodeDetail>(`/api/drive/nodes/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCreateDriveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDriveFolderInput) => request.post<DriveNode>('/api/drive/nodes/folder', input).then(unwrap),
    onSuccess: (node) => invalidateDir(qc, node.spaceId, node.parentId),
  });
}

export function useRenameDriveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => request.put<DriveNode>(`/api/drive/nodes/${id}/rename`, { name }).then(unwrap),
    onSuccess: (node) => invalidateNodeSurface(qc, node),
  });
}

/** 移动：源目录与目标目录都变化；节点详情的 ancestorIds / parentId 变化 */
export function useMoveDriveNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sources: _sources, ...input }: MoveDriveNodesInput & { sources: Array<Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>> }) =>
      request.post<null>('/api/drive/nodes/move', input).then(unwrap),
    onSuccess: (_d, { sources, targetSpaceId, targetParentId }) => {
      for (const s of sources) {
        invalidateDir(qc, s.spaceId, s.parentId);
        void qc.invalidateQueries({ queryKey: driveKeys.node(s.id) });
      }
      invalidateDir(qc, targetSpaceId, targetParentId);
      void qc.invalidateQueries({ queryKey: driveKeys.views });
    },
  });
}

export function useCopyDriveNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyDriveNodesInput) => request.post<DriveCopyResult>('/api/drive/nodes/copy', input).then(unwrap),
    onSuccess: (_d, { targetSpaceId, targetParentId }) => {
      invalidateDir(qc, targetSpaceId, targetParentId);
      invalidateUsage(qc, targetSpaceId);
    },
  });
}

/** 删除到回收站：源目录 + 回收站视图 + 个人视图；详情移除 */
export function useDeleteDriveNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodes }: { nodes: Array<Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>> }) =>
      request.delete<null>('/api/drive/nodes/batch', { ids: nodes.map((n) => n.id) }).then(unwrap),
    onSuccess: (_d, { nodes }) => {
      for (const n of nodes) {
        qc.removeQueries({ queryKey: driveKeys.node(n.id) });
        invalidateDir(qc, n.spaceId, n.parentId);
      }
      void qc.invalidateQueries({ queryKey: driveKeys.views });
    },
  });
}

export interface DriveViewParams extends CrudListParams {
  keyword?: string;
  type?: DriveNodeType;
  spaceId?: number;
}

export function useDriveRecycle(params: DriveViewParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.view('recycle', params),
    queryFn: () => request.get<PaginatedResponse<DriveNode & { spaceName: string }>>(`/api/drive/nodes/recycle${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** 还原：回收站视图 + 目标目录（原目录或空间根）+ 容量不变 */
export function useRestoreDriveNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids }: { ids: number[] }) => request.post<null>('/api/drive/nodes/recycle/restore', { ids }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driveKeys.viewOf('recycle') });
      // 还原目标可能落到原目录或空间根，目录键无法逐一定位，故失效全部目录缓存
      void qc.invalidateQueries({ queryKey: driveKeys.dirs });
    },
  });
}

export function usePurgeDriveNodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, spaceId }: { ids: number[]; spaceId?: number }) =>
      (ids.length ? request.post<null>('/api/drive/nodes/recycle/purge', { ids }) : request.delete<null>(`/api/drive/nodes/recycle${toQueryString({ spaceId })}`)).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driveKeys.viewOf('recycle') });
      // 彻底删除释放配额：所有空间用量都可能变化
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.spaces });
    },
  });
}

export function useDriveStarred(params: DriveViewParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.view('starred', params),
    queryFn: () => request.get<PaginatedResponse<DriveNode & { spaceName: string }>>(`/api/drive/nodes/starred${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriveRecent(params: DriveViewParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.view('recent', params),
    queryFn: () => request.get<PaginatedResponse<DriveRecentItem>>(`/api/drive/nodes/recent${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriveSharedWithMe(params: DriveViewParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.view('shared', params),
    queryFn: () => request.get<PaginatedResponse<DriveSharedItem>>(`/api/drive/nodes/shared-with-me${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export interface DriveSearchParams extends DriveViewParams {
  fullText?: boolean;
  extension?: string;
  startTime?: string;
  endTime?: string;
}

export function useDriveSearch(params: DriveSearchParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.view('search', params),
    queryFn: () => request.get<PaginatedResponse<DriveSearchItem>>(`/api/drive/nodes/search${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && !!params.keyword,
  });
}

/** 收藏：详情 isStarred + 收藏视图 + 所在目录的 isStarred 列 */
export function useStarDriveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ node, starred }: { node: Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>; starred: boolean }) =>
      (starred ? request.post<null>(`/api/drive/nodes/${node.id}/star`) : request.delete<null>(`/api/drive/nodes/${node.id}/star`)).then(unwrap),
    onSuccess: (_d, { node }) => invalidateNodeSurface(qc, node),
  });
}

// ─── 授权 ─────────────────────────────────────────────────────────────────────

export function useDriveNodePermissions(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.permissions(id),
    queryFn: () => request.get<DriveNodePermissionsResult>(`/api/drive/nodes/${id}/permissions`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

/** 授权变化：授权面板 + 与我共享视图（对被授权者）；子节点授权继承由服务端实时计算，无缓存 */
export function useSaveDriveNodePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: number } & SaveDriveNodePermissionsInput) =>
      request.put<DriveNodePermissionsResult>(`/api/drive/nodes/${id}/permissions`, { permissions }).then(unwrap),
    onSuccess: (data) => {
      qc.setQueryData(driveKeys.permissions(data.nodeId), data);
      void qc.invalidateQueries({ queryKey: driveKeys.viewOf('shared') });
    },
  });
}

export function useSetDriveNodeInherit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, inherit }: { id: number; inherit: boolean }) =>
      request.put<DriveNodePermissionsResult>(`/api/drive/nodes/${id}/inherit`, { inherit }).then(unwrap),
    onSuccess: (data) => {
      qc.setQueryData(driveKeys.permissions(data.nodeId), data);
      void qc.invalidateQueries({ queryKey: driveKeys.node(data.nodeId) });
      void qc.invalidateQueries({ queryKey: driveKeys.dirs });
    },
  });
}

// ─── 版本 ─────────────────────────────────────────────────────────────────────

export function useDriveNodeVersions(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.versions(id),
    queryFn: () => request.get<DriveFileVersion[]>(`/api/drive/nodes/${id}/versions`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

function invalidateVersionSurface(qc: QueryClient, node: Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>) {
  void qc.invalidateQueries({ queryKey: driveKeys.versions(node.id) });
  invalidateNodeSurface(qc, node);
  invalidateUsage(qc, node.spaceId);
}

export function useUploadDriveNodeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, comment, onProgress }: { id: number; file: File; comment?: string; onProgress?: (p: number) => void }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (comment) fd.append('comment', comment);
      return request.postForm<DriveNode>(`/api/drive/nodes/${id}/versions`, fd, { onProgress }).then(unwrap);
    },
    onSuccess: (node) => invalidateVersionSurface(qc, node),
  });
}

export function useRestoreDriveNodeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      request.post<DriveNode>(`/api/drive/nodes/${id}/versions/${version}/restore`).then(unwrap),
    onSuccess: (node) => invalidateVersionSurface(qc, node),
  });
}

export function useDeleteDriveNodeVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ node, version }: { node: Pick<DriveNode, 'id' | 'spaceId' | 'parentId'>; version: number }) =>
      request.delete<null>(`/api/drive/nodes/${node.id}/versions/${version}`).then(unwrap),
    onSuccess: (_d, { node }) => invalidateVersionSurface(qc, node),
  });
}

// ─── 动态 / 评论 / 标签 / 锁 ──────────────────────────────────────────────────

export function useDriveNodeActivities(id: number | undefined, params: CrudListParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.activities(id, params),
    queryFn: () => request.get<PaginatedResponse<DriveActivity>>(`/api/drive/nodes/${id}/activities${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && id !== undefined,
  });
}

export function useDriveNodeComments(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.comments(id),
    queryFn: () => request.get<DriveNodeComment[]>(`/api/drive/nodes/${id}/comments`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useCreateDriveNodeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & CreateDriveNodeCommentInput) =>
      request.post<DriveNodeComment>(`/api/drive/nodes/${id}/comments`, input).then(unwrap),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.comments(id) });
      void qc.invalidateQueries({ queryKey: driveKeys.activitiesOf(id) });
    },
  });
}

export function useDeleteDriveNodeComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, commentId }: { id: number; commentId: number }) =>
      request.delete<null>(`/api/drive/nodes/${id}/comments/${commentId}`).then(unwrap),
    onSuccess: (_d, { id }) => void qc.invalidateQueries({ queryKey: driveKeys.comments(id) }),
  });
}

export function useDriveTags(spaceId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.tags(spaceId),
    queryFn: () => request.get<DriveTag[]>(`/api/drive/tags?spaceId=${spaceId}`).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: enabled && spaceId !== undefined,
  });
}

export function useSaveDriveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, spaceId, values }: { id?: number; spaceId: number; values: CreateDriveTagInput | UpdateDriveTagInput }) =>
      (id === undefined
        ? request.post<DriveTag>('/api/drive/tags', { ...values, spaceId })
        : request.put<DriveTag>(`/api/drive/tags/${id}`, values)
      ).then(unwrap),
    onSuccess: (tag) => {
      void qc.invalidateQueries({ queryKey: driveKeys.tags(tag.spaceId) });
      // 标签改名会影响已打标节点的展示
      void qc.invalidateQueries({ queryKey: driveKeys.dirs });
    },
  });
}

export function useDeleteDriveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; spaceId: number }) => request.delete<null>(`/api/drive/tags/${id}`).then(unwrap),
    onSuccess: (_d, { spaceId }) => {
      void qc.invalidateQueries({ queryKey: driveKeys.tags(spaceId) });
      void qc.invalidateQueries({ queryKey: driveKeys.dirs });
    },
  });
}

export function useSetDriveNodeTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tagIds }: { id: number; tagIds: number[] }) => request.put<DriveNode>(`/api/drive/nodes/${id}/tags`, { tagIds }).then(unwrap),
    onSuccess: (node) => invalidateNodeSurface(qc, node),
  });
}

export function useLockDriveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lock, minutes }: { id: number; lock: boolean; minutes?: number }) =>
      (lock ? request.post<DriveNode>(`/api/drive/nodes/${id}/lock`, { minutes }) : request.delete<DriveNode>(`/api/drive/nodes/${id}/lock`)).then(unwrap),
    onSuccess: (node) => invalidateNodeSurface(qc, node),
  });
}

// ─── 打包下载 ─────────────────────────────────────────────────────────────────

/** 同步 zip 直接触发浏览器下载；超阈值时服务端返回任务 JSON */
export async function batchDownloadDriveNodes(ids: number[]): Promise<{ mode: 'sync' } | { mode: 'task'; taskId: number | null } | null> {
  const res = await request.fetchRaw('/api/drive/nodes/batch-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res) return null;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await res.json() as { code: number; message: string; data: { mode: 'task'; taskId: number | null } | null };
    if (body.code !== 0) throw new Error(body.message || '打包失败');
    return body.data ?? { mode: 'task', taskId: null };
  }
  if (!res.ok) throw new Error('打包失败');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `drive_${Date.now()}.zip`;
  const { downloadBlob } = await import('@/utils/download');
  downloadBlob(blob, filename);
  return { mode: 'sync' };
}

// ─── 外链 ─────────────────────────────────────────────────────────────────────

export interface DriveShareLinkListParams extends CrudListParams {
  keyword?: string;
  spaceId?: number;
  state?: DriveShareLinkState;
  createdBy?: number;
  startTime?: string;
  endTime?: string;
}

export function useDriveNodeShareLinks(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: driveKeys.nodeShareLinks(id),
    queryFn: () => request.get<DriveShareLink[]>(`/api/drive/nodes/${id}/share-links`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useMyDriveShareLinks(params: DriveShareLinkListParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.shareLinkList(params),
    queryFn: () => request.get<PaginatedResponse<DriveShareLink>>(`/api/drive/share-links${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriveShareAccessLogs(shareId: number | undefined, params: CrudListParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.shareAccessLogs(shareId ?? 0, params),
    queryFn: () => request.get<PaginatedResponse<DriveShareAccessLog>>(`/api/drive/share-links/${shareId}/access-logs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && shareId !== undefined,
  });
}

function invalidateShareLinks(qc: QueryClient, nodeId: number) {
  void qc.invalidateQueries({ queryKey: driveKeys.nodeShareLinks(nodeId) });
  void qc.invalidateQueries({ queryKey: driveKeys.shareLinks });
  void qc.invalidateQueries({ queryKey: driveKeys.node(nodeId) });
  void qc.invalidateQueries({ queryKey: driveKeys.adminShareLinksPrefix });
}

export function useCreateDriveShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, ...input }: { nodeId: number } & CreateDriveShareLinkInput) =>
      request.post<DriveShareLink>(`/api/drive/nodes/${nodeId}/share-links`, input).then(unwrap),
    onSuccess: (link) => invalidateShareLinks(qc, link.nodeId),
  });
}

export function useUpdateDriveShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number } & UpdateDriveShareLinkInput) =>
      request.put<DriveShareLink>(`/api/drive/share-links/${id}`, input).then(unwrap),
    onSuccess: (link) => invalidateShareLinks(qc, link.nodeId),
  });
}

export function useRevokeDriveShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; nodeId: number }) => request.post<null>(`/api/drive/share-links/${id}/revoke`).then(unwrap),
    onSuccess: (_d, { nodeId }) => invalidateShareLinks(qc, nodeId),
  });
}

export function useDeleteDriveShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; nodeId: number }) => request.delete<null>(`/api/drive/share-links/${id}`).then(unwrap),
    onSuccess: (_d, { nodeId }) => invalidateShareLinks(qc, nodeId),
  });
}

// ─── 公开外链（匿名） ─────────────────────────────────────────────────────────
// 公开端点的 401 表示「密码错误 / 会话失效」，必须 skipAuth 以免触发管理员 token 刷新与退出登录。

export function useDrivePublicShare(token: string | undefined, session: string | null) {
  return useQuery({
    queryKey: driveKeys.publicShare(token ?? '', session),
    queryFn: () => request.get<DrivePublicShareMeta>(`/api/drive/public/shares/${token}`, {
      skipAuth: true, silent: true, headers: session ? { session } : undefined,
    }).then(unwrap),
    enabled: !!token,
    retry: false,
  });
}

export async function accessDrivePublicShare(token: string, password?: string): Promise<DrivePublicShareSession & { meta: DrivePublicShareMeta }> {
  return request.post<DrivePublicShareSession & { meta: DrivePublicShareMeta }>(`/api/drive/public/shares/${token}/access`, { password }, { skipAuth: true, silent: true }).then(unwrap);
}

export function useDrivePublicChildren(token: string | undefined, session: string | null, parentId: number | undefined) {
  return useQuery({
    queryKey: driveKeys.publicChildren(token ?? '', session, parentId),
    queryFn: () => request.get<DrivePublicNode[]>(`/api/drive/public/shares/${token}/nodes${toQueryString({ parentId })}`, {
      skipAuth: true, silent: true, headers: session ? { session } : undefined,
    }).then(unwrap),
    enabled: !!token && !!session,
    retry: false,
  });
}

/** 公开内容地址（附带会话查询串，供 <a download> / 预览层直接访问） */
export function drivePublicContentUrl(token: string, nodeId: number, session: string, download = false): string {
  return `/api/drive/public/shares/${token}/nodes/${nodeId}/content${toQueryString({ session, download: download ? 'true' : undefined })}`;
}

export function useSaveFromDriveShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ token, session, ...input }: { token: string; session: string } & SaveFromDriveShareInput) =>
      request.post<null>(`/api/drive/public/shares/${token}/save${toQueryString({ session })}`, input).then(unwrap),
    onSuccess: (_d, { targetSpaceId, targetParentId }) => {
      invalidateDir(qc, targetSpaceId, targetParentId);
      invalidateUsage(qc, targetSpaceId);
    },
  });
}

// ─── 管理 ─────────────────────────────────────────────────────────────────────

export interface DriveAdminSpaceParams extends CrudListParams {
  keyword?: string;
  type?: DriveSpaceType;
  status?: string;
  departmentId?: number;
  ownerId?: number;
}

export function useDriveAdminSpaces(params: DriveAdminSpaceParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.adminSpaces(params),
    queryFn: () => request.get<PaginatedResponse<DriveSpace>>(`/api/drive/admin/spaces${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminUpdateDriveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: AdminUpdateDriveSpaceInput }) =>
      request.put<DriveSpace>(`/api/drive/admin/spaces/${id}`, values).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: driveKeys.adminSpacesPrefix });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceDetail(saved.id) });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.adminStats });
    },
  });
}

export function useCreateDepartmentDriveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDepartmentDriveSpaceInput) => request.post<DriveSpace>('/api/drive/admin/spaces/department', input).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driveKeys.adminSpacesPrefix });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.adminStats });
    },
  });
}

export function useAdminDeleteDriveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/drive/admin/spaces/${id}`).then(unwrap),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: driveKeys.spaceDetail(id) });
      void qc.invalidateQueries({ queryKey: driveKeys.adminSpacesPrefix });
      void qc.invalidateQueries({ queryKey: driveKeys.spaceLists });
      void qc.invalidateQueries({ queryKey: driveKeys.mySpaces });
      void qc.invalidateQueries({ queryKey: driveKeys.adminStats });
    },
  });
}

/** 容量重算 / 索引补建走任务中心：结果由任务托盘反馈，完成后用量需刷新 */
export function useSubmitDriveAdminTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, spaceId }: { kind: 'recalc' | 'reindex'; spaceId?: number }) =>
      request.post<AsyncTask>(kind === 'recalc' ? '/api/drive/admin/spaces/recalc' : '/api/drive/admin/reindex', { spaceId }).then(unwrap),
    onSuccess: () => void qc.invalidateQueries({ queryKey: driveKeys.adminSpacesPrefix }),
  });
}

export function useDriveAdminShareLinks(params: DriveShareLinkListParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.adminShareLinks(params),
    queryFn: () => request.get<PaginatedResponse<DriveShareLink>>(`/api/drive/admin/share-links${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminRevokeDriveShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; nodeId: number }) => request.post<null>(`/api/drive/admin/share-links/${id}/revoke`).then(unwrap),
    onSuccess: (_d, { nodeId }) => {
      invalidateShareLinks(qc, nodeId);
      void qc.invalidateQueries({ queryKey: driveKeys.adminStats });
    },
  });
}

export interface DriveAdminActivityParams extends CrudListParams {
  keyword?: string;
  spaceId?: number;
  actorId?: number;
  action?: string;
  startTime?: string;
  endTime?: string;
}

export function useDriveAdminActivities(params: DriveAdminActivityParams, enabled = true) {
  return useQuery({
    queryKey: driveKeys.adminActivities(params),
    queryFn: () => request.get<PaginatedResponse<DriveActivity>>(`/api/drive/admin/activities${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDriveAdminStats(enabled = true) {
  return useQuery({
    queryKey: driveKeys.adminStats,
    queryFn: () => request.get<DriveAdminStats>('/api/drive/admin/stats').then(unwrap),
    enabled,
  });
}

export function useDriveSettings(enabled = true) {
  return useQuery({
    queryKey: driveKeys.settings,
    queryFn: () => request.get<DriveSettings>('/api/drive/admin/settings').then(unwrap),
    enabled,
  });
}

export function useSaveDriveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: DriveSettingsInput) => request.put<DriveSettings>('/api/drive/admin/settings', values).then(unwrap),
    onSuccess: (settings) => {
      qc.setQueryData(driveKeys.settings, settings);
      // 默认配额变化影响空间生效配额展示
      void qc.invalidateQueries({ queryKey: driveKeys.spaces });
      void qc.invalidateQueries({ queryKey: driveKeys.adminSpacesPrefix });
    },
  });
}
