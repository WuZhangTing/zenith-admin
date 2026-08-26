/**
 * 设备推送绑定（客户端调用,登录态即可,无需权限点）。
 *
 * 管理端 App:/api/push/devices（authMiddleware,绑定到 user 主体）
 * 会员端 App:/api/member/push/devices（memberAuthMiddleware,绑定到 member 主体,见 member 域挂载）
 * 两端共用本文件的路由工厂,只是主体解析不同。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { bindPushDeviceSchema } from '@zenith/shared/ops';
import type { DeviceSubjectType } from '@zenith/shared/ops';
import { authMiddleware } from '../../middleware/auth';
import { currentUser } from '../../lib/context';
import {
  ErrorResponse,
  commonErrorResponses,
  jsonContent,
  ok,
  okBody,
  okMsg,
  validationHook,
} from '../../lib/openapi-schemas';
import { ClientDeviceDTO } from '../../lib/openapi-dtos';
import { bindPushDevice, unbindPushDevice } from '../../services/ops/client-devices.service';

interface DeviceBindRouterOptions {
  subjectType: DeviceSubjectType;
  /** 认证中间件（authMiddleware 或 memberAuthMiddleware） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authMiddleware: MiddlewareHandler<any>;
  /** 从上下文解析当前主体 ID */
  resolveSubjectId: () => number;
  tagName: string;
}

export function createDeviceBindRouter(options: DeviceBindRouterOptions) {
  const router = new OpenAPIHono({ defaultHook: validationHook });

  const bindRoute = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/',
      tags: [options.tagName], summary: '绑定推送设备（登录后上报 RegistrationID）',
      security: [{ BearerAuth: [] }],
      middleware: [options.authMiddleware] as const,
      request: { body: { content: jsonContent(bindPushDeviceSchema), required: true } },
      responses: {
        ...commonErrorResponses,
        ...ok(ClientDeviceDTO, '绑定成功'),
        404: { content: jsonContent(ErrorResponse), description: '应用不存在' },
      },
    }),
    handler: async (c) => {
      const device = await bindPushDevice(options.subjectType, options.resolveSubjectId(), c.req.valid('json'));
      return c.json(okBody(device, '绑定成功'), 200);
    },
  });

  const unbindRoute = defineOpenAPIRoute({
    route: createRoute({
      method: 'delete', path: '/{deviceId}',
      tags: [options.tagName], summary: '解绑推送设备（登出时调用）',
      security: [{ BearerAuth: [] }],
      middleware: [options.authMiddleware] as const,
      request: {
        params: z.object({
          deviceId: z.string().min(1).max(64).openapi({ param: { name: 'deviceId', in: 'path' }, example: 'a1b2c3d4' }),
        }),
      },
      responses: { ...commonErrorResponses, ...okMsg('解绑成功') },
    }),
    handler: async (c) => {
      const { deviceId } = c.req.valid('param');
      await unbindPushDevice(options.subjectType, options.resolveSubjectId(), deviceId);
      return c.json(okBody(null, '解绑成功'), 200);
    },
  });

  router.openapiRoutes([bindRoute, unbindRoute] as const);
  return router;
}

// 管理端实例（移动审批 App 等以管理员身份登录的客户端）
export const adminPushDevicesRouter = createDeviceBindRouter({
  subjectType: 'user',
  authMiddleware,
  resolveSubjectId: () => currentUser().userId,
  tagName: '推送管理',
});
