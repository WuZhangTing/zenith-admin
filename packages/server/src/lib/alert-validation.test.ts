import { describe, expect, it } from 'vitest';
import { HTTPException } from 'hono/http-exception';
import { validateAlertDelivery } from './alert-validation';

function expectMessage(run: () => void, message: string) {
  try {
    run();
    throw new Error('Expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(HTTPException);
    expect((error as HTTPException).message).toBe(message);
  }
}

describe('validateAlertDelivery', () => {
  it('allows disabled alert rules without delivery configuration', () => {
    expect(() => validateAlertDelivery({
      enabled: false,
      channels: [],
      webhookUrl: null,
      recipients: [],
    })).not.toThrow();
  });

  it('requires at least one channel for enabled rules', () => {
    expectMessage(
      () => validateAlertDelivery({
        enabled: true,
        channels: [],
        webhookUrl: null,
        recipients: [],
      }),
      '启用告警时至少选择一个通知渠道',
    );
  });

  it('validates webhook and recipient channel requirements', () => {
    expectMessage(
      () => validateAlertDelivery({
        enabled: true,
        channels: ['webhook'],
        webhookUrl: null,
        recipients: [],
      }),
      'Webhook 渠道必须配置有效 URL',
    );
    expectMessage(
      () => validateAlertDelivery({
        enabled: true,
        channels: ['email'],
        webhookUrl: null,
        recipients: [],
      }),
      '邮件或站内通知渠道必须配置接收人',
    );
  });

  it('validates typed user and email recipients independently', () => {
    expectMessage(
      () => validateAlertDelivery({
        enabled: true,
        channels: ['inapp'],
        webhookUrl: null,
        recipientUserIds: [],
        recipientEmails: ['ops@example.com'],
      }),
      '站内信渠道必须选择接收用户',
    );
    expectMessage(
      () => validateAlertDelivery({
        enabled: true,
        channels: ['email'],
        webhookUrl: null,
        recipientUserIds: [],
        recipientEmails: [],
      }),
      '邮件渠道必须选择接收用户或填写额外邮箱',
    );
    expect(() => validateAlertDelivery({
      enabled: true,
      channels: ['email', 'inapp'],
      webhookUrl: null,
      recipientUserIds: [1],
      recipientEmails: [],
    })).not.toThrow();
  });
});
