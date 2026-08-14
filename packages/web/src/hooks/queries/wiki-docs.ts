import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  MoveWikiDocInput,
  ReviewWikiDocInput,
  WikiDoc,
  WikiDocTreeNode,
  WikiDocVersion,
} from '@zenith/shared/wiki';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface WikiDocListParams extends CrudListParams {
  keyword?: string;
  spaceId?: number;
  status?: string;
  tagId?: number;
  mine?: boolean;
}

// ─── 独立命名空间的子资源 ─────────────────────────────────────────────────────

/** 目录树：文档中心长期挂载，按空间精确失效 */
export const wikiDocTreeKeys = {
  all: ['wiki-doc-tree'] as const,
  of: (spaceId: number | undefined) => ['wiki-doc-tree', spaceId] as const,
};

/** 版本历史：随文档更新 / 回滚失效 */
export const wikiDocVersionKeys = {
  of: (docId: number | undefined) => ['wiki-doc-versions', docId] as const,
  list: (docId: number | undefined, params: CrudListParams) => ['wiki-doc-versions', docId, params] as const,
  detail: (docId: number | undefined, version: number | undefined) =>
    ['wiki-doc-versions', docId, 'detail', version] as const,
};

/** 我的收藏（列表变体，独立前缀避免被文档列表广播打掉） */
export const wikiDocFavoriteKeys = {
  all: ['wiki-doc-favorites'] as const,
  list: (params: unknown) => ['wiki-doc-favorites', params] as const,
};

/** 回收站（列表变体） */
export const wikiDocRecycleKeys = {
  all: ['wiki-doc-recycle'] as const,
  list: (params: unknown) => ['wiki-doc-recycle', params] as const,
};

/** 全文检索（独立前缀：结果集昂贵且与列表生命周期无关） */
export const wikiDocSearchKeys = {
  all: ['wiki-doc-search'] as const,
  list: (params: unknown) => ['wiki-doc-search', params] as const,
};

/** 最近访问（浏览行为驱动，浏览上报后失效） */
export const wikiDocRecentKey = ['wiki-doc-recent'] as const;

export const {
  keys: wikiDocKeys,
  useList: useWikiDocList,
  useDetail: useWikiDocDetail,
  useSave: useSaveWikiDoc,
  useDelete: useDeleteWikiDocs,
} = createCrudQueries<WikiDoc, WikiDocListParams>({
  resource: 'wiki-docs',
  path: '/api/wiki/docs',
  deleteMode: 'single',
  // 保存（含正文更新）会改动目录树节点标题/状态并产生新版本
  onSaved: (qc, saved) => {
    void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    void qc.invalidateQueries({ queryKey: wikiDocVersionKeys.of(saved.id) });
    void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
  },
  // 删除 = 移入回收站：树、收藏、回收站列表都受影响（ids 无法反查 spaceId，树整组失效）
  onDeleted: (qc) => {
    void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.all });
    void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
    void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
  },
});

// ─── 查询 ─────────────────────────────────────────────────────────────────────

export function useWikiDocTree(spaceId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: wikiDocTreeKeys.of(spaceId),
    queryFn: () => request.get<WikiDocTreeNode[]>(`/api/wiki/docs/tree?spaceId=${spaceId}`).then(unwrap),
    enabled: enabled && spaceId !== undefined,
  });
}

export function useMyFavoriteWikiDocs(params: CrudListParams & { keyword?: string }, enabled = true) {
  return useQuery({
    queryKey: wikiDocFavoriteKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<WikiDoc>>(`/api/wiki/docs/favorites${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useWikiDocRecycleList(params: WikiDocListParams) {
  return useQuery({
    queryKey: wikiDocRecycleKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<WikiDoc>>(`/api/wiki/docs/recycle${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export interface WikiDocSearchParams extends CrudListParams {
  keyword: string;
  spaceId?: number;
  status?: string;
  tagId?: number;
}

export function useWikiDocSearch(params: WikiDocSearchParams, enabled = true) {
  return useQuery({
    queryKey: wikiDocSearchKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<WikiDoc>>(`/api/wiki/docs/search${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && params.keyword.trim().length > 0,
  });
}

/** 搜索点击回报：纯统计上报，不触发任何失效 */
export function useReportWikiSearchClick() {
  return useMutation({
    mutationFn: ({ keyword, docId }: { keyword: string; docId: number }) =>
      request.post<null>('/api/wiki/docs/search/click', { keyword, docId }).then(unwrap),
  });
}

export function useRecentWikiDocs(enabled = true) {
  return useQuery({
    queryKey: wikiDocRecentKey,
    queryFn: () => request.get<WikiDoc[]>('/api/wiki/docs/recent').then(unwrap),
    enabled,
  });
}

export function useWikiDocVersions(docId: number | undefined, params: CrudListParams, enabled = true) {
  return useQuery({
    queryKey: wikiDocVersionKeys.list(docId, params),
    queryFn: () => request.get<PaginatedResponse<WikiDocVersion>>(`/api/wiki/docs/${docId}/versions${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && docId !== undefined,
  });
}

export function useWikiDocVersionDetail(docId: number | undefined, version: number | undefined, enabled = true) {
  return useQuery({
    queryKey: wikiDocVersionKeys.detail(docId, version),
    queryFn: () => request.get<WikiDocVersion>(`/api/wiki/docs/${docId}/versions/${version}`).then(unwrap),
    enabled: enabled && docId !== undefined && version !== undefined,
  });
}

// ─── 非标准变更 ───────────────────────────────────────────────────────────────

/** 移动：树结构与列表的层级列变化，详情的 parentId 变化 */
export function useMoveWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & MoveWikiDocInput) =>
      request.post<WikiDoc>(`/api/wiki/docs/${id}/move`, data).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    },
  });
}

/** 提交发布：状态在树、列表、详情三处可见 */
export function useSubmitWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<WikiDoc>(`/api/wiki/docs/${id}/submit`).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    },
  });
}

/** 审核：待审列表（status 筛选的文档列表）、树、详情联动 */
export function useReviewWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & ReviewWikiDocInput) =>
      request.post<WikiDoc>(`/api/wiki/docs/${id}/review`, data).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    },
  });
}

/** 收藏：详情的 favorited/favoriteCount 与收藏列表 */
export function useFavoriteWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      request.post<null>(`/api/wiki/docs/${id}/favorite`, { favorite }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
    },
  });
}

/** 浏览上报：viewCount 允许陈旧，仅失效「最近访问」 */
export function useRecordWikiDocView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/wiki/docs/${id}/view`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: wikiDocRecentKey });
    },
  });
}

/** 回滚：产生新版本并把文档打回草稿 */
export function useRollbackWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) =>
      request.post<WikiDoc>(`/api/wiki/docs/${id}/rollback`, { version }).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
      void qc.invalidateQueries({ queryKey: wikiDocVersionKeys.of(saved.id) });
    },
  });
}

/** 还原：回收站移出，树与列表恢复展示 */
export function useRestoreWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<WikiDoc>(`/api/wiki/docs/${id}/restore`).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    },
  });
}

/** 彻底删除：实体不复存在，移除详情缓存 */
export function usePurgeWikiDoc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/wiki/docs/${id}/purge`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: wikiDocKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
    },
  });
}
