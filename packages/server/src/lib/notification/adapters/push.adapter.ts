/**
 * App 推送渠道适配器。
 *
 * 寻址:按收件人查统一设备中心的在活可推送设备（pushEnabled + 窗口内活跃 +
 * 已绑 registrationId），多设备聚合为一次投递（address = 逗号连接的 registrationId）。
 * 无绑定设备按「不可达」留痕,与"没绑邮箱"同语义。
 * external 收件人无推送形态,恒不可达。
 */
import { eq } from 'drizzle-orm';
import type { NotificationRecipient } from '@zenith/shared/messaging';
import { db } from '../../../db';
import { pushSendLogs } from '../../../db/schema';
import { findDefaultPushConfig } from '../../../services/messaging/push-configs.service';
import { findPushableDevices } from '../../../services/ops/client-devices.service';
import { sendPushByProvider } from '../../push-sender';
import type { DeliveryContext, DeliveryResult, NotificationChannelAdapter } from '../types';

export const pushAdapter: NotificationChannelAdapter = {
  channel: 'push',

  async resolveAddress(recipient: NotificationRecipient): Promise<string | null> {
    if (recipient.type === 'external') return null;
    const devices = await findPushableDevices(recipient.type, recipient.id);
    if (devices.length === 0) return null;
    return devices.map((d) => d.pushRegistrationId as string).join(',');
  },

  async send(ctx: DeliveryContext): Promise<DeliveryResult> {
    const config = await findDefaultPushConfig();
    if (!config) throw new Error('未配置默认推送服务商');

    const registrationIds = ctx.target.address.split(',').filter(Boolean);
    const pushOptions = ctx.options?.push;
    const title = pushOptions?.title ?? ctx.title;

    const [log] = await db.insert(pushSendLogs).values({
      configId: config.id,
      provider: config.provider,
      subjectType: ctx.target.recipient.type === 'external' ? null : ctx.target.recipient.type,
      subjectId: ctx.target.subjectId,
      deviceCount: registrationIds.length,
      title,
      content: ctx.content,
      link: ctx.link,
      eventKey: ctx.eventKey,
      status: 'pending',
      source: 'system',
      tenantId: ctx.tenantId,
    }).returning({ id: pushSendLogs.id });

    const result = await sendPushByProvider({
      config,
      registrationIds,
      title,
      content: ctx.content,
      link: ctx.link,
      extras: pushOptions?.extras,
    });

    await db.update(pushSendLogs).set({
      status: result.success ? 'success' : 'failed',
      providerMsgId: result.msgId,
      errorMsg: result.errorMsg,
      sentAt: new Date(),
    }).where(eq(pushSendLogs.id, log.id));

    if (!result.success) throw new Error(result.errorMsg || 'App 推送发送失败');
    return { providerMsgId: result.msgId ?? String(log.id) };
  },
};
