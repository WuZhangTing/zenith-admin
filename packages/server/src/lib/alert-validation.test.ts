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
});
