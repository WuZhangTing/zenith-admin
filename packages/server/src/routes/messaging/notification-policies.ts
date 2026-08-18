/**
 * 通知策略路由（管理员）：事件目录 / 作用域覆盖 / 派发日志。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DECISIONS,
  NOTIFICATION_RECIPIENT_TYPES,
  resetNotificationOverrideSchema,
  saveNotificationOverrideSchema,
} from '@zenith/shared/messaging';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  commonErrorResponses, dateRangeBound, jsonContent, ok, okMsg, okPaginated, okBody,
  PaginationQuery, validationHook,
} from '../../lib/openapi-schemas';
import { NotificationDispatchDTO, NotificationPolicyEventDTO } from '../../lib/openapi-dtos';
import {
  listNotificationDispatches,
  listNotificationPolicyEvents,
  resetNotificationOverride,
  saveNotificationOverride,
} from '../../services/messaging/notification-policies.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const eventsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/events',
    tags: ['NotificationPolicies'], summary: '通知事件目录与当前作用域覆盖',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:notify-policy:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(NotificationPolicyEventDTO), '事件目录') },
  }),
  handler: async (c) => c.json(okBody(await listNotificationPolicyEvents()), 200),
});

const saveOverrideRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/overrides',
    tags: ['NotificationPolicies'], summary: '保存事件渠道覆盖',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:notify-policy:save',
      audit: { description: '保存通知策略覆盖', module: '通知策略' },
    })] as const,
    request: { body: { content: jsonContent(saveNotificationOverrideSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('保存成功') },
  }),
  handler: async (c) => {
    await saveNotificationOverride(c.req.valid('json'));
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const resetOverrideRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/overrides/reset',
    tags: ['NotificationPolicies'], summary: '重置事件渠道覆盖（恢复默认）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:notify-policy:save',
      audit: { description: '重置通知策略覆盖', module: '通知策略' },
    })] as const,
    request: { body: { content: jsonContent(resetNotificationOverrideSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已恢复默认') },
  }),
  handler: async (c) => {
    await resetNotificationOverride(c.req.valid('json'));
    return c.json(okBody(null, '已恢复默认'), 200);
  },
});

const dispatchesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/dispatches',
    tags: ['NotificationPolicies'], summary: '通知派发日志（含抑制归因）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:notify-policy:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        eventKey: z.string().optional(),
        channel: z.enum(NOTIFICATION_CHANNELS).optional(),
        decision: z.enum(NOTIFICATION_DECISIONS).optional(),
        recipientType: z.enum(NOTIFICATION_RECIPIENT_TYPES).optional(),
        recipientId: z.coerce.number().int().positive().optional(),
        startTime: dateRangeBound('派发时间起'),
        endTime: dateRangeBound('派发时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(NotificationDispatchDTO, '派发日志') },
  }),
  handler: async (c) => c.json(okBody(await listNotificationDispatches(c.req.valid('query'))), 200),
});

router.openapiRoutes([
  eventsRoute,
  saveOverrideRoute,
  resetOverrideRoute,
  dispatchesRoute,
] as const);

export default router;
