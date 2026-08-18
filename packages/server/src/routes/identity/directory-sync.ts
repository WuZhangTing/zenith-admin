import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, BatchIdsBody, okBody, errBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import {
  DirectorySyncSourceDTO, DirectorySyncRunDTO, DirectorySyncRunItemDTO,
  DirectorySyncConflictDTO, DirectorySyncConnectionTestDTO, AsyncTaskDTO,
} from '../../lib/openapi-dtos';
import {
  listDirectorySyncSources, getDirectorySyncSource, createDirectorySyncSource,
  updateDirectorySyncSource, deleteDirectorySyncSource, ensureDirectorySyncSourceExists,
  testDirectorySyncSourceConnection, submitDirectorySyncTask,
  listDirectorySyncRuns, getDirectorySyncRun, listDirectorySyncRunItems, retryDirectorySyncRun,
  listDirectorySyncConflicts, resolveDirectorySyncConflict, ignoreDirectorySyncConflicts,
  ensureDirectorySyncConflictExists,
} from '../../services/identity/directory-sync.service';
import {
  createDirectorySyncSourceSchema, updateDirectorySyncSourceSchema, resolveDirectorySyncConflictSchema,
  DIRECTORY_SYNC_SOURCE_TYPES, DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_CONFLICT_STATUSES, DIRECTORY_SYNC_ITEM_ACTIONS, DIRECTORY_SYNC_ENTITY_TYPES,
} from '@zenith/shared/identity';
import { currentUserId } from '../../lib/context';

const directorySyncRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── 同步源 ───────────────────────────────────────────────────────────────────
const listSourcesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/sources',
    tags: ['通讯录同步'], summary: '同步源列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-source:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        type: z.enum(DIRECTORY_SYNC_SOURCE_TYPES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DirectorySyncSourceDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listDirectorySyncSources(c.req.valid('query'))), 200),
});

const getSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/sources/{id}',
    tags: ['通讯录同步'], summary: '同步源详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-source:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(DirectorySyncSourceDTO, '同步源详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getDirectorySyncSource(id)), 200);
  },
});

const createSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/sources',
    tags: ['通讯录同步'], summary: '创建同步源',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-source:create',
      audit: { description: '创建通讯录同步源', module: '通讯录同步' },
    })] as const,
    request: { body: { content: jsonContent(createDirectorySyncSourceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DirectorySyncSourceDTO, '创建成功') },
  }),
  handler: async (c) => {
    const row = await createDirectorySyncSource(c.req.valid('json'));
    return c.json(okBody(row, '创建成功'), 200);
  },
});

const updateSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/sources/{id}',
    tags: ['通讯录同步'], summary: '更新同步源',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-source:edit',
      audit: { description: '更新通讯录同步源', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateDirectorySyncSourceSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(DirectorySyncSourceDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncSourceExists(id));
    const row = await updateDirectorySyncSource(id, c.req.valid('json'));
    return c.json(okBody(row, '更新成功'), 200);
  },
});

const deleteSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/sources/{id}',
    tags: ['通讯录同步'], summary: '删除同步源',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-source:delete',
      audit: { description: '删除通讯录同步源', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncSourceExists(id));
    await deleteDirectorySyncSource(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const testSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/sources/{id}/test',
    tags: ['通讯录同步'], summary: '测试同步源连接',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-source:test' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(DirectorySyncConnectionTestDTO, '测试结果') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await testDirectorySyncSourceConnection(id)), 200);
  },
});

const previewSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/sources/{id}/preview',
    tags: ['通讯录同步'], summary: '预览差异（dry-run，任务中心执行）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-source:preview',
      audit: { description: '预览通讯录同步差异', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '任务已提交') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const task = await submitDirectorySyncTask(id, true);
    return c.json(okBody(task, '预览任务已提交，请在同步记录中查看差异'), 200);
  },
});

const runSourceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/sources/{id}/run',
    tags: ['通讯录同步'], summary: '立即同步（任务中心执行）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-source:run',
      audit: { description: '手动触发通讯录同步', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '任务已提交') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const task = await submitDirectorySyncTask(id, false);
    return c.json(okBody(task, '同步任务已提交'), 200);
  },
});

// ─── 同步记录 ─────────────────────────────────────────────────────────────────
const listRunsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/runs',
    tags: ['通讯录同步'], summary: '同步记录列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        sourceId: z.coerce.number().int().positive().optional(),
        status: z.enum(DIRECTORY_SYNC_RUN_STATUSES).optional(),
        startTime: dateRangeBound('开始时间起'),
        endTime: dateRangeBound('开始时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DirectorySyncRunDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listDirectorySyncRuns(c.req.valid('query'))), 200),
});

const getRunRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/runs/{id}',
    tags: ['通讯录同步'], summary: '同步记录详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(DirectorySyncRunDTO, '同步记录详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getDirectorySyncRun(id)), 200);
  },
});

const listRunItemsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/runs/{id}/items',
    tags: ['通讯录同步'], summary: '同步记录差异明细',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-log:detail' })] as const,
    request: {
      params: IdParam,
      query: PaginationQuery.extend({
        action: z.enum(DIRECTORY_SYNC_ITEM_ACTIONS).optional(),
        entityType: z.enum(DIRECTORY_SYNC_ENTITY_TYPES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DirectorySyncRunItemDTO, 'ok') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listDirectorySyncRunItems(id, c.req.valid('query'))), 200);
  },
});

const retryRunRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/runs/{id}/retry',
    tags: ['通讯录同步'], summary: '失败重试（对所属源重新执行同步）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-log:retry',
      audit: { description: '重试通讯录同步', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '任务已提交') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const task = await retryDirectorySyncRun(id);
    return c.json(okBody(task, '重试任务已提交'), 200);
  },
});

// ─── 冲突处理 ─────────────────────────────────────────────────────────────────
const listConflictsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/conflicts',
    tags: ['通讯录同步'], summary: '冲突列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:dirsync-conflict:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        sourceId: z.coerce.number().int().positive().optional(),
        status: z.enum(DIRECTORY_SYNC_CONFLICT_STATUSES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DirectorySyncConflictDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listDirectorySyncConflicts(c.req.valid('query'))), 200),
});

const ignoreConflictsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/conflicts/ignore',
    tags: ['通讯录同步'], summary: '批量忽略冲突',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-conflict:ignore',
      audit: { description: '批量忽略通讯录同步冲突', module: '通讯录同步' },
    })] as const,
    request: { body: { content: jsonContent(BatchIdsBody), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('已忽略'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    if (!ids?.length) return c.json(errBody('请选择要忽略的冲突'), 400);
    const count = await ignoreDirectorySyncConflicts(ids, currentUserId());
    return c.json(okBody(null, `已忽略 ${count} 条冲突`), 200);
  },
});

const resolveConflictRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/conflicts/{id}/resolve',
    tags: ['通讯录同步'], summary: '裁决冲突',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:dirsync-conflict:resolve',
      audit: { description: '裁决通讯录同步冲突', module: '通讯录同步' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(resolveDirectorySyncConflictSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(DirectorySyncConflictDTO, '裁决成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDirectorySyncConflictExists(id));
    const row = await resolveDirectorySyncConflict(id, c.req.valid('json'), currentUserId());
    return c.json(okBody(row, '裁决成功'), 200);
  },
});

directorySyncRouter.openapiRoutes([
  listSourcesRoute,
  createSourceRoute,
  getSourceRoute,
  updateSourceRoute,
  deleteSourceRoute,
  testSourceRoute,
  previewSourceRoute,
  runSourceRoute,
  listRunsRoute,
  getRunRoute,
  listRunItemsRoute,
  retryRunRoute,
  listConflictsRoute,
  ignoreConflictsRoute,
  resolveConflictRoute,
] as const);

export default directorySyncRouter;
