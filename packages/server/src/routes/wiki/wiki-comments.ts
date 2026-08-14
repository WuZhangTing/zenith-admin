import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { WIKI_COMMENT_STATUSES, createWikiCommentSchema, updateWikiCommentStatusSchema } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import { WikiCommentDTO } from '../../lib/openapi-dtos';
import {
  createWikiComment, deleteMyWikiComment, ensureWikiCommentExists, listWikiComments,
  listWikiDocComments, mapWikiComment, removeWikiComment, resolveWikiComment, updateWikiCommentStatus,
} from '../../services/wiki/comments.service';

const commentsRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── 用户端 ───────────────────────────────────────────────────────────────────

const docCommentsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/doc/{id}',
    tags: ['知识中心-评论'], summary: '文档评论树',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiCommentDTO), '评论树') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listWikiDocComments(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['知识中心-评论'], summary: '发表评论 / 回复（支持 @提及与问题标记）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { body: { content: jsonContent(createWikiCommentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiCommentDTO, '评论成功') },
  }),
  handler: async (c) => c.json(okBody(await createWikiComment(c.req.valid('json')), '评论成功'), 200),
});

const resolveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/resolve',
    tags: ['知识中心-评论'], summary: '标记问题评论为已解决',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(WikiCommentDTO, '已解决') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await resolveWikiComment(id), '已标记解决'), 200);
  },
});

const deleteMineRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/mine/{id}',
    tags: ['知识中心-评论'], summary: '删除自己的评论',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await deleteMyWikiComment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 管理端 ───────────────────────────────────────────────────────────────────

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-评论'], summary: '评论管理列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:comment:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(WIKI_COMMENT_STATUSES).optional(),
        docId: z.coerce.number().int().positive().optional(),
        startTime: dateRangeBound('评论时间起'),
        endTime: dateRangeBound('评论时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(WikiCommentDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listWikiComments(c.req.valid('query'))), 200),
});

const statusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/status',
    tags: ['知识中心-评论'], summary: '隐藏 / 恢复评论',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:comment:audit',
      audit: { description: '审核评论', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateWikiCommentStatusSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiCommentDTO, '操作成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { status } = c.req.valid('json');
    setAuditBeforeData(c, mapWikiComment(await ensureWikiCommentExists(id)));
    return c.json(okBody(await updateWikiCommentStatus(id, status), '操作成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['知识中心-评论'], summary: '删除评论（管理端）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:comment:delete',
      audit: { description: '删除评论', module: '知识中心' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiComment(await ensureWikiCommentExists(id)));
    await removeWikiComment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

commentsRouter.openapiRoutes([
  docCommentsRoute,
  deleteMineRoute,
  listRoute,
  createRoute_,
  resolveRoute,
  statusRoute,
  deleteRoute_,
] as const);

export default commentsRouter;
