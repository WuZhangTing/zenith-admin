import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import { userContract } from '@zenith/shared/identity';
import type { Announcement, AnnouncementAttachment, AnnouncementReadStats, AnnouncementRecipient } from '@zenith/shared/messaging';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { api } from '@/lib/contract-query';
import { useAllRoles } from './roles';
import { useFlatDepartments } from './departments';

export interface AnnouncementListParams {
  page: number;
  pageSize: number;
  title?: string;
  type?: string;
  publishStatus?: string;
  startTime?: string;
  endTime?: string;
}

export type AnnouncementDetail = Announcement & {
  recipients: AnnouncementRecipient[];
  attachments: AnnouncementAttachment[];
};

export interface AnnouncementStatsParams {
  id: number | undefined;
  tab: 'read' | 'unread';
  page: number;
  pageSize: number;
}

export type MyAnnouncement = Announcement & { isRead: boolean };

export interface MyAnnouncementListParams {
  page: number;
  pageSize: number;
  isRead?: string;
}

export const announcementKeys = {
  all: ['announcements'] as const,
  lists: ['announcements', 'list'] as const,
  list: (params: AnnouncementListParams) => ['announcements', 'list', params] as const,
  detail: (id: number | undefined) => ['announcements', 'detail', id] as const,
  my: ['announcements', 'my'] as const,
  myLists: ['announcements', 'my', 'list'] as const,
  myList: (params: MyAnnouncementListParams) => ['announcements', 'my', 'list', params] as const,
  myDetail: (id: number | undefined) => ['announcements', 'my', 'detail', id] as const,
  readStatsAll: ['announcements', 'read-stats'] as const,
  readStats: (params: AnnouncementStatsParams) => ['announcements', 'read-stats', params] as const,
  userSearch: (keyword: string) => ['announcements', 'user-search', keyword] as const,
  /** 顶栏公告铃铛未读数 */
  myUnreadCount: ['announcements', 'my', 'unread-count'] as const,
  /** 顶栏公告气泡里的已发布公告 */
  published: ['announcements', 'my', 'published'] as const,
};

/** 我的公告未读数（顶栏铃铛 badge） */
export function useMyAnnouncementUnreadCount() {
  return useQuery({
    queryKey: announcementKeys.myUnreadCount,
    queryFn: () => request.get<{ count: number }>('/api/announcements/unread-count', { silent: true }).then(unwrap),
    select: (data) => data?.count ?? 0,
  });
}

/** 顶栏气泡里的最近已发布公告（含本人已读标记） */
export function usePublishedAnnouncements() {
  return useQuery({
    queryKey: announcementKeys.published,
    queryFn: () => request.get<(Announcement & { isRead: boolean })[]>('/api/announcements/published', { silent: true }).then(unwrap),
  });
}

export function useAnnouncementList(params: AnnouncementListParams) {
  return useQuery({
    queryKey: announcementKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<Announcement>>(`/api/announcements${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useAnnouncementDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: () => request.get<AnnouncementDetail>(`/api/announcements/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useMyAnnouncementList(params: MyAnnouncementListParams) {
  return useQuery({
    queryKey: announcementKeys.myList(params),
    queryFn: () =>
      request.get<PaginatedResponse<MyAnnouncement>>(`/api/announcements/inbox${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

/**
 * 我的公告详情。
 *
 * `silent` 供工作台等挂件场景使用：失败时不弹 toast，由调用方回退到列表数据；
 * 收件箱页是用户显式打开详情，保持默认的错误提示。
 */
export function useMyAnnouncementDetail(id: number | undefined, enabled = true, silent = false) {
  return useQuery({
    queryKey: announcementKeys.myDetail(id),
    queryFn: () => request.get<Announcement>(`/api/announcements/${id}`, { silent }).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useMarkMyAnnouncementRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/announcements/${id}/read`, undefined, { silent: true }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
      // 管理端的已读统计随之变化；该页在另一路由，未挂载时仅标脏
      void qc.invalidateQueries({ queryKey: announcementKeys.readStatsAll });
    },
  });
}

export function useMarkAllMyAnnouncementsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<null>('/api/announcements/read-all', {}).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
      void qc.invalidateQueries({ queryKey: announcementKeys.readStatsAll });
    },
  });
}

export function useAnnouncementReadStats(params: AnnouncementStatsParams, enabled = true) {
  return useQuery({
    queryKey: announcementKeys.readStats(params),
    queryFn: () =>
      request
        .get<AnnouncementReadStats>(
          `/api/announcements/${params.id}/read-stats${toQueryString({
            tab: params.tab,
            page: params.page,
            pageSize: params.pageSize,
          })}`,
        )
        .then(unwrap),
    placeholderData: keepPreviousData,
    enabled: enabled && params.id !== undefined,
  });
}

/**
 * 收件人选项（角色 + 部门）。
 *
 * 数据实际归属 roles / departments 域，故直接复用两个域的共享 lookup，
 * 而不是在 announcementKeys 下另起炉灶——否则角色或部门被增删改后，
 * 这份缓存没有任何来源会失效它，会静默显示旧的角色/部门列表。
 */
export function useAnnouncementRecipientOptions(enabled = true) {
  const rolesQuery = useAllRoles({ enabled });
  const departmentsQuery = useFlatDepartments({ enabled });

  const data = useMemo(() => {
    if (!rolesQuery.data && !departmentsQuery.data) return undefined;
    return {
      roles: (rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
      departments: (departmentsQuery.data ?? []).map((d) => ({ value: d.id, label: d.name })),
    };
  }, [rolesQuery.data, departmentsQuery.data]);

  return {
    data,
    isFetching: rolesQuery.isFetching || departmentsQuery.isFetching,
    isSuccess: rolesQuery.isSuccess && departmentsQuery.isSuccess,
  };
}

export function useAnnouncementUserSearch(keyword: string, enabled = true) {
  return useQuery({
    queryKey: announcementKeys.userSearch(keyword),
    queryFn: () =>
      // 用户列表按 keyword 匹配用户名 / 昵称 / 邮箱
      api(userContract.list, { query: { page: 1, pageSize: 20, keyword } })
        .then((data) => data.list.map((u) => ({ value: u.id, label: `${u.nickname}（${u.username}）` }))),
    staleTime: LOOKUP_STALE_TIME,
    enabled: enabled && keyword.trim().length > 0,
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<Announcement>('/api/announcements', values)
        : request.put<Announcement>(`/api/announcements/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      // 写接口返回的是公告主体，不含 recipients / attachments（详情接口才有），
      // 形状不一致，不能回填，只能失效
      void qc.invalidateQueries({ queryKey: announcementKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: announcementKeys.lists });
      // 发布/改内容会改变各用户收件箱；收件箱在另一路由，未挂载时仅标脏，代价接近零
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
      // 不碰 recipientOptions / userSearch：保存时弹窗尚未关闭，它们仍是活跃查询，
      // 而角色、部门、用户三份数据与本次保存无关
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/announcements/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: announcementKeys.detail(id) });
      qc.removeQueries({ queryKey: announcementKeys.myDetail(id) });
      void qc.invalidateQueries({ queryKey: announcementKeys.lists });
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
    },
  });
}

export function useBatchDeleteAnnouncements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.delete<null>('/api/announcements/batch', { ids }).then(unwrap),
    onSuccess: (_data, ids) => {
      for (const id of ids) {
        qc.removeQueries({ queryKey: announcementKeys.detail(id) });
        qc.removeQueries({ queryKey: announcementKeys.myDetail(id) });
      }
      void qc.invalidateQueries({ queryKey: announcementKeys.lists });
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
    },
  });
}

export function useUpdateAnnouncementStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<Announcement> }) =>
      request.put<Announcement>(`/api/announcements/${id}`, values).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: announcementKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: announcementKeys.lists });
      // 上下架直接决定公告是否出现在收件箱
      void qc.invalidateQueries({ queryKey: announcementKeys.my });
    },
  });
}
