import { and, eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { PAYMENT_CHANNEL_LABELS } from '@zenith/shared/payment';
import type { PaymentChannel } from '@zenith/shared/payment';
import { db } from '../../db';
import { paymentChannelConfigs } from '../../db/schema';
import type { PaymentChannelConfigRow } from '../../db/schema';

export async function resolvePaymentChannelConfig(input: {
  channel: PaymentChannel;
  channelConfigId?: number;
  scope?: SQL;
}): Promise<PaymentChannelConfigRow> {
  if (input.channelConfigId) {
    const [row] = await db
      .select()
      .from(paymentChannelConfigs)
      .where(and(eq(paymentChannelConfigs.id, input.channelConfigId), input.scope))
      .limit(1);
    if (!row) throw new HTTPException(404, { message: '支付渠道配置不存在' });
    return row;
  }

  const [row] = await db
    .select()
    .from(paymentChannelConfigs)
    .where(and(
      eq(paymentChannelConfigs.channel, input.channel),
      eq(paymentChannelConfigs.isDefault, true),
      eq(paymentChannelConfigs.status, 'enabled'),
      input.scope,
    ))
    .limit(1);
  if (!row) {
    throw new HTTPException(400, {
      message: `未配置默认${PAYMENT_CHANNEL_LABELS[input.channel]}支付渠道`,
    });
  }
  return row;
}
