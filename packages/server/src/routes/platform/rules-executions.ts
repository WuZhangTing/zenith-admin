/**
 * 规则执行记录路由（全资产通用）：/api/rules/executions
 * 覆盖决策表 / 决策流 / 评分卡 / 名单命中的统一留痕，支持按资产类型与调用方筛选。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { RULE_EXECUTION_SOURCES, RULE_REF_KINDS } from '@zenith/shared/rules';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { PaginationQuery, commonErrorResponses, dateRangeBound, okBody, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { RuleExecutionDTO } from '../../lib/openapi-dtos';
import { listRuleExecutions } from '../../services/platform/rules-executions.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['RuleExecutions'], summary: '规则执行记录（全资产 trace/审计，分页）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:table:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        refKind: z.enum(RULE_REF_KINDS).optional(),
        refId: z.coerce.number().int().optional(),
        caller: z.string().optional(),
        bizRef: z.string().max(128).optional(),
        ruleKey: z.string().optional(),
        source: z.enum(RULE_EXECUTION_SOURCES).optional(),
        matched: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
        dateStart: dateRangeBound('起始日期'),
        dateEnd: dateRangeBound('结束日期'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(RuleExecutionDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listRuleExecutions(c.req.valid('query'))), 200),
});

router.openapiRoutes([listRoute] as const);

export default router;
