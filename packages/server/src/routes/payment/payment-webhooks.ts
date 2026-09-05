import { paymentWebhookContract } from '@zenith/shared/open-platform';
import { createAppWebhookRouter } from '../open-platform/app-webhooks-router';

export default createAppWebhookRouter(paymentWebhookContract, {
  domain: 'payment',
  viewPermission: 'payment:webhook:list',
  managePermission: 'payment:webhook:manage',
  auditModule: '支付中心-Webhook',
});
