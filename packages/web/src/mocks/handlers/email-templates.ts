import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { mockEmailTemplates, getNextEmailTemplateId } from '@/mocks/data/email-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { EmailTemplate } from '@zenith/shared/messaging';

export const emailTemplatesHandlers = [
  http.get('/api/email-templates', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = mockEmailTemplates.filter((t) => {
      if (keyword && !t.name.includes(keyword) && !t.code.includes(keyword) && !t.subject.includes(keyword)) return false;
      if (status && t.status !== status) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.get('/api/email-templates/:id', ({ params }) => {
    const t = mockEmailTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('邮件模板不存在', { status: 404 });
    return ok(t);
  }),

  http.post('/api/email-templates', async ({ request }) => {
    const body = await request.json() as Partial<EmailTemplate>;
    if (mockEmailTemplates.some((t) => t.code === body.code)) {
      return badRequest('模板编码已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: EmailTemplate = {
      id: getNextEmailTemplateId(),
      name: body.name ?? '',
      code: body.code ?? '',
      subject: body.subject ?? '',
      content: body.content ?? '',
      variables: body.variables ?? null,
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockEmailTemplates.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/email-templates/:id', async ({ params, request }) => {
    const t = mockEmailTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('邮件模板不存在', { status: 404 });
    const body = await request.json() as Partial<EmailTemplate>;
    Object.assign(t, body, { id: t.id, code: t.code, updatedAt: mockDateTime() });
    return ok(t, '更新成功');
  }),

  http.delete('/api/email-templates/:id', ({ params }) => {
    const idx = mockEmailTemplates.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('邮件模板不存在', { status: 404 });
    mockEmailTemplates.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
