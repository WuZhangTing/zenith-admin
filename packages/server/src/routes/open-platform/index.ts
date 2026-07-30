import { defineRouteDomain } from '../_kit';
import apiScopesRoutes from './api-scopes';
import apiTokensRoutes from './api-tokens';
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
    ['/api/api-tokens', apiTokensRoutes],
    ['/api/oauth2/clients', oauth2ClientsRoutes],
    ['/api/oauth2', oauth2AuthRoutes],
    ['/api/api-scopes', apiScopesRoutes],
    ['/api/rate-plans', ratePlansRoutes],
    ['/api/open-signature', openSignatureRoutes],
    ['/api/open-api-stats', openApiStatsRoutes],
    ['/api/app-webhooks', appWebhooksRoutes],
    ['/api/developer-apps', developerAppsRoutes],
    ['/api/open', openGatewayRoutes],
  ],
});
