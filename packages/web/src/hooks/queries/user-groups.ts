import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserGroup } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import { invalidateCurrentUserAccess } from './menus';
import { userKeys } from './users';

export interface UserGroupListParams extends CrudListParams {
  keyword?: string;
  status?: string;
}

export interface GroupMember {
  id: number;
  username: string;
  nickname: string;
  avatar?: string | null;
  email?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  joinedAt: string;
}

/** 组的成员与角色子查询随组增删一并失效（删除组级联清理关联） */
const MEMBERS_PREFIX = ['user-groups', 'members'] as const;
const ROLES_PREFIX = ['user-groups', 'roles'] as const;

const crud = createCrudQueries<UserGroup, UserGroupListParams>({
  resource: 'user-groups',
  onSaved: (qc) => {
    void qc.invalidateQueries({ queryKey: MEMBERS_PREFIX });
    void qc.invalidateQueries({ queryKey: ROLES_PREFIX });
  },
  onDeleted: (qc, ids) => {
    for (const id of ids) {
      qc.removeQueries({ queryKey: ['user-groups', 'members', id] });
      qc.removeQueries({ queryKey: ['user-groups', 'roles', id] });
    }
  },
});

export const userGroupKeys = {
  ...crud.keys,
  members: (id: number | undefined) => ['user-groups', 'members', id] as const,
  roles: (id: number | undefined) => ['user-groups', 'roles', id] as const,
};

export const useUserGroupList = crud.useList;
export const useUserGroupDetail = crud.useDetail;
export const useSaveUserGroup = crud.useSave;
export const useDeleteUserGroups = crud.useDelete;

export function useUserGroupMembers(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userGroupKeys.members(id),
    queryFn: () => request.get<GroupMember[]>(`/api/user-groups/${id}/members`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useAssignUserGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: number; userIds: number[] }) =>
      request.put<null>(`/api/user-groups/${id}/members`, { userIds }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: userGroupKeys.all }),
  });
}

export interface UserGroupRole {
  id: number;
  name: string;
  code: string;
  status: 'enabled' | 'disabled';
}

export function useUserGroupRoles(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userGroupKeys.roles(id),
    queryFn: () => request.get<UserGroupRole[]>(`/api/user-groups/${id}/roles`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useAssignUserGroupRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleIds }: { id: number; roleIds: number[] }) =>
      request.put<null>(`/api/user-groups/${id}/roles`, { roleIds }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userGroupKeys.all });
      // 组角色变化影响成员的继承权限展示，也可能覆盖当前登录者
      void qc.invalidateQueries({ queryKey: userKeys.all });
      invalidateCurrentUserAccess(qc);
    },
  });
}
