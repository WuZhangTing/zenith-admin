import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { User } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { invalidateCurrentUserAccess } from './menus';

export interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  phone?: string;
  departmentId?: number;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export interface ImportUsersResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface UserDataPermission {
  userDataScope: string | null;
  deptScopeIds: number[];
  roleDataScope: string | null;
  roleDeptScopeIds: number[];
  groupDataScope: string | null;
  groupDeptScopeIds: number[];
  groups: Array<{ id: number; name: string }>;
}

export interface UserEffectivePermissions {
  directMenuIds: number[];
  roleMenuIds: number[];
  groupMenuIds: number[];
  effectiveMenuIds: number[];
  groups: Array<{ id: number; name: string }>;
}

export const userKeys = {
  all: ['users'] as const,
  allUsers: ['users', 'all'] as const,
  lists: ['users', 'list'] as const,
  list: (params: UserListParams) => ['users', 'list', params] as const,
  detail: (id: number | undefined) => ['users', 'detail', id] as const,
  dataPermission: (userId: number | undefined) => ['users', 'data-permission', userId] as const,
  effectivePermissions: (userId: number | undefined) => ['users', 'effective-permissions', userId] as const,
};

/** 全量用户下拉源（角色分配、岗位成员、用户组等场景全局共享缓存） */
export function allUsersQueryOptions() {
  return queryOptions({
    queryKey: userKeys.allUsers,
    queryFn: () => request.get<User[]>('/api/users/all').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useAllUsers(options?: { enabled?: boolean }) {
  return useQuery({
    ...allUsersQueryOptions(),
    enabled: options?.enabled ?? true,
  });
}

export function useUserList(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<User>>(`/api/users${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useUserDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => request.get<User>(`/api/users/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined ? request.post<User>('/api/users', values) : request.put<User>(`/api/users/${id}`, values)).then(unwrap),
    onSuccess: (_data, { id }) => {
      // 刻意不回填详情：写接口返回 mapUser（未脱敏），详情走 mapUserWithMask（按查看者角色脱敏），
      // 用响应覆盖详情缓存会把未脱敏的手机号/邮箱写进本不该看到它们的界面
      if (id !== undefined) void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      // 下拉源展示昵称与用户名，且被角色分配、岗位成员、用户组等多页共享
      void qc.invalidateQueries({ queryKey: userKeys.allUsers });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/users/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: userKeys.detail(id) });
      qc.removeQueries({ queryKey: userKeys.dataPermission(id) });
      qc.removeQueries({ queryKey: userKeys.effectivePermissions(id) });
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      void qc.invalidateQueries({ queryKey: userKeys.allUsers });
    },
  });
}

export function useBatchDeleteUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => request.delete<null>('/api/users/batch', { ids }).then(unwrap),
    onSuccess: (_data, ids) => {
      for (const id of ids) {
        qc.removeQueries({ queryKey: userKeys.detail(id) });
        qc.removeQueries({ queryKey: userKeys.dataPermission(id) });
        qc.removeQueries({ queryKey: userKeys.effectivePermissions(id) });
      }
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      void qc.invalidateQueries({ queryKey: userKeys.allUsers });
    },
  });
}

export function useBatchUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: 'enabled' | 'disabled'; id?: number }) =>
      request.put<null>('/api/users/batch-status', { ids, status }).then(unwrap),
    onSuccess: (_data, { ids }) => {
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      for (const id of ids) void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      request.put<null>(`/api/users/${id}/password`, { password }).then(unwrap),
    // 密码不出现在任何已挂载的查询里；列表的「最后修改时间」等字段仍可能变，故只刷列表与该用户详情
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: userKeys.lists });
    },
  });
}

export function useBatchUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, password }: { ids: number[]; password: string }) =>
      request.put<null>('/api/users/batch-password', { ids, password }).then(unwrap),
    onSuccess: (_data, { ids }) => {
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      for (const id of ids) void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
    },
  });
}

export function useUnlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<null>(`/api/users/${id}/unlock`, {}).then(unwrap),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: userKeys.lists });
    },
  });
}

export function useAssignUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleIds }: { id: number; roleIds: number[] }) =>
      request.put<null>(`/api/users/${id}/roles`, { roleIds }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: userKeys.detail(id) });
      // 列表展示角色名
      void qc.invalidateQueries({ queryKey: userKeys.lists });
      // 角色决定可见菜单
      void qc.invalidateQueries({ queryKey: userKeys.effectivePermissions(id) });
    },
  });
}

export function useImportUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (percent: number) => void }) =>
      request.postForm<ImportUsersResult>('/api/users/import', formData, { onProgress }).then(unwrap),
    // 批量导入会新增未知数量的用户，无法逐条定位，全域失效并注明理由
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useKickUserSessions() {
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/sessions/user/${id}`).then(unwrap),
  });
}

export function useUserDataPermission(userId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userKeys.dataPermission(userId),
    queryFn: () => request.get<UserDataPermission>(`/api/users/${userId}/data-permission`).then(unwrap),
    enabled: enabled && userId !== undefined,
  });
}

export function useSaveUserDataPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, dataScope, deptScopeIds }: { userId: number; dataScope: string | null; deptScopeIds: number[] }) =>
      request.put<null>(`/api/users/${userId}/data-permission`, { dataScope, deptScopeIds }).then(unwrap),
    // 数据权限自成一份查询，不出现在列表与详情
    onSuccess: (_data, { userId }) => qc.invalidateQueries({ queryKey: userKeys.dataPermission(userId) }),
  });
}

export function useSaveUserMenus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, menuIds }: { userId: number; menuIds: number[] }) =>
      request.put<null>(`/api/users/${userId}/menus`, { menuIds }).then(unwrap),
    // 直接授权菜单改变该用户的有效权限视图；若改到自己，导航树与权限码需同步刷新
    onSuccess: (_data, { userId }) => {
      void qc.invalidateQueries({ queryKey: userKeys.effectivePermissions(userId) });
      invalidateCurrentUserAccess(qc);
    },
  });
}

export function useUserEffectivePermissions(userId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userKeys.effectivePermissions(userId),
    queryFn: () => request.get<UserEffectivePermissions>(`/api/users/${userId}/effective-permissions`).then(unwrap),
    enabled: enabled && userId !== undefined,
  });
}
