import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { updateWikiSettingsSchema } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  jsonContent, validationHook, commonErrorResponses, ok, okBody,
} from '../../lib/openapi-schemas';
import {
  WikiContributorDTO, WikiHotDocDTO, WikiSettingsDTO, WikiStaleDocDTO, WikiStatsOverviewDTO,
} from '../../lib/openapi-dtos';
import {
  getWikiSettings, getWikiStatsOverview, listWikiContributors, listWikiHotDocs,
  listWikiStaleDocs, updateWikiSettings,
} from '../../services/wiki/stats.service';

const statsRouter = new OpenAPIHono({ defaultHook: validationHook });

const LimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
    .openapi({ param: { name: 'limit', in: 'query' }, example: 10 }),
});

const overviewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/overview',
    tags: ['知识中心-统计'], summary: '知识库概览统计',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:stats:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(WikiStatsOverviewDTO, '概览统计') },
  }),
  handler: async (c) => c.json(okBody(await getWikiStatsOverview()), 200),
});

const hotDocsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/hot-docs',
    tags: ['知识中心-统计'], summary: '热门文档 Top N',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:stats:view' })] as const,
    request: { query: LimitQuery },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiHotDocDTO), '热门文档') },
  }),
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiHotDocs(limit)), 200);
  },
});

const contributorsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/contributors',
    tags: ['知识中心-统计'], summary: '贡献榜 Top N',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:stats:view' })] as const,
    request: { query: LimitQuery },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiContributorDTO), '贡献榜') },
  }),
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiContributors(limit)), 200);
  },
});

const staleDocsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/stale-docs',
    tags: ['知识中心-统计'], summary: '沉睡文档（长期未更新）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:stats:view' })] as const,
    request: { query: LimitQuery },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiStaleDocDTO), '沉睡文档') },
  }),
  handler: async (c) => {
    const { limit } = c.req.valid('query');
    return c.json(okBody(await listWikiStaleDocs(limit)), 200);
  },
});

statsRouter.openapiRoutes([
  overviewRoute,
  hotDocsRoute,
  contributorsRoute,
  staleDocsRoute,
] as const);

// ─── 设置（独立子路由，挂 /api/wiki/settings）─────────────────────────────────

const settingsRouter = new OpenAPIHono({ defaultHook: validationHook });

const getSettingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-设置'], summary: '获取知识库设置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:setting:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(WikiSettingsDTO, '知识库设置') },
  }),
  handler: async (c) => c.json(okBody(await getWikiSettings()), 200),
});

const updateSettingsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/',
    tags: ['知识中心-设置'], summary: '更新知识库设置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:setting:edit',
      audit: { description: '更新知识库设置', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(updateWikiSettingsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiSettingsDTO, '保存成功') },
  }),
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
