import { http } from 'msw';
import { ok, badRequest, notFound, conflict, pageParams } from '@/mocks/utils/handlers';
import { mockUserGroups, getNextUserGroupId } from '@/mocks/data/user-groups';
import { mockUsers } from '@/mocks/data/users';
import { mockRoles } from '@/mocks/data/roles';
import { mockDateTime } from '@/mocks/utils/date';
import type { UserGroup, UserGroupMemberRule } from '@zenith/shared/identity';

interface CreateBody {
  name: string;
  code: string;
  description?: string;
  ownerId?: number | null;
  status?: 'enabled' | 'disabled';
  memberMode?: 'static' | 'dynamic';
  memberRule?: UserGroupMemberRule | null;
}

/** Demo 简化版规则求值：仅按部门（不展开子树层级差异）与强制名单计算 */
function evaluateRule(rule: UserGroupMemberRule): number[] {
  const target = new Set<number>();
  if (rule.departmentIds?.length) {
    for (const u of mockUsers) {
      if (u.status === 'enabled' && u.departmentId != null && rule.departmentIds.includes(u.departmentId)) {
        target.add(u.id);
      }
    }
  }
  for (const id of rule.includeUserIds ?? []) target.add(id);
  for (const id of rule.excludeUserIds ?? []) target.delete(id);
  return [...target];
}

function publicView(g: typeof mockUserGroups[number]): UserGroup {
  const { memberIds: _memberIds, roleIds: _roleIds, ...rest } = g;
  const memberPreview = g.memberIds.slice(0, 5).map((uid) => {
    const u = mockUsers.find((mu) => mu.id === uid);
    return u ? { id: u.id, nickname: u.nickname, avatar: u.avatar ?? null } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  return { ...rest, memberCount: g.memberIds.length, memberPreview, roleCount: g.roleIds.length };
}

export const userGroupsHandlers = [
  http.get('/api/user-groups/all', () =>
    ok(mockUserGroups.map(publicView))),

  // 规则 dry-run（必须先于 /:id 注册）
  http.post('/api/user-groups/rule-preview', async ({ request }) => {
    const body = await request.json() as { groupId?: number; memberRule: UserGroupMemberRule };
    const target = evaluateRule(body.memberRule ?? {});
    const current = body.groupId != null
      ? (mockUserGroups.find((g) => g.id === body.groupId)?.memberIds ?? [])
      : [];
    const currentSet = new Set(current);
    const targetSet = new Set(target);
    const joining = target.filter((id) => !currentSet.has(id));
    const leaving = current.filter((id) => !targetSet.has(id));
    const brief = (id: number) => {
      const u = mockUsers.find((mu) => mu.id === id);
      return { id, username: u?.username ?? `#${id}`, nickname: u?.nickname ?? `#${id}` };
    };
    return ok({
      total: target.length,
      joiningCount: joining.length,
      leavingCount: leaving.length,
      joining: joining.slice(0, 50).map(brief),
      leaving: leaving.slice(0, 50).map(brief),
    });
  }),

  http.get('/api/user-groups', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url);

    const filtered = mockUserGroups.filter((g) => {
      if (keyword && !g.name.includes(keyword) && !g.code.includes(keyword)) return false;
      if (status && g.status !== status) return false;
      return true;
    });
    const total = filtered.length;
    const list = filtered.slice((page - 1) * pageSize, page * pageSize).map(publicView);
    return ok({ list, total, page, pageSize });
  }),

  http.get('/api/user-groups/:id/members', ({ params }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    const members = grp.memberIds.map((uid) => {
      const u = mockUsers.find((mu) => mu.id === uid);
      return u
        ? { id: u.id, username: u.username, nickname: u.nickname, email: u.email, departmentName: null, joinedAt: grp.createdAt }
        : null;
    }).filter(Boolean);
    return ok(members);
  }),

  http.put('/api/user-groups/:id/members', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    if (grp.memberMode === 'dynamic') return badRequest('动态用户组的成员由规则自动维护，请通过编辑规则调整（支持强制包含/排除名单）');
    const body = await request.json() as { userIds: number[] };
    grp.memberIds = Array.isArray(body?.userIds) ? body.userIds : [];
    grp.memberCount = grp.memberIds.length;
    grp.updatedAt = mockDateTime();
    return ok(null, '保存成功');
  }),

  http.post('/api/user-groups/:id/members', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    if (grp.memberMode === 'dynamic') return badRequest('动态用户组的成员由规则自动维护，请通过编辑规则调整（支持强制包含/排除名单）');
    const body = await request.json() as { userIds: number[] };
    const set = new Set(grp.memberIds);
    (body?.userIds ?? []).forEach((id) => set.add(id));
    grp.memberIds = [...set];
    grp.memberCount = grp.memberIds.length;
    return ok(null, '添加成功');
  }),

  http.delete('/api/user-groups/:id/members', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    if (grp.memberMode === 'dynamic') return badRequest('动态用户组的成员由规则自动维护，请通过编辑规则调整（支持强制包含/排除名单）');
    const body = await request.json() as { userIds: number[] };
    const remove = new Set(body?.userIds ?? []);
    grp.memberIds = grp.memberIds.filter((id) => !remove.has(id));
    grp.memberCount = grp.memberIds.length;
    return ok(null, '移除成功');
  }),

  // 手动同步动态组成员
  http.post('/api/user-groups/:id/sync', ({ params }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    if (grp.memberMode !== 'dynamic') return badRequest('仅动态用户组支持手动同步');
    const target = evaluateRule(grp.memberRule ?? {});
    const before = new Set(grp.memberIds);
    const added = target.filter((id) => !before.has(id)).length;
    const removed = grp.memberIds.filter((id) => !target.includes(id)).length;
    grp.memberIds = target;
    grp.memberCount = target.length;
    grp.ruleSyncedAt = mockDateTime();
    return ok(null, `同步完成：加入 ${added} 人，移除 ${removed} 人`);
  }),

  http.get('/api/user-groups/:id/roles', ({ params }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    const list = grp.roleIds
      .map((rid) => mockRoles.find((r) => r.id === rid))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => ({ id: r.id, name: r.name, code: r.code, status: r.status }));
    return ok(list);
  }),

  http.put('/api/user-groups/:id/roles', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    const body = await request.json() as { roleIds: number[] };
    grp.roleIds = Array.isArray(body?.roleIds) ? body.roleIds : [];
    grp.roleCount = grp.roleIds.length;
    grp.updatedAt = mockDateTime();
    return ok(null, '保存成功');
  }),

  http.get('/api/user-groups/:id', ({ params }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    return ok(publicView(grp));
  }),

  http.post('/api/user-groups', async ({ request }) => {
    const body = await request.json() as CreateBody;
    if (mockUserGroups.some((g) => g.code === body.code)) {
      return badRequest('用户组编码已存在');
    }
    const now = mockDateTime();
    const memberMode = body.memberMode ?? 'static';
    const memberRule = memberMode === 'dynamic' ? (body.memberRule ?? null) : null;
    const memberIds = memberMode === 'dynamic' && memberRule ? evaluateRule(memberRule) : [];
    const created = {
      id: getNextUserGroupId(),
      name: body.name,
      code: body.code,
      description: body.description ?? null,
      ownerId: body.ownerId ?? null,
      ownerName: null,
      memberMode,
      memberRule,
      ruleSyncedAt: memberMode === 'dynamic' ? now : null,
      memberCount: memberIds.length,
      memberIds,
      roleIds: [],
      roleCount: 0,
      status: body.status ?? 'enabled',
      createdAt: now,
      updatedAt: now,
    };
    mockUserGroups.push(created);
    return ok(publicView(created), '创建成功');
  }),

  http.put('/api/user-groups/:id', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
    const body = await request.json() as Partial<CreateBody>;
    Object.assign(grp, body, { updatedAt: mockDateTime() });
    if (grp.memberMode === 'static') {
      grp.memberRule = null;
    } else if (body.memberRule !== undefined || body.memberMode !== undefined) {
      grp.memberIds = evaluateRule(grp.memberRule ?? {});
      grp.memberCount = grp.memberIds.length;
      grp.ruleSyncedAt = mockDateTime();
    }
    return ok(publicView(grp), '更新成功');
  }),

  http.delete('/api/user-groups/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = body?.ids ?? [];
    // 在用保护仅针对静态组：动态组成员是规则物化产物，允许直接删除
    const blocked = mockUserGroups.filter((g) => ids.includes(g.id) && g.memberMode === 'static' && (g.memberCount ?? 0) > 0);
    if (blocked.length > 0) {
      const names = blocked.slice(0, 3).map((g) => `「${g.name}」`).join('、');
      const suffix = blocked.length > 3 ? ` 等 ${blocked.length} 个用户组` : '';
      return conflict(`${names}${suffix}仍有成员，请先移除成员后再删除`, { status: 409 });
    }
    ids.forEach((id) => {
      const idx = mockUserGroups.findIndex((g) => g.id === id);
      if (idx !== -1) mockUserGroups.splice(idx, 1);
    });
    return ok(null, `已删除 ${ids.length} 个用户组`);
  }),

  http.delete('/api/user-groups/:id', ({ params }) => {
    const idx = mockUserGroups.findIndex((g) => g.id === Number(params.id));
    if (idx === -1) return notFound('用户组不存在');
    const grp = mockUserGroups[idx];
    const memberCount = grp.memberCount ?? 0;
    if (grp.memberMode === 'static' && memberCount > 0) {
      return conflict(`该用户组下仍有 ${memberCount} 名成员，请先移除成员后再删除`, { status: 409 });
    }
    mockUserGroups.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
