/**
 * 个人通知偏好路由：矩阵、全局设置。
 * 全部为登录用户自助操作，不挂权限码（与「我的站内信」同规格）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  saveNotificationPreferencesSchema,
  saveNotificationSettingsSchema,
} from '@zenith/shared/messaging';
import { authMiddleware } from '../../middleware/auth';
import {
  commonErrorResponses, jsonContent, ok, okMsg, okBody, validationHook,
} from '../../lib/openapi-schemas';
import { NotificationMatrixGroupDTO, NotificationSettingsDTO } from '../../lib/openapi-dtos';
import {
  getMyNotificationMatrix,
  getMyNotificationSettings,
  saveMyNotificationPreferences,
  saveMyNotificationSettings,
} from '../../services/messaging/notification-preferences.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const matrixRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/matrix',
    tags: ['NotificationPreferences'], summary: '我的通知偏好矩阵',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(NotificationMatrixGroupDTO), '偏好矩阵') },
  }),
  handler: async (c) => c.json(okBody(await getMyNotificationMatrix()), 200),
});

const saveMatrixRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/matrix',
    tags: ['NotificationPreferences'], summary: '保存我的通知偏好',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(saveNotificationPreferencesSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('保存成功') },
  }),
  handler: async (c) => {
    await saveMyNotificationPreferences(c.req.valid('json'));
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const settingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/settings',
    tags: ['NotificationPreferences'], summary: '我的通知全局设置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(NotificationSettingsDTO, '全局设置') },
  }),
  handler: async (c) => c.json(okBody(await getMyNotificationSettings()), 200),
});

const saveSettingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/settings',
    tags: ['NotificationPreferences'], summary: '保存我的通知全局设置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(saveNotificationSettingsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(NotificationSettingsDTO, '保存成功') },
  }),
  handler: async (c) => c.json(okBody(await saveMyNotificationSettings(c.req.valid('json')), '保存成功'), 200),
});

router.openapiRoutes([
  matrixRoute,
  saveMatrixRoute,
  settingsRoute,
  saveSettingsRoute,
] as const);

export default router;
