/**
 * 适配器集中注册入口。
 *
 * 与 `initPaymentAdapters()` 同构：在 bootstrap 阶段调用一次，
 * 之后派发器通过注册表按 channel 取用。
 */
import { registerNotificationAdapter } from '../registry';
import { chatAdapter } from './chat.adapter';
import { emailAdapter } from './email.adapter';
import { inAppAdapter } from './inapp.adapter';
import { smsAdapter } from './sms.adapter';
import { webhookAdapter } from './webhook.adapter';

export function initNotificationAdapters(): void {
  registerNotificationAdapter(inAppAdapter);
  registerNotificationAdapter(emailAdapter);
  registerNotificationAdapter(smsAdapter);
  registerNotificationAdapter(webhookAdapter);
  registerNotificationAdapter(chatAdapter);
}
