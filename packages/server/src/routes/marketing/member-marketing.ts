/**
 * 营销活动 C 端 API（/api/member/marketing，会员登录态）：
 * 活动详情 / 抽奖 / 我的记录，供会员前台或外部 H5 活动页对接。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { memberAuthMiddleware } from '../../middleware/member-auth';
import { ErrorResponse, IdParam, commonErrorResponses, jsonContent, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { MarketingDrawResultDTO, MarketingParticipationDTO, MarketingPublicCampaignDTO } from '../../lib/openapi-dtos';
import { currentMemberId } from '../../lib/member-context';
import {
  drawMarketingLottery, getPublicMarketingCampaign, listMyParticipations,
} from '../../services/marketing/marketing-campaigns.service';

const memberMarketing = new OpenAPIHono({ defaultHook: validationHook });

// ─── GET /campaigns/{id} — 活动信息（进行中）──────────────────────────────────
const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/campaigns/{id}',
    tags: ['营销活动（会员端）'], summary: '活动信息（含奖品展示，不含权重与库存）',
    security: [{ BearerAuth: [] }],
    middleware: [memberAuthMiddleware] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(MarketingPublicCampaignDTO, '活动信息'),
      404: { content: jsonContent(ErrorResponse), description: '活动不存在或未开始' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getPublicMarketingCampaign(id)), 200);
  },
});

// ─── POST /campaigns/{id}/draw — 抽奖 ─────────────────────────────────────────
const drawRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/campaigns/{id}/draw',
    tags: ['营销活动（会员端）'], summary: '参与抽奖（次数限制 + 库存原子扣减 + 中奖自动发放）',
    security: [{ BearerAuth: [] }],
    middleware: [memberAuthMiddleware] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(MarketingDrawResultDTO, '抽奖结果') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await drawMarketingLottery(id, currentMemberId())), 200);
  },
});

// ─── GET /campaigns/{id}/my-records — 我的参与记录 ────────────────────────────
const myRecordsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/campaigns/{id}/my-records',
    tags: ['营销活动（会员端）'], summary: '我的参与记录（最近 50 条）',
    security: [{ BearerAuth: [] }],
    middleware: [memberAuthMiddleware] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(MarketingParticipationDTO), '参与记录') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listMyParticipations(id, currentMemberId())), 200);
  },
});

memberMarketing.openapiRoutes([detailRoute, drawRoute, myRecordsRoute] as const);

export default memberMarketing;
