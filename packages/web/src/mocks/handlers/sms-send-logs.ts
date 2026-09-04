import { http } from 'msw';
import { ok, notFound, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockSmsSendLogs, getNextSmsSendLogId } from '@/mocks/data/sms-send-logs';
import { mockSmsTemplates } from '@/mocks/data/sms-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { SmsSendLog } from '@zenith/shared/messaging';

export const smsSendLogsHandlers = [
  http.get('/api/sms-send-logs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const phone = url.searchParams.get('phone') ?? '';
    const provider = url.searchParams.get('provider') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const source = url.searchParams.get('source') ?? '';
    const filtered = mockSmsSendLogs.filter((l) => {
      if (keyword && !l.phone.includes(keyword) && !(l.templateName ?? '').includes(keyword)) return false;
      if (phone && !l.phone.includes(phone)) return false;
      if (provider && l.provider !== provider) return false;
      if (status && l.status !== status) return false;
      if (source && l.source !== source) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.delete('/api/sms-send-logs/:id', ({ params }) => {
    const idx = mockSmsSendLogs.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('记录不存在', { status: 404 });
    mockSmsSendLogs.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  http.delete('/api/sms-send-logs/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = new Set(body.ids ?? []);
    const count = removeWhere(mockSmsSendLogs, (log) => ids.has(log.id));
    return ok(null, `已删除 ${count} 条记录`);
  }),

  http.post('/api/sms-send-logs/test-send', async ({ request }) => {
    const body = await request.json() as { templateId?: number; phone: string; variables?: Record<string, string> };
    const tpl = body.templateId ? mockSmsTemplates.find((t) => t.id === body.templateId) : null;
    const now = mockDateTime();
    const log: SmsSendLog = {
      id: getNextSmsSendLogId(),
      configId: 1,
      templateId: tpl?.id ?? null,
      templateName: tpl?.name ?? null,
      provider: tpl?.provider ?? 'aliyun',
      phone: body.phone,
      content: tpl?.content ?? '测试短信',
      status: 'success',
      errorMsg: null,
      bizId: `demo-${Date.now()}`,
      deliveryStatus: 'DELIVRD',
      deliveredAt: now,
      source: 'test',
      userId: 1,
      userName: '管理员',
      ip: '127.0.0.1',
      sentAt: now,
      createdAt: now,
    };
    mockSmsSendLogs.unshift(log);
    return ok({ success: true, status: 'success', logId: log.id }, '测试发送成功');
  }),
];
