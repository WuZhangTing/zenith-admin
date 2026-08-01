import { http } from 'msw';
import { ok, badRequest, notFound, pageParams, nextIdFrom } from '@/mocks/utils/handlers';
import type { ApiScope } from '@zenith/shared/open-platform';
import { mockApiScopes } from '@/mocks/data/api-scopes';
import { mockDateTime } from '@/mocks/utils/date';

let scopes: ApiScope[] = mockApiScopes.map((s) => ({ ...s }));
let nextId = nextIdFrom(scopes);
const BASE = '/api/api-scopes';

export const apiScopesHandlers = [
  http.get(`${BASE}/options`, () => ok(scopes.filter((s) => s.status === 'enabled'), 'success')),

  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const group = url.searchParams.get('scopeGroup') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url);
    let filtered = scopes;
    if (keyword) filtered = filtered.filter((s) => s.code.includes(keyword) || s.name.includes(keyword));
    if (group) filtered = filtered.filter((s) => s.scopeGroup === group);
    if (status) filtered = filtered.filter((s) => s.status === status);
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as Partial<ApiScope>;
    if (scopes.some((s) => s.code === body.code)) {
      return badRequest('scope 编码已存在', { status: 400 });
    }
    const now = mockDateTime();
    const created: ApiScope = {
      id: nextId++,
      code: body.code ?? '',
      name: body.name ?? '',
      description: body.description ?? null,
      scopeGroup: body.scopeGroup ?? 'general',
      status: body.status ?? 'enabled',
      createdAt: now,
      updatedAt: now,
    };
    scopes.unshift(created);
    return ok(created, '创建成功');
  }),

  http.delete(`${BASE}/batch`, async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    const set = new Set(ids ?? []);
    const before = scopes.length;
    scopes = scopes.filter((s) => !set.has(s.id));
    return ok(null, `已删除 ${before - scopes.length} 条记录`);
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const found = scopes.find((s) => s.id === Number(params.id));
    return found ? ok(found, 'success') : notFound('API Scope 不存在', { status: 404 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const idx = scopes.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('API Scope 不存在', { status: 404 });
    const body = (await request.json()) as Partial<ApiScope>;
    scopes[idx] = { ...scopes[idx], ...body, code: scopes[idx].code, updatedAt: mockDateTime() };
    return ok(scopes[idx], '更新成功');
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const idx = scopes.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('API Scope 不存在', { status: 404 });
    scopes.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
