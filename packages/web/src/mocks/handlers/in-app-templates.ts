import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { mockInAppTemplates, getNextInAppTemplateId } from '@/mocks/data/in-app-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { InAppTemplate } from '@zenith/shared/messaging';

export const inAppTemplatesHandlers = [
  http.get('/api/in-app-templates', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = mockInAppTemplates.filter((t) => {
      if (keyword && !t.name.includes(keyword) && !t.code.includes(keyword) && !t.title.includes(keyword)) return false;
      if (type && t.type !== type) return false;
      if (status && t.status !== status) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.get('/api/in-app-templates/:id', ({ params }) => {
    const t = mockInAppTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('站内信模板不存在', { status: 404 });
    return ok(t);
  }),

  http.post('/api/in-app-templates', async ({ request }) => {
    const body = await request.json() as Partial<InAppTemplate>;
    if (mockInAppTemplates.some((t) => t.code === body.code)) {
      return badRequest('模板编码已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: InAppTemplate = {
      id: getNextInAppTemplateId(),
      name: body.name ?? '',
      code: body.code ?? '',
      title: body.title ?? '',
      content: body.content ?? '',
      type: body.type ?? 'info',
      variables: body.variables ?? null,
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockInAppTemplates.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/in-app-templates/:id', async ({ params, request }) => {
    const t = mockInAppTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('站内信模板不存在', { status: 404 });
    const body = await request.json() as Partial<InAppTemplate>;
    Object.assign(t, body, { id: t.id, code: t.code, updatedAt: mockDateTime() });
    return ok(t, '更新成功');
  }),

  http.delete('/api/in-app-templates/:id', ({ params }) => {
    const idx = mockInAppTemplates.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('站内信模板不存在', { status: 404 });
    mockInAppTemplates.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
