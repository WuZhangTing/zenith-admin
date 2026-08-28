/**
 * 链路追踪查看器 API（/api/trace）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { TRACE_NODE_KINDS } from '@zenith/shared/platform';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { validationHook, commonErrorResponses, ok, okBody } from '../../lib/openapi-schemas';
import { TraceFailureEntryDTO, TraceTimelineDTO } from '../../lib/openapi-dtos';
import { getTraceTimeline, listRecentTraceFailures } from '../../services/platform/trace.service';

const traceRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── GET /recent-failures — 排障入口（静态路由须早于 /{traceId}）──────────────
const recentFailuresRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/recent-failures',
    tags: ['链路追踪'], summary: '最近失败链路（请求 5xx / 作业失败 / 任务失败 / 通知派发失败）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:trace:view' })] as const,
    request: {
      query: z.object({
        days: z.coerce.number().int().min(1).max(30).optional().openapi({ description: '时间窗天数，默认 7' }),
        kind: z.enum(TRACE_NODE_KINDS).optional().openapi({ description: '按节点类型过滤' }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.array(TraceFailureEntryDTO), '失败链路列表') },
  }),
  handler: async (c) => c.json(okBody(await listRecentTraceFailures(c.req.valid('query'))), 200),
});

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

traceRouter.openapiRoutes([recentFailuresRoute, timelineRoute] as const);

export default traceRouter;
