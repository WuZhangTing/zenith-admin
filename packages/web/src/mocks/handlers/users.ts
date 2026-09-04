import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockUsers, getNextUserId, type MockUser } from '@/mocks/data/users';
import { mockRoles } from '@/mocks/data/roles';
import { mockPositions } from '@/mocks/data/positions';
import { mockDepartments } from '@/mocks/data/departments';
import { mockDateTime } from '@/mocks/utils/date';

// Demo 模式下新增/重置用户时使用的默认初始口令（明文仅用于演示环境）
const DEMO_INITIAL_CREDENTIAL = ['1', '2', '3', '4', '5', '6'].join('');

function flattenDepts(depts: typeof mockDepartments): typeof mockDepartments {
  const result: typeof mockDepartments = [];
  const traverse = (items: typeof mockDepartments) => {
    for (const d of items) {
      result.push(d);
      if (d.children) traverse(d.children);
    }
  };
  traverse(depts);
  return result;
}

function toUserResponse(user: MockUser) {
  const { password: _, ...rest } = user;
  return {
    ...rest,
    departmentName: flattenDepts(mockDepartments).find((d) => d.id === rest.departmentId)?.name ?? null,
    positions: rest.positionIds?.map((pid) => mockPositions.find((p) => p.id === pid)).filter(Boolean) ?? [],
    roles: rest.roles,
  };
}

export const usersHandlers = [
  http.get('/api/users/alert-recipients', () => {
    return ok(mockUsers
      .filter((user) => user.status === 'enabled')
      .map((user) => ({
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        departmentName: flattenDepts(mockDepartments).find((department) => department.id === user.departmentId)?.name ?? null,
        hasEmail: Boolean(user.email),
      })));
  }),

  // 全量用户（供下拉/穿梭框使用）
  http.get('/api/users/all', () => {
    return ok(mockUsers.map(toUserResponse));
  }),

  // 用户列表（分页）
  http.get('/api/users', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const phone = url.searchParams.get('phone') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const roleId = url.searchParams.get('roleId') ?? '';
    const departmentIdParam = url.searchParams.get('departmentId');
    const departmentId = departmentIdParam ? Number(departmentIdParam) : null;

    let list = mockUsers.filter((u) => {
      if (keyword && !u.username.includes(keyword) && !u.nickname.includes(keyword)) return false;
      if (phone && !(u.phone ?? '').includes(phone)) return false;
      if (status && u.status !== status) return false;
      if (roleId && !u.roles.some((r) => String(r.id) === roleId)) return false;
      if (departmentId && u.departmentId !== departmentId) return false;
      return true;
    });

    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list: list.map(toUserResponse), total, page, pageSize });
  }),

  // 获取单个用户
  http.get('/api/users/:id', ({ params }) => {
    const user = mockUsers.find((u) => u.id === Number(params.id));
    if (!user) return notFound('用户不存在');
    return ok(toUserResponse(user));
  }),

  // 新增用户
  http.post('/api/users', async ({ request }) => {
    const body = await request.json() as Partial<MockUser> & { roleIds?: number[]; positionIds?: number[] };
    const roles = (body.roleIds ?? []).map((id) => mockRoles.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    const positions = (body.positionIds ?? []).map((id) => mockPositions.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const newUser: MockUser = {
      id: getNextUserId(),
      username: body.username ?? '',
      nickname: body.nickname ?? '',
      email: body.email ?? '',
      phone: body.phone ?? undefined,
      password: DEMO_INITIAL_CREDENTIAL,
      avatar: body.avatar,
      departmentId: body.departmentId ?? null,
      departmentName: null,
      positionIds: body.positionIds ?? [],
      positions,
      roles,
      status: body.status ?? 'enabled',
      passwordUpdatedAt: mockDateTime(),
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockUsers.push(newUser);
    return ok(toUserResponse(newUser), '新增成功');
  }),

  // 更新用户
  http.put('/api/users/:id', async ({ params, request }) => {
    const user = mockUsers.find((u) => u.id === Number(params.id));
    if (!user) return notFound('用户不存在');
    const body = await request.json() as Partial<MockUser> & { roleIds?: number[]; positionIds?: number[] };
    if (body.roleIds !== undefined) {
      user.roles = body.roleIds.map((id) => mockRoles.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    }
    if (body.positionIds !== undefined) {
      user.positionIds = body.positionIds;
      user.positions = body.positionIds.map((id) => mockPositions.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    }
    Object.assign(user, { ...body, updatedAt: mockDateTime() });
    return ok(toUserResponse(user), '更新成功');
  }),

  // 批量删除用户
  http.delete('/api/users/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = new Set(body?.ids ?? []);
    if (ids.size === 0) return badRequest('请选择要删除的用户');
    const before = mockUsers.length;
    mockUsers.splice(0, mockUsers.length, ...mockUsers.filter((u) => !ids.has(u.id)));
    return ok(null, `已删除 ${before - mockUsers.length} 个用户`);
  }),

  // 批量修改用户状态
  http.put('/api/users/batch-status', async ({ request }) => {
    const body = await request.json() as { ids: number[]; status: 'enabled' | 'disabled' };
    const ids = new Set(body?.ids ?? []);
    mockUsers.forEach((u) => {
      if (ids.has(u.id) && u.username !== 'admin') {
        u.status = body.status;
        u.updatedAt = mockDateTime();
      }
    });
    return ok(null, '状态更新成功');
  }),

  // 删除用户
  http.delete('/api/users/:id', ({ params }) => {
    const index = mockUsers.findIndex((u) => u.id === Number(params.id));
    if (index === -1) return notFound('用户不存在');
    if (mockUsers[index].username === 'admin') {
      return badRequest('不能删除管理员账号');
    }
    mockUsers.splice(index, 1);
    return ok(null, '删除成功');
  }),

  // 重置密码（与真实接口 PUT /api/users/:id/password 对齐）
  http.put('/api/users/:id/password', ({ params }) => {
    const user = mockUsers.find((u) => u.id === Number(params.id));
    if (!user) return notFound('用户不存在');
    user.password = DEMO_INITIAL_CREDENTIAL;
    return ok(null, '密码修改成功');
  }),

  // 批量重置密码
  http.put('/api/users/batch-password', async ({ request }) => {
    const body = await request.json() as { ids: number[]; password: string };
    const ids = new Set(body?.ids ?? []);
    mockUsers.forEach((u) => {
      if (ids.has(u.id)) u.password = body.password || DEMO_INITIAL_CREDENTIAL;
    });
    return ok(null, '密码重置成功');
  }),

  // 分配用户角色
  http.put('/api/users/:id/roles', async ({ params, request }) => {
    const user = mockUsers.find((u) => u.id === Number(params.id));
    if (!user) return notFound('用户不存在');
    const body = await request.json() as { roleIds: number[] };
    user.roles = (body.roleIds ?? [])
      .map((rid) => mockRoles.find((r) => r.id === rid))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
    user.updatedAt = mockDateTime();
    return ok(null, '保存成功');
  }),

  // 修改用户状态

  // 下载导入模板
  http.get('/api/users/import-template', () => {
    return new Response(new ArrayBuffer(0), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=user_import_template.xlsx',
      },
    });
  }),

  // 批量导入用户
  http.post('/api/users/:id/unlock', () => {
    return ok(null, 'success');
  }),

];
