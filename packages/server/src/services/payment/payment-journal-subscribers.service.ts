import logger from '../../lib/logger';
import { paymentEventBus } from '../../lib/payment-event-bus';
import { postSystemJournal } from './payment-journal.service';

let registered = false;

function requireApplicationId(appId: number | null | undefined, eventId: string): number {
  if (appId == null) throw new Error(`Payment event ${eventId} is missing appId`);
  return appId;
}

/** 将支付与退款成功事件幂等过账到双分录 Journal。 */
export function registerPaymentJournalSubscribers(): void {
  if (registered) return;
  registered = true;

  paymentEventBus.on('payment.succeeded', (event) => {
    const amount = event.amount.toString();
    const preauthCapture = event.payMethod === 'wechat_preauth' || event.payMethod === 'alipay_preauth';
    return postSystemJournal({
      tenantId: event.tenantId ?? null,
      operatorId: null,
      sourceType: preauthCapture ? 'payment.preauth.capture' : 'payment.capture',
      sourceId: event.orderNo,
      description: `支付收款 ${event.orderNo}`,
      appId: requireApplicationId(event.appId, event.eventId),
      channelConfigId: event.channelConfigId,
      currency: event.currency,
      lines: preauthCapture
        ? [
            { accountCode: 'merchant_frozen', debitAmount: amount, memo: '预授权冻结负债减少' },
            { accountCode: 'merchant_available', creditAmount: amount, memo: '商户可用余额增加' },
          ]
        : [
            { accountCode: 'provider_clearing', debitAmount: amount, memo: '渠道应收增加' },
            { accountCode: 'merchant_available', creditAmount: amount, memo: '商户可用余额增加' },
          ],
    }).then(() => undefined).catch((err) => {
      logger.error('[payment-journal] post payment journal failed', { orderNo: event.orderNo, err });
      throw err;
    });
  });

  paymentEventBus.on('refund.succeeded', (event) => {
    if (!event.refundNo || !event.refundAmount || event.refundAmount <= 0) {
      throw new Error(`Refund event ${event.eventId} is missing refundNo or refundAmount`);
    }
    const amount = event.refundAmount.toString();
    return postSystemJournal({
      tenantId: event.tenantId ?? null,
      operatorId: null,
      sourceType: 'payment.refund',
      sourceId: event.refundNo,
      description: `支付退款 ${event.refundNo}`,
      appId: requireApplicationId(event.appId, event.eventId),
      channelConfigId: event.channelConfigId,
      currency: event.currency,
      lines: [
        { accountCode: 'merchant_available', debitAmount: amount, memo: '商户可用余额减少' },
        { accountCode: 'provider_clearing', creditAmount: amount, memo: '渠道应收减少' },
      ],
    }).then(() => undefined).catch((err) => {
      logger.error('[payment-journal] post refund journal failed', { orderNo: event.orderNo, err });
      throw err;
    });
  });

  logger.info('Payment journal subscribers registered');
}
