import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { mockSmsTemplates, getNextSmsTemplateId } from '@/mocks/data/sms-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { SmsTemplate } from '@zenith/shared/messaging';

export const smsTemplatesHandlers = [
  http.get('/api/sms-templates', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const provider = url.searchParams.get('provider') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = mockSmsTemplates.filter((t) => {
      if (keyword && !t.name.includes(keyword) && !t.code.includes(keyword) && !t.templateCode.includes(keyword)) return false;
      if (provider && t.provider !== provider) return false;
      if (status && t.status !== status) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.get('/api/sms-templates/:id', ({ params }) => {
    const t = mockSmsTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('短信模板不存在', { status: 404 });
    return ok(t);
  }),

  http.post('/api/sms-templates', async ({ request }) => {
    const body = await request.json() as Partial<SmsTemplate>;
    if (mockSmsTemplates.some((t) => t.code === body.code)) {
      return badRequest('模板编码已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: SmsTemplate = {
      id: getNextSmsTemplateId(),
      name: body.name ?? '',
      code: body.code ?? '',
      templateCode: body.templateCode ?? '',
      signName: body.signName ?? '',
      content: body.content ?? '',
      variables: body.variables ?? null,
      provider: body.provider ?? 'aliyun',
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockSmsTemplates.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/sms-templates/:id', async ({ params, request }) => {
    const t = mockSmsTemplates.find((x) => x.id === Number(params.id));
    if (!t) return notFound('短信模板不存在', { status: 404 });
    const body = await request.json() as Partial<SmsTemplate>;
    Object.assign(t, body, { id: t.id, code: t.code, updatedAt: mockDateTime() });
    return ok(t, '更新成功');
  }),

  http.delete('/api/sms-templates/:id', ({ params }) => {
    const idx = mockSmsTemplates.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('短信模板不存在', { status: 404 });
    mockSmsTemplates.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
