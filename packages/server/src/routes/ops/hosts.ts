import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createOpsHostSchema, updateOpsHostSchema } from '@zenith/shared/ops';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  validationHook,
  commonErrorResponses,
  jsonContent,
  ok,
  okMsg,
  okBody,
  IdParam,
} from '../../lib/openapi-schemas';
import { OpsHostDTO, OpsHostTestResultDTO } from '../../lib/openapi-dtos';
import { assertPlatformHostAccess } from '../../lib/host-access';
import {
  createOpsHost,
  deleteOpsHost,
  getOpsHost,
  getOpsHostBeforeAudit,
  importOpsHostFromSshProfile,
  listOpsHosts,
  probeAllOpsHosts,
  probeOpsHost,
  resetOpsHostKey,
  testOpsHostConnection,
  updateOpsHost,
} from '../../services/ops/hosts.service';
import { currentUser } from '../../lib/context';

const router = new OpenAPIHono({ defaultHook: validationHook });

const VIEW_PERM = 'system:host:view';
const MANAGE_PERM = 'system:host:manage';

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['OpsHosts'], summary: '运维主机列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: [VIEW_PERM, 'system:host:use'] })] as const,
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO.array(), '主机列表') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    return c.json(okBody(await listOpsHosts()), 200);
  },
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['OpsHosts'], summary: '主机详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: [VIEW_PERM, 'system:host:use'] })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO, '主机详情') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    return c.json(okBody(await getOpsHost(c.req.valid('param').id)), 200);
  },
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['OpsHosts'], summary: '新增主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      // 凭据不进审计日志
      audit: { description: '新增运维主机', module: '主机管理', recordBody: false },
    })] as const,
    request: { body: { content: jsonContent(createOpsHostSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO, '已创建') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    return c.json(okBody(await createOpsHost(c.req.valid('json')), '已创建'), 200);
  },
});

const updateRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['OpsHosts'], summary: '更新主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      audit: { description: '更新运维主机', module: '主机管理', recordBody: false },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateOpsHostSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO, '已更新') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getOpsHostBeforeAudit(id));
    return c.json(okBody(await updateOpsHost(id, c.req.valid('json')), '已更新'), 200);
  },
});

const deleteRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['OpsHosts'], summary: '删除主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      audit: { description: '删除运维主机', module: '主机管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已删除') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getOpsHostBeforeAudit(id));
    await deleteOpsHost(id);
    return c.json(okBody(null, '已删除'), 200);
  },
});

const testRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/test', tags: ['OpsHosts'], summary: '测试主机连接',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: MANAGE_PERM })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(OpsHostTestResultDTO, '测试结果') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    return c.json(okBody(await testOpsHostConnection(c.req.valid('param').id)), 200);
  },
});

const probeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/probe', tags: ['OpsHosts'], summary: '立即探测主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO, '探测结果') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    return c.json(okBody(await probeOpsHost(c.req.valid('param').id)), 200);
  },
});

const probeAllRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/probe-all', tags: ['OpsHosts'], summary: '探测全部启用主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    responses: {
      ...commonErrorResponses,
      ...ok(OpsHostDTO.array(), '探测完成后的主机列表'),
    },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    await probeAllOpsHosts();
    return c.json(okBody(await listOpsHosts()), 200);
  },
});

const resetKeyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/reset-host-key', tags: ['OpsHosts'], summary: '重置 host key 指纹(主机重装后)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      audit: { description: '重置主机指纹', module: '主机管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已重置') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getOpsHostBeforeAudit(id));
    await resetOpsHostKey(id);
    return c.json(okBody(null, '已重置,下次连接将重新记录指纹'), 200);
  },
});

const importSshProfileRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/import-ssh-profile/{profileId}', tags: ['OpsHosts'], summary: '从当前用户 SSH 配置导入平台主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: MANAGE_PERM,
      audit: { description: '从 SSH 配置导入运维主机', module: '主机管理', recordBody: false },
    })] as const,
    request: {
      params: z.object({
        profileId: z.coerce.number().int().positive().openapi({
          param: { name: 'profileId', in: 'path' },
          example: 1,
        }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(OpsHostDTO, '已导入') },
  }),
  handler: async (c) => {
    assertPlatformHostAccess(c);
    const host = await importOpsHostFromSshProfile(c.req.valid('param').profileId, currentUser().userId);
    return c.json(okBody(host, '已导入'), 200);
  },
});

// probe-all 是静态路径,必须先于 /{id} 系列注册
router.openapiRoutes([
  listRoute,
  probeAllRoute,
  importSshProfileRoute,
  detailRoute,
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
  testRoute,
  probeRoute,
  resetKeyRoute,
] as const);

export default router;
