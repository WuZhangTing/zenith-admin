/**
 * 营销活动管理 API（/api/marketing/campaigns）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import { MarketingCampaignDTO, MarketingParticipationDTO, MarketingPrizeDTO } from '../../lib/openapi-dtos';
import {
  createMarketingCampaignSchema, updateMarketingCampaignSchema, saveMarketingPrizeSchema,
  MARKETING_CAMPAIGN_STATUSES,
} from '@zenith/shared/marketing';
import {
  listMarketingCampaigns, getMarketingCampaign, createMarketingCampaign, updateMarketingCampaign,
  deleteMarketingCampaign, publishMarketingCampaign, endMarketingCampaign, ensureMarketingCampaignExists,
  listMarketingPrizes, saveMarketingPrize, deleteMarketingPrize, listMarketingParticipations,
} from '../../services/marketing/marketing-campaigns.service';

const marketingRouter = new OpenAPIHono({ defaultHook: validationHook });

const CampaignIdParam = z.object({
  campaignId: z.coerce.number().int().positive().openapi({ param: { name: 'campaignId', in: 'path' }, example: 1 }),
});

// ─── GET / — 分页列表 ─────────────────────────────────────────────────────────
const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['营销活动'], summary: '营销活动列表（含参与/中奖统计）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'marketing:campaign:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(MARKETING_CAMPAIGN_STATUSES).optional(),
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(MarketingCampaignDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listMarketingCampaigns(c.req.valid('query'))), 200),
});

// ─── GET /{id} — 详情 ─────────────────────────────────────────────────────────
const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['营销活动'], summary: '营销活动详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'marketing:campaign:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(MarketingCampaignDTO, '活动详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getMarketingCampaign(id)), 200);
  },
});

// ─── POST / — 创建 ────────────────────────────────────────────────────────────
const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['营销活动'], summary: '创建营销活动',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:create',
      audit: { description: '创建营销活动', module: '营销活动' },
    })] as const,
    request: { body: { content: jsonContent(createMarketingCampaignSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(MarketingCampaignDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createMarketingCampaign(c.req.valid('json')), '创建成功'), 200),
});

// ─── PUT /{id} — 更新 ─────────────────────────────────────────────────────────
const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['营销活动'], summary: '更新营销活动',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:update',
      audit: { description: '更新营销活动', module: '营销活动' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateMarketingCampaignSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(MarketingCampaignDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureMarketingCampaignExists(id));
    return c.json(okBody(await updateMarketingCampaign(id, c.req.valid('json')), '更新成功'), 200);
  },
});

// ─── DELETE /{id} — 删除 ──────────────────────────────────────────────────────
const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['营销活动'], summary: '删除营销活动',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:delete',
      audit: { description: '删除营销活动', module: '营销活动' },
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
    setAuditBeforeData(c, await ensureMarketingCampaignExists(id));
    await deleteMarketingCampaign(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── POST /{id}/publish — 发布 ────────────────────────────────────────────────
const publishRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/publish',
    tags: ['营销活动'], summary: '发布活动（配置了落地页时自动生成分享短链）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:publish',
      audit: { description: '发布营销活动', module: '营销活动' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(MarketingCampaignDTO, '发布成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await publishMarketingCampaign(id), '发布成功'), 200);
  },
});

// ─── POST /{id}/end — 结束 ────────────────────────────────────────────────────
const endRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/end',
    tags: ['营销活动'], summary: '结束活动',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:publish',
      audit: { description: '结束营销活动', module: '营销活动' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(MarketingCampaignDTO, '已结束') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await endMarketingCampaign(id), '活动已结束'), 200);
  },
});

// ─── 奖品子资源 ───────────────────────────────────────────────────────────────
const listPrizesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{campaignId}/prizes',
    tags: ['营销活动'], summary: '奖品列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'marketing:campaign:list' })] as const,
    request: { params: CampaignIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(MarketingPrizeDTO), '奖品列表') },
  }),
  handler: async (c) => {
    const { campaignId } = c.req.valid('param');
    return c.json(okBody(await listMarketingPrizes(campaignId)), 200);
  },
});

const createPrizeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{campaignId}/prizes',
    tags: ['营销活动'], summary: '新增奖品',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:update',
      audit: { description: '新增活动奖品', module: '营销活动' },
    })] as const,
    request: { params: CampaignIdParam, body: { content: jsonContent(saveMarketingPrizeSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(MarketingPrizeDTO, '创建成功') },
  }),
  handler: async (c) => {
    const { campaignId } = c.req.valid('param');
    return c.json(okBody(await saveMarketingPrize(campaignId, null, c.req.valid('json')), '创建成功'), 200);
  },
});

const PrizeParams = CampaignIdParam.extend({
  prizeId: z.coerce.number().int().positive().openapi({ param: { name: 'prizeId', in: 'path' }, example: 1 }),
});

const updatePrizeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{campaignId}/prizes/{prizeId}',
    tags: ['营销活动'], summary: '更新奖品（库存按增量调整剩余）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:update',
      audit: { description: '更新活动奖品', module: '营销活动' },
    })] as const,
    request: { params: PrizeParams, body: { content: jsonContent(saveMarketingPrizeSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(MarketingPrizeDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { campaignId, prizeId } = c.req.valid('param');
    return c.json(okBody(await saveMarketingPrize(campaignId, prizeId, c.req.valid('json')), '更新成功'), 200);
  },
});

const deletePrizeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{campaignId}/prizes/{prizeId}',
    tags: ['营销活动'], summary: '删除奖品',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'marketing:campaign:update',
      audit: { description: '删除活动奖品', module: '营销活动' },
    })] as const,
    request: { params: PrizeParams },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { campaignId, prizeId } = c.req.valid('param');
    await deleteMarketingPrize(campaignId, prizeId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 参与记录 ─────────────────────────────────────────────────────────────────
const listParticipationsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{campaignId}/participations',
    tags: ['营销活动'], summary: '参与/中奖记录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'marketing:record:list' })] as const,
    request: {
      params: CampaignIdParam,
      query: PaginationQuery.extend({
        memberId: z.coerce.number().int().positive().optional(),
        wonOnly: z.coerce.boolean().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(MarketingParticipationDTO, '参与记录') },
  }),
  handler: async (c) => {
    const { campaignId } = c.req.valid('param');
    return c.json(okBody(await listMarketingParticipations(campaignId, c.req.valid('query'))), 200);
  },
});

marketingRouter.openapiRoutes([
  listRoute,
  listPrizesRoute,
  createPrizeRoute,
  updatePrizeRoute,
  deletePrizeRoute,
  listParticipationsRoute,
  publishRoute,
  endRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default marketingRouter;
