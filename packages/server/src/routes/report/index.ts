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
    ['/api/report/datasources', reportDatasourcesRoutes],
    ['/api/report/datasets', reportDatasetsRoutes],
    ['/api/report/dashboards', reportDashboardsRoutes],
    ['/api/report/dashboards', reportDashboardOpsRoutes],
    ['/api/report/categories', reportCategoriesRoutes],
    ['/api/report/subscriptions', reportSubscriptionsRoutes],
    ['/api/report/public', reportPublicRoutes],
    ['/api/report/print', reportPrintRoutes],
    ['/api/report/ai', reportAiRoutes],
    ['/api/report/alerts', reportAlertsRoutes],
    ['/api/report/folders', reportFoldersRoutes],
    ['/api/report/metrics', reportMetricsRoutes],
    ['/api/report/governance', reportGovernanceRoutes],
    ['/api/report/environments', reportEnvironmentsRoutes],
    ['/api/report/meta', reportMetaRoutes],
    ['/api/report/executions', reportExecutionsRoutes],
    ['/api/report/delivery-runs', reportDeliveryRunsRoutes],
    ['/api/report/dq', reportDqRoutes],
    ['/api/report/materializations', reportMaterializationsRoutes],
    ['/api/report/query-capacity', reportQueryCapacityRoutes],
    ['/api/report/sla', reportSlaRoutes],
    ['/api/report/assets', reportAssetsRoutes],
    ['/api/report/chatbi', reportChatbiRoutes],
    ['/api/report/fill', reportFillRoutes],
  ],
});
