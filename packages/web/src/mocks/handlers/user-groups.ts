import { http } from 'msw';
import { ok, badRequest, notFound, conflict, pageParams } from '@/mocks/utils/handlers';
import { mockUserGroups, getNextUserGroupId } from '@/mocks/data/user-groups';
import { mockUsers } from '@/mocks/data/users';
import { mockRoles } from '@/mocks/data/roles';
import { mockDateTime } from '@/mocks/utils/date';
import type { UserGroup } from '@zenith/shared/identity';

interface CreateBody {
  name: string;
  code: string;
  description?: string;
  ownerId?: number | null;
  departmentId?: number | null;
  status?: 'enabled' | 'disabled';
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
    const body = await request.json() as { userIds: number[] };
    grp.memberIds = Array.isArray(body?.userIds) ? body.userIds : [];
    grp.memberCount = grp.memberIds.length;
    grp.updatedAt = mockDateTime();
    return ok(null, '保存成功');
  }),

  http.post('/api/user-groups/:id/members', async ({ params, request }) => {
    const grp = mockUserGroups.find((g) => g.id === Number(params.id));
    if (!grp) return notFound('用户组不存在');
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
    const body = await request.json() as { userIds: number[] };
    const remove = new Set(body?.userIds ?? []);
    grp.memberIds = grp.memberIds.filter((id) => !remove.has(id));
    grp.memberCount = grp.memberIds.length;
    return ok(null, '移除成功');
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
    const created = {
      id: getNextUserGroupId(),
      name: body.name,
      code: body.code,
      description: body.description ?? null,
      ownerId: body.ownerId ?? null,
      ownerName: null,
      departmentId: body.departmentId ?? null,
      departmentName: null,
      memberCount: 0,
      memberIds: [],
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
    return ok(publicView(grp), '更新成功');
  }),

  http.delete('/api/user-groups/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = body?.ids ?? [];
    // 在用保护：任一选中用户组仍有成员时整体拒绝
    const blocked = mockUserGroups.filter((g) => ids.includes(g.id) && (g.memberCount ?? 0) > 0);
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
    if (memberCount > 0) {
      return conflict(`该用户组下仍有 ${memberCount} 名成员，请先移除成员后再删除`, { status: 409 });
    }
    mockUserGroups.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
