import { createAppWebhookRouter } from './app-webhooks-router';

export default createAppWebhookRouter({
  domain: 'all',
  viewPermission: 'open:webhook:view',
  managePermission: 'open:webhook:manage',
  tag: 'AppWebhooks',
  auditModule: '开放平台-Webhook',
});
