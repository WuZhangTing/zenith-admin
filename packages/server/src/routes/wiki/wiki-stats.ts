import { OpenAPIHono } from '@hono/zod-openapi';
import { wikiSettingsContract, wikiStatsContract } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  getWikiSettings, getWikiStatsOverview, listWikiContributors, listWikiHotDocs,
  listWikiStaleDocs, updateWikiSettings,
} from '../../services/wiki/stats.service';
import { getWikiOpsStats } from '../../services/wiki/governance.service';

const statsRouter = new OpenAPIHono({ defaultHook: validationHook });

const statsRead = [authMiddleware, guard({ permission: 'wiki:stats:view' })] as const;

const overviewRoute = defineContractRoute(wikiStatsContract.overview, {
  middleware: statsRead,
  handler: async (c) => c.json(okBody(await getWikiStatsOverview()), 200),
});

const hotDocsRoute = defineContractRoute(wikiStatsContract.hotDocs, {
  middleware: statsRead,
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiHotDocs(limit)), 200);
  },
});

const contributorsRoute = defineContractRoute(wikiStatsContract.contributors, {
  middleware: statsRead,
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiContributors(limit)), 200);
  },
});

const staleDocsRoute = defineContractRoute(wikiStatsContract.staleDocs, {
  middleware: statsRead,
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiStaleDocs(limit)), 200);
  },
});

const opsStatsRoute = defineContractRoute(wikiStatsContract.ops, {
  middleware: statsRead,
  handler: async (c) => c.json(okBody(await getWikiOpsStats()), 200),
});

statsRouter.openapiRoutes([
  overviewRoute,
  hotDocsRoute,
  contributorsRoute,
  staleDocsRoute,
  opsStatsRoute,
] as const);

// ─── 设置（独立子路由，挂 wikiSettingsContract.basePath）─────────────────────

const settingsRouter = new OpenAPIHono({ defaultHook: validationHook });

const getSettingsRoute = defineContractRoute(wikiSettingsContract.get, {
  middleware: [authMiddleware, guard({ permission: 'wiki:setting:view' })],
  handler: async (c) => c.json(okBody(await getWikiSettings()), 200),
});

const updateSettingsRoute = defineContractRoute(wikiSettingsContract.update, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:setting:edit',
    audit: { description: '更新知识库设置', module: '知识中心' },
  })],
  handler: async (c) => {
    setAuditBeforeData(c, await getWikiSettings());
    return c.json(okBody(await updateWikiSettings(c.req.valid('json')), '保存成功'), 200);
  },
});

settingsRouter.openapiRoutes([
  getSettingsRoute,
  updateSettingsRoute,
] as const);

export { settingsRouter };
export default statsRouter;
