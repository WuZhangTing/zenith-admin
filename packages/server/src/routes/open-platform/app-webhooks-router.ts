import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createAppWebhookSchema, updateAppWebhookSchema } from '@zenith/shared/open-platform';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import {
  AppWebhookBatchRetryResultDTO,
  AppWebhookDeliveryDTO,
  AppWebhookSubscriptionCreatedDTO,
  AppWebhookSubscriptionDTO,
  OpenWebhookEventMetaDTO,
} from '../../lib/openapi-dtos';
import {
  BatchIdsBody,
  commonErrorResponses,
  IdParam,
  jsonContent,
  ok,
  okBody,
  okMsg,
  okPaginated,
  PaginationQuery,
  validationHook,
} from '../../lib/openapi-schemas';
import {
  createSubscription,
  deleteSubscription,
  getDelivery,
  getSubscription,
  getSubscriptionBeforeAudit,
  listDeliveries,
  listSubscriptions,
  listWebhookEvents,
  regenerateSubscriptionSecret,
  retryDelivery,
  scheduleBatchRetryDeliveries,
  testSubscription,
  updateSubscription,
  type AppWebhookDomain,
} from '../../services/open-platform/app-webhooks.service';

const ListQuery = PaginationQuery.extend({
  clientId: z.string().optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
  keyword: z.string().optional(),
});

const DeliveryListQuery = PaginationQuery.extend({
  subscriptionId: z.coerce.number().int().optional(),
  clientId: z.string().optional(),
  status: z.enum(['pending', 'success', 'failed', 'retrying']).optional(),
  eventType: z.string().optional(),
});

const SecretResultDTO = z.object({ id: z.number().int(), secret: z.string() }).openapi('AppWebhookSecretResult');
const DeliveryActionDTO = z.object({ deliveryId: z.number().int() }).openapi('AppWebhookDeliveryAction');

export interface AppWebhookRouteOptions {
  domain: AppWebhookDomain;
  viewPermission: string;
  managePermission: string;
  tag: string;
  auditModule: string;
}

export function createAppWebhookRouter(options: AppWebhookRouteOptions) {
  const { domain, viewPermission, managePermission, tag, auditModule } = options;
  const readPermission = [viewPermission, managePermission];
  const router = new OpenAPIHono({ defaultHook: validationHook });

  const deliveryBatchRetry = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/deliveries/batch-retry', tags: [tag], summary: '批量重试失败投递',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '批量重试 Webhook 投递', module: auditModule } })] as const,
      request: { body: { content: jsonContent(BatchIdsBody), required: true } },
      responses: { ...commonErrorResponses, ...ok(AppWebhookBatchRetryResultDTO, '已加入重试队列') },
    }),
    handler: async (c) => c.json(okBody(await scheduleBatchRetryDeliveries(c.req.valid('json').ids, domain), '已加入重试队列'), 200),
  });

  const list = defineOpenAPIRoute({
    route: createRoute({
      method: 'get', path: '/', tags: [tag], summary: '获取 Webhook 订阅列表',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: readPermission })] as const,
      request: { query: ListQuery },
      responses: { ...commonErrorResponses, ...okPaginated(AppWebhookSubscriptionDTO, 'Webhook 订阅列表') },
    }),
    handler: async (c) => c.json(okBody(await listSubscriptions(c.req.valid('query'), domain)), 200),
  });

  const events = defineOpenAPIRoute({
    route: createRoute({
      method: 'get', path: '/events', tags: [tag], summary: '获取可订阅的事件类型',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: readPermission })] as const,
      responses: { ...commonErrorResponses, ...ok(z.array(OpenWebhookEventMetaDTO), '事件类型列表') },
    }),
    handler: (c) => c.json(okBody(listWebhookEvents(domain)), 200),
  });

  const deliveryList = defineOpenAPIRoute({
    route: createRoute({
      method: 'get', path: '/deliveries', tags: [tag], summary: '获取投递日志列表',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: readPermission })] as const,
      request: { query: DeliveryListQuery },
      responses: { ...commonErrorResponses, ...okPaginated(AppWebhookDeliveryDTO, 'Webhook 投递列表') },
    }),
    handler: async (c) => c.json(okBody(await listDeliveries(c.req.valid('query'), domain)), 200),
  });

  const deliveryDetail = defineOpenAPIRoute({
    route: createRoute({
      method: 'get', path: '/deliveries/{id}', tags: [tag], summary: '获取投递详情',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: readPermission })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...ok(AppWebhookDeliveryDTO, 'Webhook 投递详情') },
    }),
    handler: async (c) => c.json(okBody(await getDelivery(c.req.valid('param').id, domain)), 200),
  });

  const deliveryRetry = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/deliveries/{id}/retry', tags: [tag], summary: '重试投递',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '重试 Webhook 投递', module: auditModule } })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...ok(DeliveryActionDTO, '已触发重试') },
    }),
    handler: async (c) => c.json(okBody(await retryDelivery(c.req.valid('param').id, domain), '已触发重试'), 200),
  });

  const create = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/', tags: [tag], summary: '创建 Webhook 订阅（secret 仅返回一次）',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '创建 Webhook 订阅', module: auditModule, recordResponseBody: false } })] as const,
      request: { body: { content: jsonContent(createAppWebhookSchema), required: true } },
      responses: { ...commonErrorResponses, ...ok(AppWebhookSubscriptionCreatedDTO, '创建成功') },
    }),
    handler: async (c) => {
      const created = await createSubscription(c.req.valid('json'), domain);
      setAuditAfterData(c, { ...created, secret: '[REDACTED]' });
      return c.json(okBody(created, '订阅已创建，secret 仅返回一次，请妥善保存'), 200);
    },
  });

  const detail = defineOpenAPIRoute({
    route: createRoute({
      method: 'get', path: '/{id}', tags: [tag], summary: '获取 Webhook 订阅详情',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: readPermission })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...ok(AppWebhookSubscriptionDTO, 'Webhook 订阅详情') },
    }),
    handler: async (c) => c.json(okBody(await getSubscription(c.req.valid('param').id, domain)), 200),
  });

  const update = defineOpenAPIRoute({
    route: createRoute({
      method: 'put', path: '/{id}', tags: [tag], summary: '更新 Webhook 订阅',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '更新 Webhook 订阅', module: auditModule } })] as const,
      request: { params: IdParam, body: { content: jsonContent(updateAppWebhookSchema), required: true } },
      responses: { ...commonErrorResponses, ...ok(AppWebhookSubscriptionDTO, '更新成功') },
    }),
    handler: async (c) => {
      const { id } = c.req.valid('param');
      setAuditBeforeData(c, await getSubscriptionBeforeAudit(id, domain));
      return c.json(okBody(await updateSubscription(id, c.req.valid('json'), domain), '更新成功'), 200);
    },
  });

  const regenerate = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/{id}/regenerate-secret', tags: [tag], summary: '重置签名密钥（仅返回一次）',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '重置 Webhook 密钥', module: auditModule, recordResponseBody: false } })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...ok(SecretResultDTO, '重置成功') },
    }),
    handler: async (c) => {
      const result = await regenerateSubscriptionSecret(c.req.valid('param').id, domain);
      setAuditAfterData(c, { id: result.id, secret: '[REDACTED]' });
      return c.json(okBody(result, '新 secret 仅返回一次，请妥善保存'), 200);
    },
  });

  const test = defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path: '/{id}/test', tags: [tag], summary: '发送测试投递',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '发送 Webhook 测试', module: auditModule } })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...ok(DeliveryActionDTO, '已发送测试投递') },
    }),
    handler: async (c) => c.json(okBody(await testSubscription(c.req.valid('param').id, domain), '已发送测试投递'), 200),
  });

  const remove = defineOpenAPIRoute({
    route: createRoute({
      method: 'delete', path: '/{id}', tags: [tag], summary: '删除 Webhook 订阅',
      security: [{ BearerAuth: [] }],
      middleware: [authMiddleware, guard({ permission: managePermission, audit: { description: '删除 Webhook 订阅', module: auditModule } })] as const,
      request: { params: IdParam },
      responses: { ...commonErrorResponses, ...okMsg('删除成功') },
    }),
    handler: async (c) => {
      const { id } = c.req.valid('param');
      setAuditBeforeData(c, await getSubscriptionBeforeAudit(id, domain));
      await deleteSubscription(id, domain);
      return c.json(okBody(null, '删除成功'), 200);
    },
  });

  router.openapiRoutes([
    list, events, deliveryList, deliveryBatchRetry, deliveryDetail, deliveryRetry,
    create, detail, update, regenerate, test, remove,
  ] as const);

  return router;
}
