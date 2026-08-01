import { http } from 'msw';
import { ok, notFound, paginate } from '@/mocks/utils/handlers';
import { mockMpMaterials, getNextMpMaterialId } from '@/mocks/data/mp-materials';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpMaterial } from '@zenith/shared/mp';

export const mpMaterialsHandlers = [
  http.get('/api/mp/materials', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const type = url.searchParams.get('type') ?? '';
    const keyword = url.searchParams.get('keyword') ?? '';
    const filtered = mockMpMaterials.filter((m) => {
      if (m.accountId !== accountId) return false;
      if (type && m.type !== type) return false;
      if (keyword && !m.name.includes(keyword)) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.post('/api/mp/materials/sync', async ({ request }) => {
    const body = await request.json() as { accountId: number };
    const total = mockMpMaterials.filter((m) => m.accountId === body.accountId).length;
    return ok({ success: true, created: 0, updated: total, total }, '同步完成');
  }),

  http.post('/api/mp/materials', async ({ request }) => {
    const body = await request.json() as Partial<MpMaterial> & { accountId: number };
    const now = mockDateTime();
    const item: MpMaterial = {
      id: getNextMpMaterialId(), accountId: body.accountId, type: body.type ?? 'image', name: body.name ?? '',
      wechatMediaId: null, url: body.url ?? null, fileSize: body.fileSize ?? null, createdAt: now, updatedAt: now,
    };
    mockMpMaterials.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/mp/materials/:id', async ({ params, request }) => {
    const m = mockMpMaterials.find((x) => x.id === Number(params.id));
    if (!m) return notFound('素材不存在', { status: 404 });
    const body = await request.json() as { name: string };
    m.name = body.name ?? m.name;
    m.updatedAt = mockDateTime();
    return ok(m, '更新成功');
  }),

  http.delete('/api/mp/materials/:id', ({ params }) => {
    const idx = mockMpMaterials.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('素材不存在', { status: 404 });
    mockMpMaterials.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
