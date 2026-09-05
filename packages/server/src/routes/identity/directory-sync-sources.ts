import { OpenAPIHono } from '@hono/zod-openapi';
import { directorySyncSourceContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  listDirectorySyncSources, getDirectorySyncSource, createDirectorySyncSource,
  updateDirectorySyncSource, deleteDirectorySyncSource, ensureDirectorySyncSourceExists,
  testDirectorySyncSourceConnection, submitDirectorySyncTask,
} from '../../services/identity/directory-sync.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:dirsync-source:list' })] as const;

const listSourcesRoute = defineContractRoute(directorySyncSourceContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listDirectorySyncSources(c.req.valid('query'))), 200),
});

const getSourceRoute = defineContractRoute(directorySyncSourceContract.detail, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getDirectorySyncSource(c.req.valid('param').id)), 200),
});

const createSourceRoute = defineContractRoute(directorySyncSourceContract.create, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-source:create',
    audit: { description: '创建通讯录同步源', module: '通讯录同步' },
  })] as const,
  handler: async (c) => c.json(okBody(await createDirectorySyncSource(c.req.valid('json')), '创建成功'), 200),
});

const updateSourceRoute = defineContractRoute(directorySyncSourceContract.update, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-source:edit',
    audit: { description: '更新通讯录同步源', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncSourceExists(id));
    return c.json(okBody(await updateDirectorySyncSource(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteSourceRoute = defineContractRoute(directorySyncSourceContract.remove, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-source:delete',
    audit: { description: '删除通讯录同步源', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncSourceExists(id));
    await deleteDirectorySyncSource(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const testSourceRoute = defineContractRoute(directorySyncSourceContract.test, {
  middleware: [authMiddleware, guard({ permission: 'system:dirsync-source:test' })] as const,
  handler: async (c) => c.json(okBody(await testDirectorySyncSourceConnection(c.req.valid('param').id)), 200),
});

const previewSourceRoute = defineContractRoute(directorySyncSourceContract.preview, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-source:preview',
    audit: { description: '预览通讯录同步差异', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const task = await submitDirectorySyncTask(c.req.valid('param').id, true);
    return c.json(okBody(task, '预览任务已提交，请在同步记录中查看差异'), 200);
  },
});

const runSourceRoute = defineContractRoute(directorySyncSourceContract.run, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-source:run',
    audit: { description: '手动触发通讯录同步', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const task = await submitDirectorySyncTask(c.req.valid('param').id, false);
    return c.json(okBody(task, '同步任务已提交'), 200);
  },
});

router.openapiRoutes([
  listSourcesRoute,
  createSourceRoute,
  getSourceRoute,
  updateSourceRoute,
  deleteSourceRoute,
  testSourceRoute,
  previewSourceRoute,
  runSourceRoute,
] as const);

export default router;
