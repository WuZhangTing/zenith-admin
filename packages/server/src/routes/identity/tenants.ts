import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createTenantSchema, updateTenantSchema } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData, setAuditAfterData } from '../../middleware/guard';
import { platformAdminOnly } from '../../middleware/platform-admin';
import { PaginationQuery, jsonContent, validationHook, commonErrorResponses, ok, okPaginated, okMsg, IdParam, okBody } from '../../lib/openapi-schemas';
import { TenantDTO, TenantStatsDTO } from '../../lib/openapi-dtos';
import {
  listTenants,
  listAllTenants,
  getTenant,
  getTenantStats,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantBeforeAudit,
} from '../../services/identity/tenants.service';

const tenantsRoute = new OpenAPIHono({ defaultHook: validationHook });

const platformAdminMiddleware = platformAdminOnly({ message: '仅平台管理员可管理租户' });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['Tenants'], summary: '租户列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional(), status: z.enum(['enabled', 'disabled']).optional() }) },
    responses: { ...okPaginated(TenantDTO, 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listTenants(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all', tags: ['Tenants'], summary: '全部租户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware] as const,
    responses: { ...ok(z.array(TenantDTO), 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listAllTenants()), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['Tenants'], summary: '租户详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware] as const,
    request: { params: IdParam },
    responses: { ...ok(TenantDTO, 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getTenant(id)), 200);
  },
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['Tenants'], summary: '创建租户',
    security: [{ BearerAuth: [] }],
    // recordResponseBody: false — 创建响应可能含初始管理员一次性密码，不落审计日志
    middleware: [authMiddleware, platformAdminMiddleware, guard({ audit: { module: '租户管理', description: '创建租户', recordResponseBody: false } })] as const,
    request: { body: { content: jsonContent(createTenantSchema), required: true } },
    responses: { ...ok(TenantDTO, '创建成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const created = await createTenant(c.req.valid('json'));
    // 审计快照剔除初始密码
    const { initialAdmin, ...tenantOnly } = created as typeof created & { initialAdmin?: { username: string; email: string; password: string } };
    setAuditAfterData(c, initialAdmin ? { ...tenantOnly, initialAdmin: { username: initialAdmin.username, email: initialAdmin.email } } : tenantOnly);
    return c.json(okBody(created, '创建成功'), 200);
  },
});

const updateRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['Tenants'], summary: '更新租户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware, guard({ audit: { module: '租户管理', description: '更新租户' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateTenantSchema), required: true } },
    responses: { ...ok(TenantDTO, '更新成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getTenantBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateTenant(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['Tenants'], summary: '删除租户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware, guard({ audit: { module: '租户管理', description: '删除租户' } })] as const,
    request: { params: IdParam },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getTenantBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteTenant(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/stats', tags: ['Tenants'], summary: '租户用量概览',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, platformAdminMiddleware] as const,
    request: { params: IdParam },
    responses: { ...ok(TenantStatsDTO, 'ok'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getTenantStats(id)), 200);
  },
});

tenantsRoute.openapiRoutes([listRoute, allRoute, statsRoute, detailRoute, createRouteDef, updateRouteDef, deleteRouteDef] as const);

export default tenantsRoute;
