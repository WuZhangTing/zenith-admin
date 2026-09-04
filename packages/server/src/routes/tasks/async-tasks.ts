import { OpenAPIHono } from '@hono/zod-openapi';
import { asyncTaskContract } from '@zenith/shared/tasks';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { okBody, validationHook } from '../../lib/openapi-schemas';
import {
  batchCancelTasks,
  batchDeleteTasks,
  cancelTask,
  cleanupFinishedTasks,
  deleteAsyncTask,
  getAsyncTask,
  getAsyncTaskStats,
  listAsyncTaskItems,
  listAsyncTasks,
  listAsyncTaskTypes,
  listMyAsyncTasks,
  restartTask,
  resumeTask,
  updateAsyncTaskTypePolicy,
} from '../../services/tasks/async-tasks.service';

const asyncTasksRoute = new OpenAPIHono({ defaultHook: validationHook });

const typesRoute = defineContractRoute(asyncTaskContract.types, {
  middleware: [authMiddleware],
  handler: async (c) => c.json(okBody(await listAsyncTaskTypes()), 200),
});

const updateTypePolicyRoute = defineContractRoute(asyncTaskContract.updateTypePolicy, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:config', audit: { description: '更新任务类型策略', module: '任务中心' } })],
  handler: async (c) => {
    const { taskType } = c.req.valid('param');
    const meta = await updateAsyncTaskTypePolicy(taskType, c.req.valid('json'));
    return c.json(okBody(meta, '策略已更新'), 200);
  },
});

const statsRoute = defineContractRoute(asyncTaskContract.stats, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:list' })],
  handler: async (c) => c.json(okBody(await getAsyncTaskStats()), 200),
});

const mineRoute = defineContractRoute(asyncTaskContract.mine, {
  middleware: [authMiddleware],
  handler: async (c) => c.json(okBody(await listMyAsyncTasks(c.req.valid('query'))), 200),
});

const listRoute = defineContractRoute(asyncTaskContract.list, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:list' })],
  handler: async (c) => c.json(okBody(await listAsyncTasks(c.req.valid('query'))), 200),
});

const getOneRoute = defineContractRoute(asyncTaskContract.detail, {
  middleware: [authMiddleware],
  handler: async (c) => c.json(okBody(await getAsyncTask(c.req.valid('param').id)), 200),
});

const itemsRoute = defineContractRoute(asyncTaskContract.items, {
  middleware: [authMiddleware],
  handler: async (c) => c.json(okBody(await listAsyncTaskItems(c.req.valid('param').id, c.req.valid('query'))), 200),
});

const batchCancelRoute = defineContractRoute(asyncTaskContract.batchCancel, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:manage', audit: { description: '批量取消异步任务', module: '任务中心' } })],
  handler: async (c) => {
    const result = await batchCancelTasks(c.req.valid('json').ids);
    return c.json(okBody(result, `已请求取消 ${result.affected} 个任务`), 200);
  },
});

const batchDeleteRoute = defineContractRoute(asyncTaskContract.batchDelete, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:manage', audit: { description: '批量删除异步任务', module: '任务中心' } })],
  handler: async (c) => {
    const result = await batchDeleteTasks(c.req.valid('json').ids);
    return c.json(okBody(result, `已删除 ${result.affected} 个任务记录`), 200);
  },
});

const cancelRoute = defineContractRoute(asyncTaskContract.cancel, {
  middleware: [authMiddleware, guard({ audit: { description: '取消异步任务', module: '任务中心' } })],
  handler: async (c) => c.json(okBody(await cancelTask(c.req.valid('param').id), '已请求取消'), 200),
});

const resumeRoute = defineContractRoute(asyncTaskContract.resume, {
  middleware: [authMiddleware, guard({ audit: { description: '断点恢复异步任务', module: '任务中心' } })],
  handler: async (c) => c.json(okBody(await resumeTask(c.req.valid('param').id), '已从断点恢复'), 200),
});

const restartRoute = defineContractRoute(asyncTaskContract.restart, {
  middleware: [authMiddleware, guard({ audit: { description: '重新开始异步任务', module: '任务中心' } })],
  handler: async (c) => c.json(okBody(await restartTask(c.req.valid('param').id), '已重新开始'), 200),
});

const deleteRoute = defineContractRoute(asyncTaskContract.remove, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:manage', audit: { description: '删除异步任务', module: '任务中心' } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await deleteAsyncTask(id);
    setAuditBeforeData(c, before);
    return c.json(okBody(null, '已删除'), 200);
  },
});

const cleanupRoute = defineContractRoute(asyncTaskContract.cleanup, {
  middleware: [authMiddleware, guard({ permission: 'system:async-task:cleanup', audit: { description: '清理异步任务记录', module: '任务中心' } })],
  handler: async (c) => {
    const result = await cleanupFinishedTasks();
    return c.json(okBody(result, `已清理 ${result.cleaned} 条任务记录`), 200);
  },
});

asyncTasksRoute.openapiRoutes([
  typesRoute, updateTypePolicyRoute, statsRoute, mineRoute, listRoute, cleanupRoute,
  batchCancelRoute, batchDeleteRoute, getOneRoute, itemsRoute,
  cancelRoute, resumeRoute, restartRoute, deleteRoute,
] as const);

export default asyncTasksRoute;
