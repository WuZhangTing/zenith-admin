/**
 * 运营群发路由(管理员)。发送动作提交任务中心任务,进度经通用 /api/async-tasks 查询。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { BROADCAST_STATUSES, createBroadcastSchema, updateBroadcastSchema } from '@zenith/shared/messaging';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
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
import { AsyncTaskDTO, BroadcastCampaignDTO } from '../../lib/openapi-dtos';
import {
  createBroadcast,
  deleteBroadcast,
  getBroadcast,
  getBroadcastBeforeAudit,
  listBroadcasts,
  sendBroadcast,
  updateBroadcast,
} from '../../services/messaging/broadcasts.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['运营群发'], summary: '群发活动列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:broadcast:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().max(256).optional(),
        status: z.enum(BROADCAST_STATUSES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(BroadcastCampaignDTO, '群发活动') },
  }),
  handler: async (c) => c.json(okBody(await listBroadcasts(c.req.valid('query'))), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['运营群发'], summary: '群发活动详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:broadcast:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(BroadcastCampaignDTO, '活动详情') },
  }),
  handler: async (c) => c.json(okBody(await getBroadcast(c.req.valid('param').id)), 200),
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['运营群发'], summary: '创建群发活动(草稿)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:broadcast:create',
      audit: { description: '创建群发活动', module: '运营群发' },
    })] as const,
    request: { body: { content: jsonContent(createBroadcastSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(BroadcastCampaignDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createBroadcast(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['运营群发'], summary: '更新群发活动(仅草稿/失败/已取消)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:broadcast:update',
      audit: { description: '更新群发活动', module: '运营群发' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateBroadcastSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(BroadcastCampaignDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getBroadcastBeforeAudit(id));
    return c.json(okBody(await updateBroadcast(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['运营群发'], summary: '删除群发活动',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:broadcast:delete',
      audit: { description: '删除群发活动', module: '运营群发' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getBroadcastBeforeAudit(id));
    await deleteBroadcast(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const sendRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/send',
    tags: ['运营群发'], summary: '发送群发活动(提交任务中心分批派发)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'system:broadcast:send',
      audit: { description: '发送群发活动', module: '运营群发' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '任务已提交') },
  }),
  handler: async (c) => c.json(okBody(await sendBroadcast(c.req.valid('param').id), '任务已提交'), 200),
});

router.openapiRoutes([listRoute, detailRoute, createRouteDef, updateRouteDef, deleteRoute, sendRoute] as const);

export default router;
