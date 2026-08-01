import { http } from 'msw';
import { ok, badRequest } from '@/mocks/utils/handlers';
import { mockEmailConfig } from '@/mocks/data/email-config';
import { mockDateTime } from '@/mocks/utils/date';
import type { EmailConfig } from '@zenith/shared/messaging';

let emailConfig: EmailConfig = { ...mockEmailConfig };

export const emailConfigHandlers = [
  http.get('/api/email-config', () => {

    const { smtpPassword: _masked, ...safeConfig } = emailConfig;
    return ok(safeConfig, 'success');
  }),

  http.put('/api/email-config', async ({ request }) => {
    const body = (await request.json()) as Partial<EmailConfig>;
    emailConfig = { ...emailConfig, ...body, updatedAt: mockDateTime() };
    return ok(emailConfig, '保存成功');
  }),

  http.post('/api/email-config/test', async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    if (!body.email) {
      return badRequest('请提供收件邮箱', { status: 400 });
    }
    return ok(null, '测试邮件发送成功（演示模式）');
  }),
];
