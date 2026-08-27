/**
 * 渠道推广分析 API（/api/growth/channel-analysis，纯读）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { commonErrorResponses, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { ChannelAnalysisDTO } from '../../lib/openapi-dtos';
import { CHANNEL_ANALYSIS_DIMENSIONS, SHORT_LINK_STATS_MAX_DAYS } from '@zenith/shared/short-link';
import { getChannelAnalysis } from '../../services/short-link/channel-analysis.service';

const channelAnalysisRouter = new OpenAPIHono({ defaultHook: validationHook });

const analysisRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['渠道推广分析'], summary: '按 UTM 维度聚合短链点击与转化',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'shortlink:analysis:view' })] as const,
    request: {
      query: z.object({
        dimension: z.enum(CHANNEL_ANALYSIS_DIMENSIONS).default('source'),
        days: z.coerce.number().int().min(1).max(SHORT_LINK_STATS_MAX_DAYS).optional()
          .openapi({ description: '统计窗口天数，默认 30' }),
        convEvent: z.string().max(128).optional()
          .openapi({ description: '转化事件名（事件字典），传入后返回各渠道转化数与转化率' }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(ChannelAnalysisDTO, '渠道分析结果') },
  }),
  handler: async (c) => c.json(okBody(await getChannelAnalysis(c.req.valid('query'))), 200),
});

channelAnalysisRouter.openapiRoutes([analysisRoute] as const);

export default channelAnalysisRouter;
