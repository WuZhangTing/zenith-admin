import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';

/**
 * 标准 CRUD 域的查询/变更 hooks 工厂。
 *
 * ## 为什么需要它
 * `hooks/queries/` 下 160 个域文件里，159 个都在手抄同一套形状：`xxxKeys` 四件套、
 * 带 `keepPreviousData` 的列表查询、详情查询、「无 id 走 POST / 有 id 走 PUT」的保存、
 * 以及「单条走 /:id、多条走 /batch」的删除。手抄的代价不是行数，而是**失效契约会被漏写**：
 * 保存后忘记失效 `lists`，页面表现为「保存成功但列表没变」；删除后忘记 `removeQueries`
 * 详情缓存，重新打开编辑弹窗会闪出已删除的旧数据。两者都不报错，只能靠人工 review 发现。
 *
 * 工厂把这套失效契约焊死在一处：调用方拿到的 hooks 天然正确。
 *
 * ## 非标准需求怎么办
 * 工厂只覆盖标准形状。域内的特殊接口（分配菜单、导入导出、状态切换等）继续在同一个
 * 域文件里手写 `useMutation`，用工厂导出的 `keys` 做失效即可——**不要**为了套用工厂
 * 去改造后端接口形状。
 *
 * @example
 * ```ts
 * export const {
 *   keys: tenantPackageKeys,
 *   useList: useTenantPackageList,
 *   useDetail: useTenantPackageDetail,
 *   useSave: useSaveTenantPackage,
 *   useDelete: useDeleteTenantPackages,
 *   useLookup: useAllTenantPackages,
 * } = createCrudQueries<TenantPackage, TenantPackageListParams>({
 *   resource: 'tenant-packages',
 *   lookup: true,
 * });
 * ```
 */

/** 列表查询参数的最小约定 */
export interface CrudListParams {
  page: number;
  pageSize: number;
}

export interface CrudQueryKeys<TListParams> {
  readonly all: readonly string[];
  /** 全部列表查询的公共前缀，用于「任意条件下的列表都失效」 */
  readonly lists: readonly string[];
  readonly list: (params: TListParams) => readonly unknown[];
  readonly detail: (id: number | undefined) => readonly unknown[];
  /** 下拉源（全量精简列表） */
  readonly lookup: readonly string[];
}

export interface CreateCrudQueriesOptions<TEntity, TListParams> {
  /** 资源名，同时用作 query key 前缀与默认接口路径，例：`tenant-packages` */
  readonly resource: string;
  /** 接口基础路径，默认 `/api/{resource}` */
  readonly path?: string;
  /** 是否提供下拉源 hook；传 string 时作为子路径，默认子路径 `all` */
  readonly lookup?: boolean | string;
  /**
   * 删除接口形态：
   * - `'batch'`（默认）单条走 `DELETE /:id`，多条走 `DELETE /batch`
   * - `'single'` 仅支持单条，多条时并发发起
   */
  readonly deleteMode?: 'batch' | 'single';
  /** 保存成功后的额外失效（跨域联动，如菜单变更影响当前用户可访问范围） */
  readonly onSaved?: (qc: QueryClient, saved: TEntity) => void;
  /** 删除成功后的额外失效 */
  readonly onDeleted?: (qc: QueryClient, ids: number[]) => void;
  /** 列表查询的额外选项 */
  readonly listStaleTime?: number;
  /** 供 useList 使用的自定义查询串构造（默认 toQueryString） */
  readonly buildQuery?: (params: TListParams) => string;
}

export interface CrudQueries<TEntity, TListParams, TValues, TLookup> {
  readonly keys: CrudQueryKeys<TListParams>;
  readonly useList: (params: TListParams, enabled?: boolean) => ReturnType<typeof useQuery<PaginatedResponse<TEntity>>>;
  readonly useDetail: (id: number | undefined, enabled?: boolean) => ReturnType<typeof useQuery<TEntity>>;
  readonly useSave: () => ReturnType<typeof useMutation<TEntity, Error, { id?: number; values: TValues }>>;
  readonly useDelete: () => ReturnType<typeof useMutation<null, Error, number[]>>;
  readonly useLookup: (enabled?: boolean) => ReturnType<typeof useQuery<TLookup[]>>;
}

export function createCrudQueries<
  TEntity extends { id: number },
  TListParams extends CrudListParams = CrudListParams,
  TValues = Partial<TEntity>,
  /** 下拉源接口通常只返回 id/name/status 等精简字段，故与实体类型分开 */
  TLookup = TEntity,
>(
  options: CreateCrudQueriesOptions<TEntity, TListParams>,
): CrudQueries<TEntity, TListParams, TValues, TLookup> {
  const {
    resource,
    path = `/api/${options.resource}`,
    lookup = false,
    deleteMode = 'batch',
    onSaved,
    onDeleted,
    listStaleTime,
    buildQuery = (p: TListParams) => toQueryString(p),
  } = options;

  const lookupPath = typeof lookup === 'string' ? lookup : 'all';

  const keys: CrudQueryKeys<TListParams> = {
    all: [resource],
    lists: [resource, 'list'],
    list: (params) => [resource, 'list', params] as const,
    detail: (id) => [resource, 'detail', id] as const,
    lookup: [resource, 'all'],
  };

  /** 保存/删除后的标准失效：列表一定失效，详情按 id 精确失效，下拉源可能含名称 */
  function invalidateCommon(qc: QueryClient) {
    void qc.invalidateQueries({ queryKey: keys.lists });
    if (lookup) void qc.invalidateQueries({ queryKey: keys.lookup });
  }

  function useList(params: TListParams, enabled = true) {
    return useQuery({
      queryKey: keys.list(params),
      queryFn: () => request.get<PaginatedResponse<TEntity>>(`${path}${buildQuery(params)}`).then(unwrap),
      // 翻页/改条件时保留上一页数据，避免表格闪空
      placeholderData: keepPreviousData,
      staleTime: listStaleTime,
      enabled,
    });
  }

  function useDetail(id: number | undefined, enabled = true) {
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: () => request.get<TEntity>(`${path}/${id}`).then(unwrap),
      enabled: enabled && id !== undefined,
    });
  }

  function useSave() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, values }: { id?: number; values: TValues }) =>
        (id === undefined
          ? request.post<TEntity>(path, values as object)
          : request.put<TEntity>(`${path}/${id}`, values as object)
        ).then(unwrap),
      onSuccess: (saved) => {
        void qc.invalidateQueries({ queryKey: keys.detail(saved.id) });
        invalidateCommon(qc);
        onSaved?.(qc, saved);
      },
    });
  }

  function useDelete() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (ids: number[]) => {
        if (deleteMode === 'single' || ids.length === 1) {
          const reqs = ids.map((id) => request.delete<null>(`${path}/${id}`).then(unwrap));
          return Promise.all(reqs).then(() => null);
        }
        return request.delete<null>(`${path}/batch`, { ids }).then(unwrap);
      },
      onSuccess: (_data, ids) => {
        // 详情缓存必须移除而非失效：失效会让已删除记录在下次挂载时重新请求并 404
        for (const id of ids) qc.removeQueries({ queryKey: keys.detail(id) });
        invalidateCommon(qc);
        onDeleted?.(qc, ids);
      },
    });
  }

  function useLookup(enabled = true) {
    return useQuery({
      queryKey: keys.lookup,
      queryFn: () => request.get<TLookup[]>(`${path}/${lookupPath}`).then(unwrap),
      staleTime: LOOKUP_STALE_TIME,
      enabled: enabled && Boolean(lookup),
    });
  }

  return { keys, useList, useDetail, useSave, useDelete, useLookup };
}
