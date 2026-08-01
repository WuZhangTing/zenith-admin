import { http } from 'msw';
import { ok, notFound, paginate } from '@/mocks/utils/handlers';
import { mockEmailSendLogs, getNextEmailSendLogId } from '@/mocks/data/email-send-logs';
import { mockEmailTemplates } from '@/mocks/data/email-templates';
import { mockDateTime } from '@/mocks/utils/date';
import type { EmailSendLog } from '@zenith/shared/messaging';

export const emailSendLogsHandlers = [
  http.get('/api/email-send-logs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const toEmail = url.searchParams.get('toEmail') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const source = url.searchParams.get('source') ?? '';
    const filtered = mockEmailSendLogs.filter((l) => {
      if (keyword && !l.subject.includes(keyword) && !l.toEmail.includes(keyword)) return false;
      if (toEmail && !l.toEmail.includes(toEmail)) return false;
      if (status && l.status !== status) return false;
      if (source && l.source !== source) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.get('/api/email-send-logs/:id', ({ params }) => {
    const l = mockEmailSendLogs.find((x) => x.id === Number(params.id));
    if (!l) return notFound('记录不存在', { status: 404 });
    return ok(l);
  }),

  http.delete('/api/email-send-logs/:id', ({ params }) => {
    const idx = mockEmailSendLogs.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('记录不存在', { status: 404 });
    mockEmailSendLogs.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  http.delete('/api/email-send-logs/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = new Set(body.ids ?? []);
    let count = 0;
    for (let i = mockEmailSendLogs.length - 1; i >= 0; i--) {
      if (ids.has(mockEmailSendLogs[i].id)) {
        mockEmailSendLogs.splice(i, 1);
        count++;
      }
    }
    return ok(null, `已删除 ${count} 条记录`);
  }),

  http.post('/api/email-send-logs/test', async ({ request }) => {
    const body = await request.json() as { templateId?: number; toEmail: string; subject?: string; content?: string };
    const tpl = body.templateId ? mockEmailTemplates.find((t) => t.id === body.templateId) : null;
    const now = mockDateTime();
    const log: EmailSendLog = {
      id: getNextEmailSendLogId(),
      templateId: tpl?.id ?? null,
      templateName: tpl?.name ?? null,
      toEmail: body.toEmail,
      subject: body.subject ?? tpl?.subject ?? '测试邮件',
      content: body.content ?? tpl?.content ?? '',
      status: 'success',
      errorMsg: null,
      source: 'test',
      userId: 1,
      userName: '管理员',
      ip: '127.0.0.1',
      sentAt: now,
      createdAt: now,
    };
    mockEmailSendLogs.unshift(log);
    return ok({ success: true, status: 'success', logId: log.id }, '测试发送成功');
  }),
];
