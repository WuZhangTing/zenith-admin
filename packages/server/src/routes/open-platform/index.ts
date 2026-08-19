import { defineRouteDomain } from '../_kit';
import apiScopesRoutes from './api-scopes';
import appWebhooksRoutes from './app-webhooks';
import developerAppsRoutes from './developer-apps';
import oauth2AuthRoutes from './oauth2-auth';
import oauth2ClientsRoutes from './oauth2-clients';
import openApiStatsRoutes from './open-api-stats';
import openGatewayRoutes from './open-gateway';
import openSignatureRoutes from './open-signature';
import ratePlansRoutes from './rate-plans';

export default defineRouteDomain({
  name: 'open-platform',
  mounts: () => [
    ['/api/oauth2/clients', oauth2ClientsRoutes, { feature: 'open-platform' }],
    ['/api/oauth2', oauth2AuthRoutes],
    ['/api/api-scopes', apiScopesRoutes, { feature: 'open-platform' }],
    ['/api/rate-plans', ratePlansRoutes, { feature: 'open-platform' }],
    ['/api/open-signature', openSignatureRoutes, { feature: 'open-platform' }],
    ['/api/open-api-stats', openApiStatsRoutes, { feature: 'open-platform' }],
    ['/api/app-webhooks', appWebhooksRoutes, { feature: 'open-platform' }],
    ['/api/developer-apps', developerAppsRoutes, { feature: 'open-platform' }],
    ['/api/open', openGatewayRoutes],
  ],
});
