/**
 * 短链管理 API（/api/short-links）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, BatchIdsBody, okBody, errBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import { ShortLinkDTO, ShortLinkStatsDTO } from '../../lib/openapi-dtos';
import {
  createShortLinkSchema, updateShortLinkSchema, batchUpdateShortLinkStatusSchema,
  SHORT_LINK_BIZ_TYPES, SHORT_LINK_STATS_MAX_DAYS,
} from '@zenith/shared/short-link';
import {
  listShortLinks, getShortLink, createShortLink, updateShortLink,
  deleteShortLink, deleteShortLinks, batchUpdateShortLinkStatus, ensureShortLinkExists,
} from '../../services/short-link/short-link.service';
import { getShortLinkStats } from '../../services/short-link/short-link-stats.service';

const shortLinksRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── GET / — 分页列表 ─────────────────────────────────────────────────────────
const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['短链管理'], summary: '短链列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'shortlink:link:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
        bizType: z.enum(SHORT_LINK_BIZ_TYPES).optional(),
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(ShortLinkDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listShortLinks(c.req.valid('query'))), 200),
});

// ─── DELETE /batch — 批量删除（静态路由须早于 /{id}）──────────────────────────
const batchDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch',
    tags: ['短链管理'], summary: '批量删除短链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'shortlink:link:delete',
      audit: { description: '批量删除短链', module: '短链管理' },
    })] as const,
    request: { body: { content: jsonContent(BatchIdsBody), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('批量删除成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    if (!ids?.length) return c.json(errBody('请选择要删除的记录'), 400);
    const deleted = await deleteShortLinks(ids);
    return c.json(okBody(null, `已删除 ${deleted} 条记录`), 200);
  },
});

// ─── PUT /batch/status — 批量启用/禁用 ────────────────────────────────────────
const batchStatusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/batch/status',
    tags: ['短链管理'], summary: '批量启用/禁用短链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'shortlink:link:update',
      audit: { description: '批量更新短链状态', module: '短链管理' },
    })] as const,
    request: { body: { content: jsonContent(batchUpdateShortLinkStatusSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('批量更新成功') },
  }),
  handler: async (c) => {
    const { ids, status } = c.req.valid('json');
    const updated = await batchUpdateShortLinkStatus(ids, status);
    return c.json(okBody(null, `已${status === 'enabled' ? '启用' : '禁用'} ${updated} 条记录`), 200);
  },
});

// ─── GET /{id} — 详情 ─────────────────────────────────────────────────────────
const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['短链管理'], summary: '获取短链详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'shortlink:link:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(ShortLinkDTO, '短链详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getShortLink(id)), 200);
  },
});

// ─── GET /{id}/stats — 访问统计 ───────────────────────────────────────────────
const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats',
    tags: ['短链管理'], summary: '短链访问统计（趋势/设备/地域/来源）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'shortlink:stats:view' })] as const,
    request: {
      params: IdParam,
      query: z.object({
        days: z.coerce.number().int().min(1).max(SHORT_LINK_STATS_MAX_DAYS).optional()
          .openapi({ description: '统计窗口天数，默认 30' }),
      }),
    },
    responses: {
      ...commonErrorResponses,
      ...ok(ShortLinkStatsDTO, '访问统计'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { days } = c.req.valid('query');
    return c.json(okBody(await getShortLinkStats(id, days)), 200);
  },
});

// ─── POST / — 创建 ────────────────────────────────────────────────────────────
const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['短链管理'], summary: '创建短链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'shortlink:link:create',
      audit: { description: '创建短链', module: '短链管理' },
    })] as const,
    request: { body: { content: jsonContent(createShortLinkSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(ShortLinkDTO, '创建成功') },
  }),
  handler: async (c) => {
    const row = await createShortLink(c.req.valid('json'));
    return c.json(okBody(row, '创建成功'), 200);
  },
});

// ─── PUT /{id} — 更新 ─────────────────────────────────────────────────────────
const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['短链管理'], summary: '更新短链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'shortlink:link:update',
      audit: { description: '更新短链', module: '短链管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateShortLinkSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(ShortLinkDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureShortLinkExists(id));
    const row = await updateShortLink(id, c.req.valid('json'));
    return c.json(okBody(row, '更新成功'), 200);
  },
});

// ─── DELETE /{id} — 删除 ──────────────────────────────────────────────────────
const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['短链管理'], summary: '删除短链',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'shortlink:link:delete',
      audit: { description: '删除短链', module: '短链管理' },
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
    setAuditBeforeData(c, await ensureShortLinkExists(id));
    await deleteShortLink(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

shortLinksRouter.openapiRoutes([
  listRoute,
  batchDeleteRoute,
  batchStatusRoute,
  getOneRoute,
  statsRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default shortLinksRouter;
