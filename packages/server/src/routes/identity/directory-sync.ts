import { OpenAPIHono } from '@hono/zod-openapi';
import { directorySyncContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody, errBody } from '../../lib/openapi-schemas';
import {
  listDirectorySyncRuns, getDirectorySyncRun, listDirectorySyncRunItems, retryDirectorySyncRun,
  listDirectorySyncConflicts, resolveDirectorySyncConflict, ignoreDirectorySyncConflicts,
  ensureDirectorySyncConflictExists,
} from '../../services/identity/directory-sync.service';
import { currentUserId } from '../../lib/context';

const directorySyncRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── 同步记录 ─────────────────────────────────────────────────────────────────
const listRunsRoute = defineContractRoute(directorySyncContract.listRuns, {
  middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:list' })] as const,
  handler: async (c) => c.json(okBody(await listDirectorySyncRuns(c.req.valid('query'))), 200),
});

const getRunRoute = defineContractRoute(directorySyncContract.runDetail, {
  middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:list' })] as const,
  handler: async (c) => c.json(okBody(await getDirectorySyncRun(c.req.valid('param').id)), 200),
});

const listRunItemsRoute = defineContractRoute(directorySyncContract.listRunItems, {
  middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:detail' })] as const,
  handler: async (c) => c.json(okBody(await listDirectorySyncRunItems(c.req.valid('param').id, c.req.valid('query'))), 200),
});

const retryRunRoute = defineContractRoute(directorySyncContract.retryRun, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-log:retry',
    audit: { description: '重试通讯录同步', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const task = await retryDirectorySyncRun(c.req.valid('param').id);
    return c.json(okBody(task, '重试任务已提交'), 200);
  },
});

// ─── 冲突处理 ─────────────────────────────────────────────────────────────────
const listConflictsRoute = defineContractRoute(directorySyncContract.listConflicts, {
  middleware: [authMiddleware, guard({ permission: 'system:dirsync-conflict:list' })] as const,
  handler: async (c) => c.json(okBody(await listDirectorySyncConflicts(c.req.valid('query'))), 200),
});

const ignoreConflictsRoute = defineContractRoute(directorySyncContract.ignoreConflicts, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-conflict:ignore',
    audit: { description: '批量忽略通讯录同步冲突', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    if (!ids?.length) return c.json(errBody('请选择要忽略的冲突'), 400);
    const count = await ignoreDirectorySyncConflicts(ids, currentUserId());
    return c.json(okBody(null, `已忽略 ${count} 条冲突`), 200);
  },
});

const resolveConflictRoute = defineContractRoute(directorySyncContract.resolveConflict, {
  middleware: [authMiddleware, guard({
    permission: 'system:dirsync-conflict:resolve',
    audit: { description: '裁决通讯录同步冲突', module: '通讯录同步' },
  })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncConflictExists(id));
    const row = await resolveDirectorySyncConflict(id, c.req.valid('json'), currentUserId());
    return c.json(okBody(row, '裁决成功'), 200);
  },
});

directorySyncRouter.openapiRoutes([
  listRunsRoute,
  getRunRoute,
  listRunItemsRoute,
  retryRunRoute,
  listConflictsRoute,
  ignoreConflictsRoute,
  resolveConflictRoute,
] as const);

export default directorySyncRouter;
