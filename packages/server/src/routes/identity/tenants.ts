import { OpenAPIHono } from '@hono/zod-openapi';
import { tenantContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData, setAuditAfterData } from '../../middleware/guard';
import { platformAdminOnly } from '../../middleware/platform-admin';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
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

const admin = [authMiddleware, platformAdminOnly({ message: '仅平台管理员可管理租户' })] as const;

const listRoute = defineContractRoute(tenantContract.list, {
  middleware: admin,
  handler: async (c) => c.json(okBody(await listTenants(c.req.valid('query'))), 200),
});

const allRoute = defineContractRoute(tenantContract.all, {
  middleware: admin,
  handler: async (c) => c.json(okBody(await listAllTenants()), 200),
});

const statsRoute = defineContractRoute(tenantContract.stats, {
  middleware: admin,
  handler: async (c) => c.json(okBody(await getTenantStats(c.req.valid('param').id)), 200),
});

const detailRoute = defineContractRoute(tenantContract.detail, {
  middleware: admin,
  handler: async (c) => c.json(okBody(await getTenant(c.req.valid('param').id)), 200),
});

const createRouteDef = defineContractRoute(tenantContract.create, {
  // recordResponseBody: false — 创建响应可能含初始管理员一次性密码，不落审计日志
  middleware: [...admin, guard({ audit: { module: '租户管理', description: '创建租户', recordResponseBody: false } })],
  handler: async (c) => {
    const created = await createTenant(c.req.valid('json'));
    // 审计快照剔除初始密码
    const { initialAdmin, ...tenantOnly } = created;
    setAuditAfterData(c, initialAdmin ? { ...tenantOnly, initialAdmin: { username: initialAdmin.username, email: initialAdmin.email } } : tenantOnly);
    return c.json(okBody(created, '创建成功'), 200);
  },
});

const updateRouteDef = defineContractRoute(tenantContract.update, {
  middleware: [...admin, guard({ audit: { module: '租户管理', description: '更新租户' } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getTenantBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateTenant(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(tenantContract.remove, {
  middleware: [...admin, guard({ audit: { module: '租户管理', description: '删除租户' } })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getTenantBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteTenant(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

tenantsRoute.openapiRoutes([listRoute, allRoute, statsRoute, detailRoute, createRouteDef, updateRouteDef, deleteRouteDef] as const);

export default tenantsRoute;
