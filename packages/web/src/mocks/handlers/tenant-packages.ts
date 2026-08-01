import { http } from 'msw';
import { ok, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockTenantPackages, getNextTenantPackageId } from '@/mocks/data/tenant-packages';
import { mockDateTime } from '@/mocks/utils/date';
import type { TenantPackage } from '@zenith/shared/identity';

export const tenantPackagesHandlers = [
  // 全部套餐（下拉用）— 必须在 /:id 之前注册
  http.get('/api/tenant-packages/all', () => {
    return ok(mockTenantPackages.map((p) => ({ id: p.id, name: p.name, status: p.status })));
  }),

  // 套餐列表（分页）
  http.get('/api/tenant-packages', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url);

    const filtered = mockTenantPackages.filter((p) => {
      if (keyword && !p.name.includes(keyword)) return false;
      if (status && p.status !== status) return false;
      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const list = filtered
      .slice(start, start + pageSize)
      .map((p) => ({ ...p, menuCount: (p.menuIds ?? []).length }));

    return ok({ list, total, page, pageSize });
  }),

  // 套餐详情
  http.get('/api/tenant-packages/:id', ({ params }) => {
    const pkg = mockTenantPackages.find((p) => p.id === Number(params.id));
    if (!pkg) return notFound('套餐不存在');
    return ok({ ...pkg, menuCount: (pkg.menuIds ?? []).length });
  }),

  // 新增套餐
  http.post('/api/tenant-packages', async ({ request }) => {
    const body = await request.json() as Partial<TenantPackage>;
    const newPkg: TenantPackage = {
      id: getNextTenantPackageId(),
      name: body.name ?? '',
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      menuIds: [],
      menuCount: 0,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockTenantPackages.push(newPkg);
    return ok(newPkg, '创建成功');
  }),

  // 更新套餐
  http.put('/api/tenant-packages/:id', async ({ params, request }) => {
    const pkg = mockTenantPackages.find((p) => p.id === Number(params.id));
    if (!pkg) return notFound('套餐不存在');
    const body = await request.json() as Partial<TenantPackage>;
    Object.assign(pkg, body, { updatedAt: mockDateTime() });
    return ok(pkg, '更新成功');
  }),

  // 分配菜单
  http.put('/api/tenant-packages/:id/menus', async ({ params, request }) => {
    const pkg = mockTenantPackages.find((p) => p.id === Number(params.id));
    if (!pkg) return notFound('套餐不存在');
    const body = await request.json() as { menuIds: number[] };
    pkg.menuIds = body.menuIds ?? [];
    pkg.menuCount = pkg.menuIds.length;
    pkg.updatedAt = mockDateTime();
    return ok(null, '菜单已更新');
  }),

  // 批量删除（必须在 /:id 之前注册）
  http.delete('/api/tenant-packages/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = body.ids ?? [];
    for (const id of ids) {
      const idx = mockTenantPackages.findIndex((p) => p.id === id);
      if (idx !== -1) mockTenantPackages.splice(idx, 1);
    }
    return ok(null, `已删除 ${ids.length} 条记录`);
  }),

  // 删除套餐
  http.delete('/api/tenant-packages/:id', ({ params }) => {
    const idx = mockTenantPackages.findIndex((p) => p.id === Number(params.id));
    if (idx === -1) return notFound('套餐不存在');
    mockTenantPackages.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
