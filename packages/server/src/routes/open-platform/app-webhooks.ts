import { appWebhookContract } from '@zenith/shared/open-platform';
import { createAppWebhookRouter } from './app-webhooks-router';

export default createAppWebhookRouter(appWebhookContract, {
  domain: 'all',
  viewPermission: 'open:webhook:view',
  managePermission: 'open:webhook:manage',
  auditModule: '开放平台-Webhook',
});
