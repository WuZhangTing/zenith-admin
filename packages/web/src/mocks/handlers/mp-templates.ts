import { http } from 'msw';
import { ok, notFound, pageParams, paginate } from '@/mocks/utils/handlers';
import { mockMpTemplates, mockMpTemplateLogs, getNextMpTemplateLogId } from '@/mocks/data/mp-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpTemplateSendLog } from '@zenith/shared/mp';

export const mpTemplatesHandlers = [
  http.get('/api/mp/templates/logs', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockMpTemplateLogs.filter((l) => l.accountId === accountId && (!status || l.status === status));
    const total = filtered.length;
    const list = [...filtered].sort((a, b) => b.id - a.id).slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  http.get('/api/mp/templates', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const keyword = url.searchParams.get('keyword') ?? '';
    const filtered = mockMpTemplates.filter((t) => t.accountId === accountId && (!keyword || t.title.includes(keyword)));
    return ok(paginate(filtered, url, 20));
  }),

  http.post('/api/mp/templates/sync', async ({ request }) => {
    const body = await request.json() as { accountId: number };
    const total = mockMpTemplates.filter((t) => t.accountId === body.accountId).length;
    return ok({ success: true, created: 0, updated: total, total }, '同步完成');
  }),

  http.post('/api/mp/templates/send', async ({ request }) => {
    const body = await request.json() as { accountId: number; templateId: string; openid: string; url?: string; data: Record<string, unknown> };
    const log: MpTemplateSendLog = {
      id: getNextMpTemplateLogId(), accountId: body.accountId, templateId: body.templateId, openid: body.openid,
      data: body.data, url: body.url ?? null, status: 'success', errorMsg: null, msgId: `mock_${Date.now()}`, createdAt: mockDateTime(),
    };
    mockMpTemplateLogs.push(log);
    return ok(log, '发送成功');
  }),

  http.post('/api/mp/templates/batch-send', async ({ request }) => {
    const body = await request.json() as { accountId: number; templateId: string; openids: string[]; url?: string; data: Record<string, unknown> };
    for (const openid of body.openids) {
      mockMpTemplateLogs.push({
        id: getNextMpTemplateLogId(), accountId: body.accountId, templateId: body.templateId, openid,
        data: body.data, url: body.url ?? null, status: 'success', errorMsg: null, msgId: `mock_${Date.now()}_${openid.slice(-4)}`, createdAt: mockDateTime(),
      });
    }
    return ok({ success: body.openids.length, failed: 0, total: body.openids.length }, '已提交批量发送');
  }),

  http.get('/api/mp/templates/industry', () => ok({ primaryIndustry: { firstClass: 'IT科技', secondClass: '互联网/电子商务' }, secondaryIndustry: { firstClass: 'IT科技', secondClass: 'IT软件与服务' } })),

  http.put('/api/mp/templates/industry', () => ok(null, '设置成功')),

  http.delete('/api/mp/templates/:id', ({ params }) => {
    const idx = mockMpTemplates.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('模板不存在', { status: 404 });
    mockMpTemplates.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
