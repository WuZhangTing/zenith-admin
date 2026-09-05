import { OpenAPIHono } from '@hono/zod-openapi';
import { analyticsSiteContract } from '@zenith/shared/analytics';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { okBody, validationHook } from '../../lib/openapi-schemas';
import { createSite, deleteSite, listSites, regenerateSiteKey, updateSite } from '../../services/analytics/analytics-sites.service';

const r = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineContractRoute(analyticsSiteContract.sites, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage' })],
  handler: async (c) => c.json(okBody(await listSites(c.req.valid('query'))), 200),
});

const createSiteRoute = defineContractRoute(analyticsSiteContract.createSite, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '创建站点' } })],
  handler: async (c) => c.json(okBody(await createSite(c.req.valid('json')), '创建成功'), 200),
});

const updateSiteRoute = defineContractRoute(analyticsSiteContract.updateSite, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '更新站点' } })],
  handler: async (c) => c.json(okBody(await updateSite(c.req.valid('param').id, c.req.valid('json')), '更新成功'), 200),
});

const deleteSiteRoute = defineContractRoute(analyticsSiteContract.removeSite, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '删除站点' } })],
  handler: async (c) => {
    await deleteSite(c.req.valid('param').id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const regenerateKeyRoute = defineContractRoute(analyticsSiteContract.regenerateSiteKey, {
  middleware: [authMiddleware, guard({ permission: 'analytics:manage', audit: { module: '行为分析', description: '重新生成站点 Key' } })],
  handler: async (c) => c.json(okBody(await regenerateSiteKey(c.req.valid('param').id), '重新生成成功'), 200),
});

r.openapiRoutes([listRoute, createSiteRoute, updateSiteRoute, deleteSiteRoute, regenerateKeyRoute] as const);

export default r;
