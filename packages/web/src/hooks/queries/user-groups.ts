import { useQuery } from '@tanstack/react-query';
import { userGroupContract } from '@zenith/shared/identity';
import { api, createResourceQueries, useApiMutation } from '@/lib/contract-query';
import { invalidateCurrentUserAccess } from './menus';
import { userKeys } from './users';

/** 组的成员与角色子查询随组增删一并失效（删除组级联清理关联） */
const MEMBERS_PREFIX = ['user-groups', 'members'] as const;
const ROLES_PREFIX = ['user-groups', 'roles'] as const;

const resource = createResourceQueries(userGroupContract, {
  onSaved: (qc) => {
    void qc.invalidateQueries({ queryKey: MEMBERS_PREFIX });
    void qc.invalidateQueries({ queryKey: ROLES_PREFIX });
  },
  onDeleted: (qc, ids) => {
    for (const id of ids) {
      qc.removeQueries({ queryKey: userGroupKeys.members(id) });
      qc.removeQueries({ queryKey: userGroupKeys.roles(id) });
    }
  },
});

export const userGroupKeys = {
  ...resource.keys,
  members: (id: number | undefined) => [...MEMBERS_PREFIX, id] as const,
  roles: (id: number | undefined) => [...ROLES_PREFIX, id] as const,
};

export const useUserGroupList = resource.useList;
export const useUserGroupDetail = resource.useDetail;
export const useSaveUserGroup = resource.useSave;
export const useDeleteUserGroups = resource.useDelete;

export function useAllUserGroups(options?: { enabled?: boolean }) {
  return resource.useLookup(options?.enabled ?? true);
}

export function useUserGroupMembers(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userGroupKeys.members(id),
    queryFn: () => api(userGroupContract.members, { params: { id: id ?? 0 } }),
    enabled: enabled && id !== undefined,
  });
}

export function useAssignUserGroupMembers() {
  return useApiMutation(userGroupContract.setMembers, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: userGroupKeys.all }),
  });
}

export function useUserGroupRoles(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: userGroupKeys.roles(id),
    queryFn: () => api(userGroupContract.roles, { params: { id: id ?? 0 } }),
    enabled: enabled && id !== undefined,
  });
}

export function useAssignUserGroupRoles() {
  return useApiMutation(userGroupContract.setRoles, {
    invalidate: (qc) => {
      void qc.invalidateQueries({ queryKey: userGroupKeys.all });
      // 组角色变化影响成员的继承权限展示，也可能覆盖当前登录者
      void qc.invalidateQueries({ queryKey: userKeys.all });
      invalidateCurrentUserAccess(qc);
    },
  });
}

/** 规则 dry-run：纯计算不落库，无需失效任何缓存 */
export function useUserGroupRulePreview() {
  return useApiMutation(userGroupContract.rulePreview);
}

/** 手动同步动态组成员：成员/列表变化，且组可能绑定角色影响当前登录者权限 */
export function useSyncUserGroup() {
  return useApiMutation(userGroupContract.sync, {
    invalidate: (qc) => {
      void qc.invalidateQueries({ queryKey: userGroupKeys.all });
      invalidateCurrentUserAccess(qc);
    },
  });
}
