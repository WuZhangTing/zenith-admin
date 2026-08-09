import { HTTPException } from 'hono/http-exception';

export interface AlertDeliveryConfig {
  enabled: boolean;
  channels: readonly string[];
  webhookUrl: string | null;
  recipients: readonly string[];
}

export function validateAlertDelivery(config: AlertDeliveryConfig): void {
  if (!config.enabled) return;
  if (config.channels.length === 0) {
    throw new HTTPException(400, { message: '启用告警时至少选择一个通知渠道' });
  }
  if (config.channels.includes('webhook') && !config.webhookUrl) {
    throw new HTTPException(400, { message: 'Webhook 渠道必须配置有效 URL' });
  }
  if (
    (config.channels.includes('email') || config.channels.includes('inapp'))
    && config.recipients.length === 0
  ) {
    throw new HTTPException(400, { message: '邮件或站内通知渠道必须配置接收人' });
  }
}
