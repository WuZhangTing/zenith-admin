import { OpenAPIHono } from '@hono/zod-openapi';
import { apiTokenContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { listApiTokens, createApiToken, deleteApiToken } from '../../services/identity/api-tokens.service';

const apiTokensRoute = new OpenAPIHono({ defaultHook: validationHook });

const list = defineContractRoute(apiTokenContract.list, {
  middleware: [authMiddleware] as const,
  handler: async (c) => c.json(okBody(await listApiTokens()), 200),
});

const create = defineContractRoute(apiTokenContract.create, {
  middleware: [authMiddleware] as const,
  handler: async (c) => c.json(okBody(await createApiToken(c.req.valid('json')), 'Token 已创建，请务必复制保存，此后将无法再次查看完整 Token'), 200),
});

const deleteToken = defineContractRoute(apiTokenContract.remove, {
  middleware: [authMiddleware] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await deleteApiToken(id);
    return c.json(okBody(null, 'Token 已撤销'), 200);
  },
});

apiTokensRoute.openapiRoutes([list, create, deleteToken] as const);

export default apiTokensRoute;
