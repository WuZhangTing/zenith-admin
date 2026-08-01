import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { Role, User } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { invalidateCurrentUserAccess } from './menus';

export interface RoleListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const roleKeys = {
  all: ['roles'] as const,
  lists: ['roles', 'list'] as const,
  list: (params: RoleListParams) => ['roles', 'list', params] as const,
  detail: (id: number | undefined) => ['roles', 'detail', id] as const,
  users: (roleId: number | undefined) => ['roles', 'users', roleId] as const,
  allRoles: ['roles', 'all'] as const,
};

export function useRoleList(params: RoleListParams) {
  return useQuery({
    queryKey: roleKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<Role>>(`/api/roles${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useRoleDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => request.get<Role>(`/api/roles/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useRoleUsers(roleId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: roleKeys.users(roleId),
    queryFn: () => request.get<User[]>(`/api/roles/${roleId}/users`).then(unwrap),
    enabled: enabled && roleId !== undefined,
  });
}

export function useAllRoles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: roleKeys.allRoles,
    queryFn: () => request.get<Role[]>('/api/roles/all').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
    enabled: options?.enabled ?? true,
  });
}

export function useSaveRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<Role> }) =>
      (id === undefined
        ? request.post<Role>('/api/roles', values)
        : request.put<Role>(`/api/roles/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      // 写接口返回的 mapRole 不带 menuIds（详情才查关联菜单），形状不一致，不能回填
      void qc.invalidateQueries({ queryKey: roleKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: roleKeys.lists });
      // 角色下拉源渲染名称，且被公告收件人等跨域页面复用
      void qc.invalidateQueries({ queryKey: roleKeys.allRoles });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/roles/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: roleKeys.detail(id) });
      qc.removeQueries({ queryKey: roleKeys.users(id) });
      void qc.invalidateQueries({ queryKey: roleKeys.lists });
      void qc.invalidateQueries({ queryKey: roleKeys.allRoles });
    },
  });
}

export function useAssignRoleMenus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, menuIds }: { id: number; menuIds: number[] }) =>
      request.put<null>(`/api/roles/${id}/menus`, { menuIds }).then(unwrap),
    // menuIds 只存在于角色详情，列表与下拉源都不含；角色授权可能覆盖当前登录者
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: roleKeys.detail(id) });
      invalidateCurrentUserAccess(qc);
    },
  });
}

export function useAssignRoleUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) =>
      request.put<null>(`/api/roles/${id}/users`, { userIds }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: roleKeys.users(id) });
      // 列表展示 userCount / userPreview
      void qc.invalidateQueries({ queryKey: roleKeys.lists });
    },
  });
}

export function useUpdateRoleDataScope() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: Partial<Role> }) =>
      request.put<Role>(`/api/roles/${id}`, values).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: roleKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: roleKeys.lists });
    },
  });
}
