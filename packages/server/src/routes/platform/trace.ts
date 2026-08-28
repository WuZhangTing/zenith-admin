/**
 * 链路追踪查看器 API（/api/trace）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { validationHook, commonErrorResponses, ok, okBody } from '../../lib/openapi-schemas';
import { TraceTimelineDTO } from '../../lib/openapi-dtos';
import { getTraceTimeline } from '../../services/platform/trace.service';

const traceRouter = new OpenAPIHono({ defaultHook: validationHook });

const timelineRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{traceId}',
    tags: ['链路追踪'], summary: '按 traceId 聚合一次操作的时间线（请求/作业/事件/通知/任务）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:trace:view' })] as const,
    request: {
      params: z.object({
        traceId: z.string().min(8).max(64).openapi({ description: '链路 ID（= 请求的 X-Request-Id）' }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(TraceTimelineDTO, '链路时间线') },
  }),
  handler: async (c) => {
    const { traceId } = c.req.valid('param');
    return c.json(okBody(await getTraceTimeline(traceId)), 200);
  },
});

traceRouter.openapiRoutes([timelineRoute] as const);

export default traceRouter;
