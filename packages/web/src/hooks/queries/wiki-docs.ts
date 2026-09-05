import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import type { QueryOf } from '@zenith/shared/core';
import { wikiDocContract, type WikiDoc } from '@zenith/shared/wiki';
import { api, contractKey, createResourceQueries, useApiMutation, useApiQuery } from '@/lib/contract-query';
import { wikiStatsKeys } from './wiki-query-keys';

export type WikiDocListParams = NonNullable<QueryOf<typeof wikiDocContract.list>>;
export type WikiDocSearchParams = NonNullable<QueryOf<typeof wikiDocContract.search>>;
export type WikiDocFavoriteListParams = NonNullable<QueryOf<typeof wikiDocContract.favorites>>;
/** 仅分页参数的子资源列表（版本历史 / 我处理过的审核） */
export type WikiDocPageParams = NonNullable<QueryOf<typeof wikiDocContract.versions>>;

// ─── 独立命名空间的子资源 ─────────────────────────────────────────────────────

/** 目录树：文档中心长期挂载，按空间精确失效 */
export const wikiDocTreeKeys = {
  all: contractKey(wikiDocContract.tree),
  of: (spaceId: number) => contractKey(wikiDocContract.tree, { query: { spaceId } }),
};

/** 版本历史：列表与版本详情按文档分组挂在 versions 操作名下，随文档更新 / 回滚整组失效 */
const versionsPrefix = contractKey(wikiDocContract.versions);
export const wikiDocVersionKeys = {
  of: (docId: number | undefined) => [...versionsPrefix, docId] as const,
  list: (docId: number | undefined, params: WikiDocPageParams) => [...versionsPrefix, docId, params] as const,
  detail: (docId: number | undefined, version: number | undefined) => [...versionsPrefix, docId, 'detail', version] as const,
};

/** 我的收藏（列表变体，独立操作名下，不被文档列表广播打掉） */
export const wikiDocFavoriteKeys = {
  all: contractKey(wikiDocContract.favorites),
};

/** 回收站（列表变体） */
export const wikiDocRecycleKeys = {
  all: contractKey(wikiDocContract.recycle),
};

/** 最近访问（浏览行为驱动，浏览上报后失效） */
export const wikiDocRecentKey = contractKey(wikiDocContract.recent);

/** 审核时间线与已读名单（详情页子资源，随对应动作精确失效） */
export const wikiReviewRecordKeys = {
  of: (docId: number) => contractKey(wikiDocContract.reviewRecords, { params: { id: docId } }),
  processedLists: contractKey(wikiDocContract.processedReviews),
};

export const wikiReadReceiptKeys = {
  of: (docId: number) => contractKey(wikiDocContract.readReceipts, { params: { id: docId } }),
};

export const {
  keys: wikiDocKeys,
  useList: useWikiDocList,
  useDetail: useWikiDocDetail,
  useDelete: useDeleteWikiDocs,
} = createResourceQueries(wikiDocContract, {
  // 删除 = 移入回收站：树、收藏、回收站列表都受影响（ids 无法反查 spaceId，树整组失效）
  onDeleted: (qc) => {
    void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.all });
    void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
    void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
    // 删除会同时改变总量、排行、贡献、沉睡文档与运营分布。
    void qc.invalidateQueries({ queryKey: wikiStatsKeys.all });
  },
});

/** 文档详情组前缀（与工厂 keys.detail(id) 同前缀）：全局协作设置变化时只刷新详情，不波及列表 / 树 */
export const wikiDocDetailPrefix = contractKey(wikiDocContract.detail);

// ─── 查询 ─────────────────────────────────────────────────────────────────────

export function useWikiDocTree(spaceId: number | undefined, enabled = true) {
  return useApiQuery(wikiDocContract.tree, { query: { spaceId: spaceId ?? 0 } }, { enabled: enabled && spaceId !== undefined });
}

export function useMyFavoriteWikiDocs(params: WikiDocFavoriteListParams, enabled = true) {
  return useApiQuery(wikiDocContract.favorites, { query: params }, { placeholderData: keepPreviousData, enabled });
}

export function useWikiDocRecycleList(params: WikiDocListParams) {
  return useApiQuery(wikiDocContract.recycle, { query: params }, { placeholderData: keepPreviousData });
}

export function useWikiDocSearch(params: WikiDocSearchParams, enabled = true) {
  return useApiQuery(wikiDocContract.search, { query: params }, {
    placeholderData: keepPreviousData,
    enabled: enabled && params.keyword.trim().length > 0,
  });
}

/** 搜索点击回报：纯统计上报，不触发任何失效 */
export function useReportWikiSearchClick() {
  return useApiMutation(wikiDocContract.reportSearchClick);
}

export function useRecentWikiDocs(enabled = true) {
  return useApiQuery(wikiDocContract.recent, { enabled });
}

export function useWikiDocVersions(docId: number | undefined, params: WikiDocPageParams, enabled = true) {
  return useQuery({
    queryKey: wikiDocVersionKeys.list(docId, params),
    queryFn: () => api(wikiDocContract.versions, { params: { id: docId ?? 0 }, query: params }),
    placeholderData: keepPreviousData,
    enabled: enabled && docId !== undefined,
  });
}

export function useWikiDocVersionDetail(docId: number | undefined, version: number | undefined, enabled = true) {
  return useQuery({
    queryKey: wikiDocVersionKeys.detail(docId, version),
    queryFn: () => api(wikiDocContract.versionDetail, { params: { id: docId ?? 0, version: version ?? 0 } }),
    enabled: enabled && docId !== undefined && version !== undefined,
  });
}

export function useWikiDocReadReceipts(docId: number | undefined, enabled = true) {
  return useApiQuery(wikiDocContract.readReceipts, { params: { id: docId ?? 0 } }, { enabled: enabled && docId !== undefined });
}

export function useWikiDocReviewRecords(docId: number | undefined, enabled = true) {
  return useApiQuery(wikiDocContract.reviewRecords, { params: { id: docId ?? 0 } }, { enabled: enabled && docId !== undefined });
}

export function useMyProcessedReviews(params: WikiDocPageParams, enabled = true) {
  return useApiQuery(wikiDocContract.processedReviews, { query: params }, { placeholderData: keepPreviousData, enabled });
}

// ─── 保存 ─────────────────────────────────────────────────────────────────────

/** 保存（含正文更新）会改动目录树节点标题 / 状态并产生新版本；新建或正文更新可同时改变文档 / 发布 / 贡献 / 沉睡 / 运营等全部统计 */
function invalidateSavedDoc(qc: QueryClient, saved: WikiDoc) {
  void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
  void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
  void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
  void qc.invalidateQueries({ queryKey: wikiDocVersionKeys.of(saved.id) });
  void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
  void qc.invalidateQueries({ queryKey: wikiStatsKeys.all });
}

/** 创建与更新入参形状不同（更新另带 changeNote / revision / isPinned），分别按契约暴露而不走工厂的 useSave */
export function useCreateWikiDoc() {
  return useApiMutation(wikiDocContract.create, { invalidate: (qc, saved) => invalidateSavedDoc(qc, saved) });
}

export function useUpdateWikiDoc() {
  return useApiMutation(wikiDocContract.update, { invalidate: (qc, saved) => invalidateSavedDoc(qc, saved) });
}

// ─── 非标准变更 ───────────────────────────────────────────────────────────────

/** 状态流转在树、列表、详情三处可见，并改变概览 / 运营统计 */
function invalidateDocStatus(qc: QueryClient, saved: WikiDoc) {
  void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
  void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
  void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
  void qc.invalidateQueries({ queryKey: wikiStatsKeys.overview });
  void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
}

/** 移动：树结构与列表的层级列变化，详情的 parentId 变化 */
export function useMoveWikiDoc() {
  return useApiMutation(wikiDocContract.move, {
    invalidate: (qc, saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
    },
  });
}

/** 提交发布：状态流转 + 该文档的审核时间线 */
export function useSubmitWikiDoc() {
  return useApiMutation(wikiDocContract.submit, {
    invalidate: (qc, saved) => {
      invalidateDocStatus(qc, saved);
      void qc.invalidateQueries({ queryKey: wikiReviewRecordKeys.of(saved.id) });
    },
  });
}

/** 审核：待审列表（status 筛选的文档列表）、树、详情、时间线与「已处理」列表联动 */
export function useReviewWikiDoc() {
  return useApiMutation(wikiDocContract.review, {
    invalidate: (qc, saved) => {
      invalidateDocStatus(qc, saved);
      void qc.invalidateQueries({ queryKey: wikiReviewRecordKeys.of(saved.id) });
      void qc.invalidateQueries({ queryKey: wikiReviewRecordKeys.processedLists });
    },
  });
}

/** 撤回审核：状态流转 + 该文档的审核时间线 */
export function useWithdrawWikiDoc() {
  return useApiMutation(wikiDocContract.withdraw, {
    invalidate: (qc, saved) => {
      invalidateDocStatus(qc, saved);
      void qc.invalidateQueries({ queryKey: wikiReviewRecordKeys.of(saved.id) });
    },
  });
}

/** 收藏：详情的 favorited / favoriteCount 与收藏列表 */
export function useFavoriteWikiDoc() {
  return useApiMutation(wikiDocContract.favorite, {
    invalidate: (qc, _output, { params }) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(params.id) });
      void qc.invalidateQueries({ queryKey: wikiDocFavoriteKeys.all });
    },
  });
}

/** 浏览上报：viewCount 允许陈旧，仅失效「最近访问」 */
export function useRecordWikiDocView() {
  return useApiMutation(wikiDocContract.view, {
    invalidate: (qc) => {
      void qc.invalidateQueries({ queryKey: wikiDocRecentKey });
    },
  });
}

/** 回滚：状态流转（回到草稿）并产生新版本 */
export function useRollbackWikiDoc() {
  return useApiMutation(wikiDocContract.rollback, {
    invalidate: (qc, saved) => {
      invalidateDocStatus(qc, saved);
      void qc.invalidateQueries({ queryKey: wikiDocVersionKeys.of(saved.id) });
    },
  });
}

/** 还原：回收站移出，树与列表恢复展示；与删除相反，会重新进入所有文档派生统计 */
export function useRestoreWikiDoc() {
  return useApiMutation(wikiDocContract.restore, {
    invalidate: (qc, saved) => {
      void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
      void qc.invalidateQueries({ queryKey: wikiDocKeys.lists });
      void qc.invalidateQueries({ queryKey: wikiDocTreeKeys.of(saved.spaceId) });
      void qc.invalidateQueries({ queryKey: wikiStatsKeys.all });
    },
  });
}

/** 彻底删除：实体不复存在，移除详情缓存 */
export function usePurgeWikiDoc() {
  return useApiMutation(wikiDocContract.purge, {
    invalidate: (qc, _output, { params }) => {
      qc.removeQueries({ queryKey: wikiDocKeys.detail(params.id) });
      void qc.invalidateQueries({ queryKey: wikiDocRecycleKeys.all });
    },
  });
}

// ─── 协作 ─────────────────────────────────────────────────────────────────────

/** 订阅：只影响详情的 subscribed 标记 */
export function useSubscribeWikiDoc() {
  return useApiMutation(wikiDocContract.subscribe, {
    invalidate: (qc, _output, { params }) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(params.id) });
    },
  });
}

/** 确认已读：详情的 readConfirmed / readReceiptCount 与已读名单 */
export function useConfirmWikiDocRead() {
  return useApiMutation(wikiDocContract.confirmRead, {
    invalidate: (qc, _output, { params }) => {
      void qc.invalidateQueries({ queryKey: wikiDocKeys.detail(params.id) });
      void qc.invalidateQueries({ queryKey: wikiReadReceiptKeys.of(params.id) });
    },
  });
}
