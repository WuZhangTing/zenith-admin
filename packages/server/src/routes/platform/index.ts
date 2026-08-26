import { upgradeWebSocket } from '@hono/node-server';
import { defineRouteDomain } from '../_kit';
import cacheRoutes from './cache';
import dataMaskConfigsRoutes from './data-mask-configs';
import dictsRoutes from './dicts';
import healthRoutes from './health';
import ipAccessLogsRoutes from './ip-access-logs';
import monitorAlertsRoutes from './monitor-alerts';
import monitorRoutes from './monitor';
import operationLogsRoutes from './operation-logs';
import rateLimitRoutes from './rate-limit';
import regionsRoutes from './regions';
import rulesExecutionsRoutes from './rules-executions';
import rulesFlowsRoutes from './rules-flows';
import rulesListsRoutes from './rules-lists';
import rulesScorecardsRoutes from './rules-scorecards';
import rulesRoutes from './rules';
import systemConfigsRoutes from './system-configs';
import licensingRoutes from './licensing';
import tagsRoutes from './tags';
import userFeedbacksRoutes from './user-feedbacks';
import { createWsRoute } from './ws';

export default defineRouteDomain({
  name: 'platform',
  mounts: () => [
    ['/api/dicts', dictsRoutes],
    ['/api/monitor', monitorRoutes],
    ['/api/monitor-alerts', monitorAlertsRoutes],
    ['/api/operation-logs', operationLogsRoutes],
    ['/api/ip-access-logs', ipAccessLogsRoutes],
    ['/api/system-configs', systemConfigsRoutes],
    // License 管理面永不打 feature 标（受限模式下也必须可达，否则无法自救）
    ['/api/licensing', licensingRoutes],
    ['/api/feedbacks', userFeedbacksRoutes],
    ['/api/data-mask-configs', dataMaskConfigsRoutes],
    ['/api/regions', regionsRoutes],
    ['/api/cache', cacheRoutes],
    ['/api/rules/decision-tables', rulesRoutes, { feature: 'rules' }],
    ['/api/rules/decision-flows', rulesFlowsRoutes, { feature: 'rules' }],
    ['/api/rules/executions', rulesExecutionsRoutes, { feature: 'rules' }],
    ['/api/rules/lists', rulesListsRoutes, { feature: 'rules' }],
    ['/api/rules/scorecards', rulesScorecardsRoutes, { feature: 'rules' }],
    ['/api/tags', tagsRoutes],
    ['/api/rate-limit', rateLimitRoutes],
    ['/api/ws', createWsRoute(upgradeWebSocket)],
    ['/api/health', healthRoutes],
  ],
});
