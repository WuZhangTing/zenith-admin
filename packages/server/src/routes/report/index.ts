import { defineRouteDomain } from '../_kit';
import reportAiRoutes from './report-ai';
import reportAlertsRoutes from './report-alerts';
import reportAssetsRoutes from './report-assets';
import reportCategoriesRoutes from './report-categories';
import reportChatbiRoutes from './report-chatbi';
import reportDashboardOpsRoutes from './report-dashboard-ops';
import reportDashboardsRoutes from './report-dashboards';
import reportDatasetsRoutes from './report-datasets';
import reportDatasourcesRoutes from './report-datasources';
import reportDeliveryRunsRoutes from './report-delivery-runs';
import reportDqRoutes from './report-dq';
import reportEnvironmentsRoutes from './report-environments';
import reportExecutionsRoutes from './report-executions';
import reportFillRoutes from './report-fill';
import reportFoldersRoutes from './report-folders';
import reportGovernanceRoutes from './report-governance';
import reportMaterializationsRoutes from './report-materializations';
import reportMetaRoutes from './report-meta';
import reportMetricsRoutes from './report-metrics';
import reportPrintRoutes from './report-print';
import reportPublicRoutes from './report-public';
import reportQueryCapacityRoutes from './report-query-capacity';
import reportSlaRoutes from './report-sla';
import reportSubscriptionsRoutes from './report-subscriptions';

export default defineRouteDomain({
  name: 'report',
  mounts: () => [
    ['/api/report/datasources', reportDatasourcesRoutes, { feature: 'report' }],
    ['/api/report/datasets', reportDatasetsRoutes, { feature: 'report' }],
    ['/api/report/dashboards', reportDashboardsRoutes, { feature: 'report' }],
    ['/api/report/dashboards', reportDashboardOpsRoutes, { feature: 'report' }],
    ['/api/report/categories', reportCategoriesRoutes, { feature: 'report' }],
    ['/api/report/subscriptions', reportSubscriptionsRoutes, { feature: 'report' }],
    ['/api/report/public', reportPublicRoutes],
    ['/api/report/print', reportPrintRoutes, { feature: 'report' }],
    ['/api/report/ai', reportAiRoutes, { feature: 'report' }],
    ['/api/report/alerts', reportAlertsRoutes, { feature: 'report' }],
    ['/api/report/folders', reportFoldersRoutes, { feature: 'report' }],
    ['/api/report/metrics', reportMetricsRoutes, { feature: 'report' }],
    ['/api/report/governance', reportGovernanceRoutes, { feature: 'report' }],
    ['/api/report/environments', reportEnvironmentsRoutes, { feature: 'report' }],
    ['/api/report/meta', reportMetaRoutes, { feature: 'report' }],
    ['/api/report/executions', reportExecutionsRoutes, { feature: 'report' }],
    ['/api/report/delivery-runs', reportDeliveryRunsRoutes, { feature: 'report' }],
    ['/api/report/dq', reportDqRoutes, { feature: 'report' }],
    ['/api/report/materializations', reportMaterializationsRoutes, { feature: 'report' }],
    ['/api/report/query-capacity', reportQueryCapacityRoutes, { feature: 'report' }],
    ['/api/report/sla', reportSlaRoutes, { feature: 'report' }],
    ['/api/report/assets', reportAssetsRoutes, { feature: 'report' }],
    ['/api/report/chatbi', reportChatbiRoutes, { feature: 'report' }],
    ['/api/report/fill', reportFillRoutes, { feature: 'report' }],
  ],
});
