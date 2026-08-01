import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { batchCmsInteractionStatusSchema, createCmsInteractionSchema, updateCmsInteractionSchema } from '@zenith/shared/cms';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  AsyncTaskDTO,
  CmsInteractionCrossStatsDTO,
  CmsInteractionDTO,
  CmsInteractionResponseDTO,
  CmsInteractionStatsDTO,
  CmsInteractionTextAnswerDTO,
  CmsInteractionTrendStatsDTO,
} from '../../lib/openapi-dtos';
import { IdParam, PaginationQuery, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import {
  copyCmsInteraction,
  createCmsInteraction,
  deleteCmsInteraction,
  getCmsInteraction,
  getCmsInteractionCrossStats,
  getCmsInteractionStats,
  getCmsInteractionTrend,
  listCmsInteractionResponses,
  listCmsInteractionTexts,
  listCmsInteractions,
  setCmsInteractionStatus,
  updateCmsInteraction,
} from '../../services/cms/cms-interactions.service';
import { submitCmsInteractionBatchStatusTask } from '../../services/cms/cms-stage4-tasks';

const router = new OpenAPIHono({ defaultHook: validationHook });
const statusSchema = z.enum(['draft', 'published', 'closed']);
const kindSchema = z.enum(['survey', 'poll']);

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['CMS-互动问卷'], summary: '统一互动问卷分页列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        siteId: z.coerce.number().int().positive(),
        keyword: z.string().optional(),
        kind: kindSchema.optional(),
        status: statusSchema.optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsInteractionDTO, '互动问卷列表') },
  }),
  handler: async (c) => c.json(okBody(await listCmsInteractions(c.req.valid('query'))), 200),
});

const responseListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/responses',
    tags: ['CMS-互动问卷'], summary: '互动答卷明细（会员信息脱敏）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        siteId: z.coerce.number().int().positive(),
        interactionId: z.coerce.number().int().positive().optional(),
        kind: kindSchema.optional(),
        startTime: dateRangeBound('起始时间'),
        endTime: dateRangeBound('结束时间'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsInteractionResponseDTO, '答卷明细') },
  }),
  handler: async (c) => c.json(okBody(await listCmsInteractionResponses(c.req.valid('query'))), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['CMS-互动问卷'], summary: '互动问卷详情（含题目）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionDTO, '互动问卷详情') },
  }),
  handler: async (c) => c.json(okBody(await getCmsInteraction(c.req.valid('param').id)), 200),
});

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats',
    tags: ['CMS-互动问卷'], summary: '统一互动结果统计',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionStatsDTO, '结果统计') },
  }),
  handler: async (c) => c.json(okBody(await getCmsInteractionStats(c.req.valid('param').id)), 200),
});

const textsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats/texts',
    tags: ['CMS-互动问卷'], summary: '文本 / 日期 /「其他」填空答案分页',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: {
      params: IdParam,
      query: PaginationQuery.extend({
        questionId: z.coerce.number().int().positive(),
        keyword: z.string().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsInteractionTextAnswerDTO, '文本答案') },
  }),
  handler: async (c) => c.json(okBody(await listCmsInteractionTexts({
    interactionId: c.req.valid('param').id,
    ...c.req.valid('query'),
  })), 200),
});

const crossStatsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats/cross',
    tags: ['CMS-互动问卷'], summary: '两道选择题的交叉分析',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: {
      params: IdParam,
      query: z.object({
        xQuestionId: z.coerce.number().int().positive(),
        yQuestionId: z.coerce.number().int().positive(),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionCrossStatsDTO, '交叉分析') },
  }),
  handler: async (c) => {
    const { xQuestionId, yQuestionId } = c.req.valid('query');
    return c.json(okBody(await getCmsInteractionCrossStats(c.req.valid('param').id, xQuestionId, yQuestionId)), 200);
  },
});

const trendRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats/trend',
    tags: ['CMS-互动问卷'], summary: '答卷提交趋势（按天）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:interaction:list' })] as const,
    request: {
      params: IdParam,
      query: z.object({ days: z.coerce.number().int().min(1).max(180).default(30) }),
    },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionTrendStatsDTO, '提交趋势') },
  }),
  handler: async (c) => c.json(
    okBody(await getCmsInteractionTrend(c.req.valid('param').id, c.req.valid('query').days)),
    200,
  ),
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['CMS-互动问卷'], summary: '创建互动问卷',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:manage',
      audit: { description: '创建 CMS 互动问卷', module: 'CMS内容管理' },
    })] as const,
    request: { body: { content: jsonContent(createCmsInteractionSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createCmsInteraction(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['CMS-互动问卷'], summary: '更新互动问卷',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:manage',
      audit: { description: '更新 CMS 互动问卷', module: 'CMS内容管理' },
    })] as const,
    request: {
      params: IdParam,
      body: { content: jsonContent(updateCmsInteractionSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionDTO, '更新成功') },
  }),
  handler: async (c) => {
    const id = c.req.valid('param').id;
    setAuditBeforeData(c, await getCmsInteraction(id));
    return c.json(okBody(await updateCmsInteraction(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const statusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/status',
    tags: ['CMS-互动问卷'], summary: '流转互动问卷状态',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:manage',
      audit: { description: '流转 CMS 互动问卷状态', module: 'CMS内容管理' },
    })] as const,
    request: {
      params: IdParam,
      body: { content: jsonContent(z.object({ status: statusSchema })), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionDTO, '状态已更新') },
  }),
  handler: async (c) => {
    const id = c.req.valid('param').id;
    setAuditBeforeData(c, await getCmsInteraction(id));
    return c.json(okBody(await setCmsInteractionStatus(id, c.req.valid('json').status), '状态已更新'), 200);
  },
});

const batchStatusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/batch/status',
    tags: ['CMS-互动问卷'], summary: '批量发布/关闭互动问卷（任务中心）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:batch',
      audit: { description: '批量流转 CMS 互动问卷', module: 'CMS内容管理' },
    })] as const,
    request: { body: { content: jsonContent(batchCmsInteractionStatusSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '任务已提交') },
  }),
  handler: async (c) => c.json(okBody(
    await submitCmsInteractionBatchStatusTask(c.req.valid('json')),
    '批量任务已提交',
  ), 200),
});

const copyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/copy',
    tags: ['CMS-互动问卷'], summary: '复制互动问卷（生成草稿副本）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:manage',
      audit: { description: '复制 CMS 互动问卷', module: 'CMS内容管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsInteractionDTO, '复制成功') },
  }),
  handler: async (c) => c.json(okBody(await copyCmsInteraction(c.req.valid('param').id), '复制成功'), 200),
});

const deleteRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['CMS-互动问卷'], summary: '删除互动问卷及全部答卷',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:interaction:manage',
      audit: { description: '删除 CMS 互动问卷', module: 'CMS内容管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const id = c.req.valid('param').id;
    setAuditBeforeData(c, await getCmsInteraction(id));
    await deleteCmsInteraction(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([
  listRoute,
  responseListRoute,
  batchStatusRoute,
  detailRoute,
  textsRoute,
  crossStatsRoute,
  trendRoute,
  statsRoute,
  createRouteDef,
  updateRouteDef,
  statusRoute,
  copyRoute,
  deleteRouteDef,
] as const);

export default router;
