/**
 * 「成员预览」统一查询：部门 / 角色 / 岗位 / 用户组 → 分页 + 关键字搜索的用户列表。
 *
 * 与各域已有的 `/{id}/members`、`/{id}/users` 是两类东西，不能合并：
 * 那几个返回**全量数组**，供「分配成员」抽屉预选当前成员，改成分页会让预选只勾上第一页。
 * 本模块只服务于列表页「成员」列的查看弹窗，故独立成一套分页接口。
 *
 * 四个域返回同一形状（id / username / nickname / avatar），前端因此只需要一个组件与一套渲染，
 * 不必按来源分支——各域原有 DTO 字段并不一致（岗位只有头像+昵称，用户组另有邮箱与加入时间）。
 */
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { users, userRoles, userPositions, userGroupMembers } from '../../db/schema';
import { keywordCondition, mergeWhere, withPagination } from '../../lib/where-helpers';
import { tenantScope } from '../../lib/tenant';

/** 成员归属范围 */
export type UserScopeType = 'department' | 'role' | 'position' | 'userGroup';

export interface ScopeMemberQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface ScopeMemberItem {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
}

/**
 * 归属条件。
 * 关联表都只有 (userId, xxxId) 两列且以 xxxId 建了索引，用 IN 子查询而非 JOIN：
 * 一个用户在同一范围内只可能出现一次，JOIN 不会放大行数，但子查询让分页的 count
 * 与 list 共用同一条件、少一次连接。
 */
function scopeCondition(scopeType: UserScopeType, scopeId: number): SQL {
  switch (scopeType) {
    case 'department':
      return eq(users.departmentId, scopeId);
    case 'role':
      return inArray(users.id, db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.roleId, scopeId)));
    case 'position':
      return inArray(users.id, db.select({ id: userPositions.userId }).from(userPositions).where(eq(userPositions.positionId, scopeId)));
    case 'userGroup':
      return inArray(users.id, db.select({ id: userGroupMembers.userId }).from(userGroupMembers).where(eq(userGroupMembers.groupId, scopeId)));
    default: {
      // 穷尽性检查：新增范围类型时此处编译失败，避免漏实现后静默返回全部用户
      const exhaustive: never = scopeType;
      throw new Error(`不支持的成员范围：${String(exhaustive)}`);
    }
  }
}

export async function listScopeMembers(
  scopeType: UserScopeType,
  scopeId: number,
  query: ScopeMemberQuery,
): Promise<{ list: ScopeMemberItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const pageSize = Math.min(Math.max(1, Math.trunc(Number(query.pageSize) || 10)), 100);

  const where = mergeWhere(
    and(scopeCondition(scopeType, scopeId), keywordCondition(query.keyword, [users.nickname, users.username])),
    tenantScope(users),
  );

  const [total, list] = await Promise.all([
    db.$count(users, where),
    withPagination(
      db
        .select({ id: users.id, username: users.username, nickname: users.nickname, avatar: users.avatar })
        .from(users)
        .where(where)
        .orderBy(users.id)
        .$dynamic(),
      page,
      pageSize,
    ),
  ]);

  return { list, total, page, pageSize };
}
