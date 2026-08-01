import { http } from 'msw';
import { ok, notFound } from '@/mocks/utils/handlers';
import { mockDepartments, getNextDeptId } from '@/mocks/data/departments';
import { mockUsers } from '@/mocks/data/users';
import { mockDateTime } from '@/mocks/utils/date';
import type { Department } from '@zenith/shared/identity';

function withLeaderName(dept: Department): Department {
  const leader = dept.leaderId ? mockUsers.find((u) => u.id === dept.leaderId) : undefined;
  return { ...dept, leaderName: leader?.nickname ?? null };
}

function withUserStats(dept: Department): Department {
  const deptUsers = mockUsers.filter((u) => u.departmentId === dept.id);
  return {
    ...dept,
    userCount: deptUsers.length,
    userPreview: deptUsers.slice(0, 5).map((u) => ({ id: u.id, nickname: u.nickname, avatar: u.avatar ?? null })),
  };
}

function buildDeptTree(list: Department[], parentId: number = 0): Department[] {
  return list
    .filter((d) => d.parentId === parentId)
    .map((d) => {
      const children = buildDeptTree(list, d.id);
      const enriched = withUserStats(withLeaderName(d));
      return children.length > 0 ? { ...enriched, children } : { ...enriched };
    });
}

export const departmentsHandlers = [
  // 部门平铺列表（供下拉框使用）
  http.get('/api/departments/flat', () => {
    return ok(mockDepartments.map(withLeaderName));
  }),

  // 部门树
  http.get('/api/departments', ({ request }) => {
    const url = new URL(request.url);
    const flat = url.searchParams.get('flat');
    if (flat === 'true') {
      return ok(mockDepartments.map(withLeaderName));
    }
    return ok(buildDeptTree(mockDepartments));
  }),

  // 获取单个部门
  http.get('/api/departments/:id', ({ params }) => {
    const dept = mockDepartments.find((d) => d.id === Number(params.id));
    if (!dept) return notFound('部门不存在');
    return ok(dept);
  }),

  // 新增部门
  http.post('/api/departments', async ({ request }) => {
    const body = await request.json() as Partial<Department>;
    const newDept: Department = {
      id: getNextDeptId(),
      name: body.name ?? '',
      code: body.code ?? '',
      parentId: body.parentId ?? 0,
      category: body.category ?? 'department',
      leaderId: body.leaderId ?? null,
      sort: body.sort ?? 0,
      status: body.status ?? 'enabled',
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockDepartments.push(newDept);
    return ok(newDept, '新增成功');
  }),

  // 更新部门
  http.put('/api/departments/:id', async ({ params, request }) => {
    const dept = mockDepartments.find((d) => d.id === Number(params.id));
    if (!dept) return notFound('部门不存在');
    const body = await request.json() as Partial<Department>;
    Object.assign(dept, body, { updatedAt: mockDateTime() });
    return ok(dept, '更新成功');
  }),

  // 删除部门
  http.delete('/api/departments/:id', ({ params }) => {
    const index = mockDepartments.findIndex((d) => d.id === Number(params.id));
    if (index === -1) return notFound('部门不存在');
    mockDepartments.splice(index, 1);
    return ok(null, '删除成功');
  }),
];
