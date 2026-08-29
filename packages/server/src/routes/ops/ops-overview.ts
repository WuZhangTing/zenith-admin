import { OpenAPIHono, createRoute, defineOpenAPIRoute } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { validationHook, commonErrorResponses, ok, okBody } from '../../lib/openapi-schemas';
import { OpsOverviewDTO } from '../../lib/openapi-dtos';
import { getOpsOverview } from '../../services/ops/ops-overview.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const overviewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['OpsOverview'], summary: '运维概览聚合快照',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:ops:overview' })] as const,
    responses: { ...commonErrorResponses, ...ok(OpsOverviewDTO, '运维概览') },
  }),
  handler: async (c) => c.json(okBody(await getOpsOverview()), 200),
});

router.openapiRoutes([overviewRoute] as const);

export default router;
