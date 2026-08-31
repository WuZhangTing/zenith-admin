import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { oauth2Clients, paymentApps } from '../../db/schema';
import { openEventBus } from '../../lib/open-event-bus';
import { paymentEventBus } from '../../lib/payment-event-bus';
import logger from '../../lib/logger';

let registered = false;

export function registerPaymentOpenWebhookBridge(): void {
  if (registered) return;
  registered = true;
  paymentEventBus.onAny(async (event) => {
    if (event.appId == null) throw new Error(`Payment event ${event.eventId} has no application scope`);
    const tenantScope = event.tenantId == null ? isNull(paymentApps.tenantId) : eq(paymentApps.tenantId, event.tenantId);
    const [binding] = await db
      .select({ clientId: oauth2Clients.clientId })
      .from(paymentApps)
      .innerJoin(oauth2Clients, eq(oauth2Clients.id, paymentApps.openClientId))
      .where(and(
        eq(paymentApps.id, event.appId),
        eq(paymentApps.status, 'enabled'),
        eq(oauth2Clients.status, 'enabled'),
        tenantScope,
      ))
      .limit(1);
    if (!binding) throw new Error(`Payment application ${event.appId} is not bound to an open client`);
    await openEventBus.emitAndWait({
      type: event.type,
      clientId: binding.clientId,
      tenantId: event.tenantId ?? null,
      eventId: event.eventId,
      data: {
        orderNo: event.orderNo,
        bizType: event.bizType,
        bizId: event.bizId,
        channel: event.channel,
        payMethod: event.payMethod ?? null,
        currency: event.currency,
        amount: event.amount,
        originalAmount: event.originalAmount ?? null,
        refundNo: event.refundNo ?? null,
        refundAmount: event.refundAmount ?? null,
        occurredAt: event.occurredAt,
      },
    });
  });
  logger.info('[payment-open-webhook] bridge registered');
}
