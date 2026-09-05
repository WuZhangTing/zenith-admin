import { OpenAPIHono } from '@hono/zod-openapi';
import { identityProviderContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  createIdentityProvider,
  deleteIdentityProvider,
  getIdentityProvider,
  getIdentityProviderBeforeAudit,
  listIdentityProviders,
  searchIdentityProviderUsers,
  syncIdentityProviderUsers,
  testIdentityProviderConnection,
  updateIdentityProvider,
} from '../../services/identity/identity-providers.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const permission = 'system:identity-provider:manage';
const manage = [authMiddleware, guard({ permission })] as const;

const listRoute = defineContractRoute(identityProviderContract.list, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await listIdentityProviders(c.req.valid('query'))), 200),
});

const detailRoute = defineContractRoute(identityProviderContract.detail, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await getIdentityProvider(c.req.valid('param').id)), 200),
});

const testConnectionRoute = defineContractRoute(identityProviderContract.test, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await testIdentityProviderConnection(c.req.valid('param').id)), 200),
});

const searchDirectoryUsersRoute = defineContractRoute(identityProviderContract.ldapUsers, {
  middleware: manage,
  handler: async (c) => c.json(okBody(await searchIdentityProviderUsers(c.req.valid('param').id, c.req.valid('query'))), 200),
});

const syncDirectoryUsersRoute = defineContractRoute(identityProviderContract.sync, {
  middleware: [authMiddleware, guard({ permission, audit: { module: '企业身份源', description: '同步目录用户' } })] as const,
  handler: async (c) => c.json(okBody(await syncIdentityProviderUsers(c.req.valid('param').id, c.req.valid('json')), '同步完成'), 200),
});

const createRouteDef = defineContractRoute(identityProviderContract.create, {
  middleware: [authMiddleware, guard({ permission, audit: { module: '企业身份源', description: '创建企业身份源' } })] as const,
  handler: async (c) => c.json(okBody(await createIdentityProvider(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(identityProviderContract.update, {
  middleware: [authMiddleware, guard({ permission, audit: { module: '企业身份源', description: '更新企业身份源' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getIdentityProviderBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateIdentityProvider(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(identityProviderContract.remove, {
  middleware: [authMiddleware, guard({ permission, audit: { module: '企业身份源', description: '删除企业身份源' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getIdentityProviderBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteIdentityProvider(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([
  listRoute,
  detailRoute,
  testConnectionRoute,
  searchDirectoryUsersRoute,
  syncDirectoryUsersRoute,
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
] as const);

export default router;
