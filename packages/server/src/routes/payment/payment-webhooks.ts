import { createAppWebhookRouter } from '../open-platform/app-webhooks-router';

export default createAppWebhookRouter({
  domain: 'payment',
  viewPermission: 'payment:webhook:list',
  managePermission: 'payment:webhook:manage',
  tag: '支付中心-Webhook',
  auditModule: '支付中心-Webhook',
});
