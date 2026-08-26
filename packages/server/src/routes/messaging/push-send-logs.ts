/**
 * App 推送发送记录（管理侧只读）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { PUSH_PROVIDERS } from '@zenith/shared/messaging';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  PaginationQuery,
  commonErrorResponses,
  dateRangeBound,
  okBody,
  okPaginated,
  validationHook,
} from '../../lib/openapi-schemas';
import { PushSendLogDTO } from '../../lib/openapi-dtos';
import { listPushSendLogs } from '../../services/messaging/push-send-logs.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['推送管理'], summary: '推送发送记录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:push-log:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().max(256).optional(),
        provider: z.enum(PUSH_PROVIDERS).optional(),
        status: z.enum(['pending', 'success', 'failed']).optional(),
        startTime: dateRangeBound('发送时间起'),
        endTime: dateRangeBound('发送时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(PushSendLogDTO, '发送记录') },
  }),
  handler: async (c) => c.json(okBody(await listPushSendLogs(c.req.valid('query'))), 200),
});

router.openapiRoutes([listRoute] as const);

export default router;
