import { defineRouteDomain } from '../_kit';
import analyticsCampaignsRoutes from './analytics-campaigns';
import analyticsExperimentsRoutes from './analytics-experiments';
import analyticsRoutes from './analytics';
import analyticsSitesRoutes from './analytics-sites';
import dashboardRoutes from './dashboard';
import frontendErrorsRoutes from './frontend-errors';

export default defineRouteDomain({
  name: 'analytics',
  mounts: () => [
    ['/api/analytics', analyticsRoutes, { feature: 'analytics' }],
    ['/api/analytics', analyticsSitesRoutes, { feature: 'analytics' }],
    ['/api/analytics', analyticsCampaignsRoutes, { feature: 'analytics' }],
    ['/api/analytics', analyticsExperimentsRoutes, { feature: 'analytics' }],
    ['/api/frontend-errors', frontendErrorsRoutes],
    ['/api/dashboard', dashboardRoutes],
  ],
});
