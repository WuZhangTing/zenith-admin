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
    ['/api/analytics', analyticsRoutes],
    ['/api/analytics', analyticsSitesRoutes],
    ['/api/analytics', analyticsCampaignsRoutes],
    ['/api/analytics', analyticsExperimentsRoutes],
    ['/api/frontend-errors', frontendErrorsRoutes],
    ['/api/dashboard', dashboardRoutes],
  ],
});
