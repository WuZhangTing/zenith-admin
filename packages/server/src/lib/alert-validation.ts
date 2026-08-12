import { HTTPException } from 'hono/http-exception';

export interface AlertDeliveryConfig {
  enabled: boolean;
  channels: readonly string[];
  webhookUrl: string | null;
  /** 旧式混合标识，仅供尚未迁移的告警域使用 */
  recipients?: readonly string[];
  recipientUserIds?: readonly number[];
  recipientEmails?: readonly string[];
}

export function validateAlertDelivery(config: AlertDeliveryConfig): void {
  if (!config.enabled) return;
  if (config.channels.length === 0) {
    throw new HTTPException(400, { message: '启用告警时至少选择一个通知渠道' });
  }
  if (config.channels.includes('webhook') && !config.webhookUrl) {
    throw new HTTPException(400, { message: 'Webhook 渠道必须配置有效 URL' });
  }
  const usesTypedRecipients = config.recipientUserIds !== undefined || config.recipientEmails !== undefined;
  if (usesTypedRecipients) {
    if (config.channels.includes('inapp') && (config.recipientUserIds?.length ?? 0) === 0) {
      throw new HTTPException(400, { message: '站内信渠道必须选择接收用户' });
    }
    if (
      config.channels.includes('email')
      && (config.recipientUserIds?.length ?? 0) === 0
      && (config.recipientEmails?.length ?? 0) === 0
    ) {
      throw new HTTPException(400, { message: '邮件渠道必须选择接收用户或填写额外邮箱' });
    }
  } else if (
    (config.channels.includes('email') || config.channels.includes('inapp'))
    && (config.recipients?.length ?? 0) === 0
  ) {
    throw new HTTPException(400, { message: '邮件或站内通知渠道必须配置接收人' });
  }
}
