/**
 * App 推送配置与发送记录（管理侧,/api/push-configs + /api/push-send-logs 挂载前者）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { PUSH_PROVIDERS, createPushConfigSchema, testPushSendSchema, updatePushConfigSchema } from '@zenith/shared/messaging';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse,
  IdParam,
  PaginationQuery,
  commonErrorResponses,
  jsonContent,
  ok,
  okBody,
  okMsg,
  okPaginated,
  validationHook,
} from '../../lib/openapi-schemas';
import { PushConfigDTO } from '../../lib/openapi-dtos';
import {
  createPushConfig,
  deletePushConfig,
  getPushConfig,
  getPushConfigBeforeAudit,
  listPushConfigs,
  testPushSend,
  updatePushConfig,
} from '../../services/messaging/push-configs.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['推送管理'], summary: '推送配置列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:push:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().max(256).optional(),
        provider: z.enum(PUSH_PROVIDERS).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(PushConfigDTO, '推送配置列表') },
  }),
  handler: async (c) => c.json(okBody(await listPushConfigs(c.req.valid('query'))), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['推送管理'], summary: '推送配置详情（编辑回填,密钥不回传）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:push:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(PushConfigDTO, '推送配置详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getPushConfig(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['推送管理'], summary: '创建推送配置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:push:create',
      audit: { description: '创建推送配置', module: '推送管理', recordBody: false },
    })] as const,
    request: { body: { content: jsonContent(createPushConfigSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(PushConfigDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createPushConfig(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['推送管理'], summary: '更新推送配置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:push:update',
      audit: { description: '更新推送配置', module: '推送管理', recordBody: false },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updatePushConfigSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(PushConfigDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getPushConfigBeforeAudit(id));
    return c.json(okBody(await updatePushConfig(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['推送管理'], summary: '删除推送配置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:push:delete',
      audit: { description: '删除推送配置', module: '推送管理' },
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
    setAuditBeforeData(c, await getPushConfigBeforeAudit(id));
    await deletePushConfig(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const testSendRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/test',
    tags: ['推送管理'], summary: '测试发送（直发 RegistrationID）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:push:send',
      audit: { description: '测试推送', module: '推送管理' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(testPushSendSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(z.object({ msgId: z.string().nullable() }), '发送成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await testPushSend(id, c.req.valid('json')), '发送成功'), 200);
  },
});

router.openapiRoutes([
  listRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
  testSendRoute,
] as const);

export default router;
