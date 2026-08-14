import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  WIKI_DOC_STATUSES, createWikiDocSchema, moveWikiDocSchema, reviewWikiDocSchema,
  rollbackWikiDocSchema, updateWikiDocSchema,
} from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { WikiDocDTO, WikiDocTreeNodeDTO, WikiDocVersionDTO } from '../../lib/openapi-dtos';
import {
  createWikiDoc, deleteWikiDoc, ensureWikiDocExists, favoriteWikiDoc, getWikiDoc,
  getWikiDocTree, getWikiDocVersion, listMyFavoriteWikiDocs, listRecentWikiDocs, listWikiDocVersions,
  listWikiDocs, mapWikiDoc, moveWikiDoc, purgeWikiDoc, recordWikiDocView, reportWikiSearchClick,
  restoreWikiDoc, reviewWikiDoc, rollbackWikiDoc, searchWikiDocs, submitWikiDoc, updateWikiDoc,
} from '../../services/wiki/docs.service';

const docsRouter = new OpenAPIHono({ defaultHook: validationHook });

const DocListQuery = PaginationQuery.extend({
  keyword: z.string().optional(),
  spaceId: z.coerce.number().int().positive().optional(),
  status: z.enum(WIKI_DOC_STATUSES).optional(),
  tagId: z.coerce.number().int().positive().optional(),
  mine: z.coerce.boolean().optional(),
});

const VersionParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' }, example: 1, description: '文档 ID' }),
  version: z.coerce.number().int().positive().openapi({ param: { name: 'version', in: 'path' }, example: 1, description: '版本号' }),
});

// ─── 列表与树 ─────────────────────────────────────────────────────────────────

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-文档'], summary: '文档列表（搜索 / 管理）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { query: DocListQuery },
    responses: { ...commonErrorResponses, ...okPaginated(WikiDocDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listWikiDocs(c.req.valid('query'))), 200),
});

const searchRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/search',
    tags: ['知识中心-文档'], summary: '全文检索（标题>摘要>正文加权，返回命中片段）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().min(1).openapi({ param: { name: 'keyword', in: 'query' }, example: '入职' }),
        spaceId: z.coerce.number().int().positive().optional(),
        status: z.enum(WIKI_DOC_STATUSES).optional(),
        tagId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(WikiDocDTO, '检索结果') },
  }),
  handler: async (c) => c.json(okBody(await searchWikiDocs(c.req.valid('query'))), 200),
});

const searchClickRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/search/click',
    tags: ['知识中心-文档'], summary: '搜索点击回报（统计搜索成功率）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: {
      body: {
        content: jsonContent(z.object({
          keyword: z.string().min(1).max(200),
          docId: z.number().int().positive(),
        })),
        required: true,
      },
    },
    responses: { ...commonErrorResponses, ...okMsg('ok') },
  }),
  handler: async (c) => {
    const { keyword, docId } = c.req.valid('json');
    await reportWikiSearchClick(keyword, docId);
    return c.json(okBody(null), 200);
  },
});

const recentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/recent',
    tags: ['知识中心-文档'], summary: '最近访问的文档',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(WikiDocDTO), '最近访问') },
  }),
  handler: async (c) => c.json(okBody(await listRecentWikiDocs()), 200),
});

const treeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/tree',
    tags: ['知识中心-文档'], summary: '空间目录树',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: {
      query: z.object({
        spaceId: z.coerce.number().int().positive().openapi({ param: { name: 'spaceId', in: 'query' }, example: 1 }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiDocTreeNodeDTO), '目录树') },
  }),
  handler: async (c) => {
    const { spaceId } = c.req.valid('query');
    return c.json(okBody(await getWikiDocTree(spaceId)), 200);
  },
});

const favoritesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/favorites',
    tags: ['知识中心-文档'], summary: '我的收藏',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional() }) },
    responses: { ...commonErrorResponses, ...okPaginated(WikiDocDTO, '我的收藏') },
  }),
  handler: async (c) => c.json(okBody(await listMyFavoriteWikiDocs(c.req.valid('query'))), 200),
});

const recycleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/recycle',
    tags: ['知识中心-文档'], summary: '回收站列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:recycle:list' })] as const,
    request: { query: DocListQuery },
    responses: { ...commonErrorResponses, ...okPaginated(WikiDocDTO, '回收站') },
  }),
  handler: async (c) => c.json(okBody(await listWikiDocs({ ...c.req.valid('query'), deleted: true })), 200),
});

// ─── 详情与 CRUD ──────────────────────────────────────────────────────────────

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['知识中心-文档'], summary: '文档详情（含正文）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiDocDTO, '文档详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getWikiDoc(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['知识中心-文档'], summary: '创建文档',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:create',
      audit: { description: '创建文档', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(createWikiDocSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createWikiDoc(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['知识中心-文档'], summary: '更新文档（正文变更自动生成版本）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:edit',
      audit: { description: '更新文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateWikiDocSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiDocDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiDoc(await ensureWikiDocExists(id)));
    return c.json(okBody(await updateWikiDoc(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['知识中心-文档'], summary: '删除文档（移入回收站）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:delete',
      audit: { description: '删除文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('已移入回收站'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiDoc(await ensureWikiDocExists(id)));
    await deleteWikiDoc(id);
    return c.json(okBody(null, '已移入回收站'), 200);
  },
});

// ─── 移动 / 发布流 / 收藏 / 浏览 ──────────────────────────────────────────────

const moveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/move',
    tags: ['知识中心-文档'], summary: '移动文档',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:move',
      audit: { description: '移动文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(moveWikiDocSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '移动成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await moveWikiDoc(id, c.req.valid('json')), '移动成功'), 200);
  },
});

const submitRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/submit',
    tags: ['知识中心-文档'], summary: '提交发布（审批关闭时直接发布）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:publish',
      audit: { description: '提交发布文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '提交成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await submitWikiDoc(id), '提交成功'), 200);
  },
});

const reviewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/review',
    tags: ['知识中心-文档'], summary: '审核文档（通过 / 驳回）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:approval:review',
      audit: { description: '审核文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(reviewWikiDocSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '审核完成') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await reviewWikiDoc(id, c.req.valid('json')), '审核完成'), 200);
  },
});

const favoriteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/favorite',
    tags: ['知识中心-文档'], summary: '收藏 / 取消收藏',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam, body: { content: jsonContent(z.object({ favorite: z.boolean() })), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('操作成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { favorite } = c.req.valid('json');
    await favoriteWikiDoc(id, favorite);
    return c.json(okBody(null, favorite ? '已收藏' : '已取消收藏'), 200);
  },
});

const viewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/view',
    tags: ['知识中心-文档'], summary: '浏览上报',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('ok') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await recordWikiDocView(id);
    return c.json(okBody(null), 200);
  },
});

// ─── 版本 ─────────────────────────────────────────────────────────────────────

const versionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/versions',
    tags: ['知识中心-文档'], summary: '版本历史',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam, query: PaginationQuery },
    responses: { ...commonErrorResponses, ...okPaginated(WikiDocVersionDTO, '版本历史') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listWikiDocVersions(id, c.req.valid('query'))), 200);
  },
});

const versionDetailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/versions/{version}',
    tags: ['知识中心-文档'], summary: '版本详情（含正文，供对比）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: VersionParam },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiDocVersionDTO, '版本详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id, version } = c.req.valid('param');
    return c.json(okBody(await getWikiDocVersion(id, version)), 200);
  },
});

const rollbackRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/rollback',
    tags: ['知识中心-文档'], summary: '回滚到历史版本',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:doc:edit',
      audit: { description: '回滚文档版本', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(rollbackWikiDocSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '回滚成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { version } = c.req.valid('json');
    setAuditBeforeData(c, mapWikiDoc(await ensureWikiDocExists(id)));
    return c.json(okBody(await rollbackWikiDoc(id, version), '回滚成功'), 200);
  },
});

// ─── 回收站 ───────────────────────────────────────────────────────────────────

const restoreRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/restore',
    tags: ['知识中心-文档'], summary: '从回收站还原',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:recycle:restore',
      audit: { description: '还原文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(WikiDocDTO, '还原成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await restoreWikiDoc(id), '还原成功'), 200);
  },
});

const purgeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/purge',
    tags: ['知识中心-文档'], summary: '彻底删除（不可恢复）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:recycle:purge',
      audit: { description: '彻底删除文档', module: '知识中心' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已彻底删除') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await purgeWikiDoc(id);
    return c.json(okBody(null, '已彻底删除'), 200);
  },
});

docsRouter.openapiRoutes([
  listRoute,
  searchRoute,
  searchClickRoute,
  recentRoute,
  treeRoute,
  favoritesRoute,
  recycleRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
  moveRoute,
  submitRoute,
  reviewRoute,
  favoriteRoute,
  viewRoute,
  versionsRoute,
  versionDetailRoute,
  rollbackRoute,
  restoreRoute,
  purgeRoute,
] as const);

export default docsRouter;
