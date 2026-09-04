import { OpenAPIHono } from '@hono/zod-openapi';
import { systemSchedulerContract } from '@zenith/shared/platform';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { okBody, validationHook } from '../../lib/openapi-schemas';
import {
  acknowledgeSystemSchedulerRunAlert,
  cleanupSystemSchedulerRuns,
  getSystemSchedulerRun,
  listSystemSchedulerNodes,
  listSystemSchedulerRuns,
  listSystemSchedulerTasks,
  runSystemSchedulerTask,
  updateSystemSchedulerTaskConfig,
} from '../../services/tasks/system-scheduler.service';

const systemSchedulerRoutes = new OpenAPIHono({ defaultHook: validationHook });

const view = [authMiddleware, guard({ permission: 'system:scheduler:view' })] as const;

const tasksRoute = defineContractRoute(systemSchedulerContract.tasks, {
  middleware: view,
  handler: async (c) => c.json(okBody(await listSystemSchedulerTasks()), 200),
});

const runsRoute = defineContractRoute(systemSchedulerContract.runs, {
  middleware: view,
  handler: async (c) => c.json(okBody(await listSystemSchedulerRuns(c.req.valid('query'))), 200),
});

const runDetailRoute = defineContractRoute(systemSchedulerContract.runDetail, {
  middleware: view,
  handler: async (c) => c.json(okBody(await getSystemSchedulerRun(c.req.valid('param').id)), 200),
});

const acknowledgeAlertRoute = defineContractRoute(systemSchedulerContract.acknowledgeAlert, {
  middleware: [authMiddleware, guard({ permission: 'system:scheduler:alert', audit: { module: '系统调度', description: '确认系统调度告警' } })],
  handler: async (c) => c.json(okBody(await acknowledgeSystemSchedulerRunAlert(c.req.valid('param').id, c.req.valid('json').note)), 200),
});

const nodesRoute = defineContractRoute(systemSchedulerContract.nodes, {
  middleware: view,
  handler: async (c) => c.json(okBody(await listSystemSchedulerNodes(c.req.valid('query'))), 200),
});

const runRoute = defineContractRoute(systemSchedulerContract.runTask, {
  middleware: [authMiddleware, guard({ permission: 'system:scheduler:run', audit: { module: '系统调度', description: '手动执行系统周期任务' } })],
  handler: async (c) => c.json(okBody(await runSystemSchedulerTask(c.req.valid('param').name), '执行完成'), 200),
});

const updateConfigRoute = defineContractRoute(systemSchedulerContract.updateTaskConfig, {
  middleware: [authMiddleware, guard({ permission: 'system:scheduler:config', audit: { module: '系统调度', description: '更新系统调度任务策略' } })],
  handler: async (c) => c.json(okBody(await updateSystemSchedulerTaskConfig(c.req.valid('param').name, c.req.valid('json'))), 200),
});

const cleanupRunsRoute = defineContractRoute(systemSchedulerContract.cleanupRuns, {
  middleware: [authMiddleware, guard({ permission: 'system:scheduler:cleanup', audit: { module: '系统调度', description: '手动清理系统调度运行日志' } })],
  handler: async (c) => c.json(okBody(await cleanupSystemSchedulerRuns(c.req.valid('query')), '清理完成'), 200),
});

systemSchedulerRoutes.openapiRoutes([tasksRoute, runsRoute, cleanupRunsRoute, runDetailRoute, acknowledgeAlertRoute, nodesRoute, runRoute, updateConfigRoute] as const);

export default systemSchedulerRoutes;
