/**
 * 「成员预览」查询：部门 / 角色 / 岗位 / 用户组的成员列表（分页 + 关键字搜索）。
 *
 * 供 `UserPreviewCell` 的查看弹窗使用，四个来源共用同一契约形状，组件因此无需按来源分支。
 *
 * key 刻意挂在**所有者域**的既有 `members` 前缀下（如 `['positions','members',id,...]`）：
 * 各页「分配成员」的 mutation 已经在失效 `xxxKeys.members(id)`，前缀匹配天然覆盖本查询，
 * 不必再去改那些 mutation，也不会漏失效导致弹窗显示改前的旧名单。
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { departmentContract, positionContract, roleContract, userGroupContract, type ScopeMember } from '@zenith/shared/identity';
import type { QueryOf } from '@zenith/shared/core';
import { api } from '@/lib/contract-query';

export type { ScopeMember };

/** 成员归属范围，与服务端 `UserScopeType` 一一对应 */
export type UserScopeType = 'department' | 'role' | 'position' | 'userGroup';

export type ScopeMemberParams = NonNullable<QueryOf<typeof roleContract.memberPreview>>;

/** 各范围的契约操作与 query key 根，key 根必须与所有者域的 key 保持同源 */
const SCOPE_CONFIG = {
  department: { op: departmentContract.memberPreview, keyRoot: 'departments' },
  role: { op: roleContract.memberPreview, keyRoot: 'roles' },
  position: { op: positionContract.memberPreview, keyRoot: 'positions' },
  userGroup: { op: userGroupContract.memberPreview, keyRoot: 'user-groups' },
} as const satisfies Record<UserScopeType, { op: unknown; keyRoot: string }>;

export function scopeMemberKey(scopeType: UserScopeType, id: number | undefined, params?: ScopeMemberParams) {
  const base = [SCOPE_CONFIG[scopeType].keyRoot, 'members', id] as const;
  return params ? ([...base, 'preview', params] as const) : base;
}

export function useScopeMembers(
  scopeType: UserScopeType,
  id: number | undefined,
  params: ScopeMemberParams,
  enabled = true,
) {
  return useQuery({
    queryKey: scopeMemberKey(scopeType, id, params),
    queryFn: () => api(SCOPE_CONFIG[scopeType].op, { params: { id: id ?? 0 }, query: params }),
    enabled: enabled && id !== undefined,
    // 翻页/搜索时保留上一页数据，避免表格闪成空态
    placeholderData: keepPreviousData,
  });
}
