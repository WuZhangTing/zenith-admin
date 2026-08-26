import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  PaginationQuery, jsonContent, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { RuleScorecardDTO, RuleScorecardEvaluateResultDTO, RuleAssetVersionDTO } from '../../lib/openapi-dtos';
import { createRuleScorecardSchema, updateRuleScorecardSchema, evaluateRuleScorecardSchema, toggleDecisionTableSchema } from '@zenith/shared/rules';
import {
  listRuleScorecards, getRuleScorecard, createRuleScorecard, updateRuleScorecard, deleteRuleScorecard,
  publishRuleScorecard, toggleRuleScorecard, testEvaluateRuleScorecard, evaluateRuleScorecardByKey,
  ensureRuleScorecard, mapRuleScorecard, listRuleScorecardVersions, rollbackRuleScorecard,
} from '../../services/platform/rules-scorecards.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const versionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/versions', tags: ['RuleScorecards'], summary: '评分卡版本历史',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(RuleAssetVersionDTO), 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listRuleScorecardVersions(c.req.valid('param').id)), 200),
});

const rollbackRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/rollback/{version}', tags: ['RuleScorecards'], summary: '回滚到历史版本（覆盖编辑态，置为草稿）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:update', audit: { description: '回滚评分卡版本', module: '规则中心' } })] as const,
    request: { params: z.object({ id: z.coerce.number().int(), version: z.coerce.number().int() }) },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, '回滚成功') },
  }),
  handler: async (c) => { const { id, version } = c.req.valid('param'); return c.json(okBody(await rollbackRuleScorecard(id, version), '回滚成功'), 200); },
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['RuleScorecards'], summary: '评分卡分页列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional(), status: z.enum(['draft', 'published', 'disabled']).optional() }) },
    responses: { ...commonErrorResponses, ...okPaginated(RuleScorecardDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listRuleScorecards(c.req.valid('query'))), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['RuleScorecards'], summary: '评分卡详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await getRuleScorecard(c.req.valid('param').id)), 200),
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['RuleScorecards'], summary: '创建评分卡',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:create', audit: { description: '创建评分卡', module: '规则中心' } })] as const,
    request: { body: { content: jsonContent(createRuleScorecardSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createRuleScorecard(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['RuleScorecards'], summary: '更新评分卡',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:update', audit: { description: '更新评分卡', module: '规则中心' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateRuleScorecardSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await ensureRuleScorecard(id).then((r) => mapRuleScorecard(r)).catch(() => null);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateRuleScorecard(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['RuleScorecards'], summary: '删除评分卡',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:delete', audit: { description: '删除评分卡', module: '规则中心' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => { await deleteRuleScorecard(c.req.valid('param').id); return c.json(okBody(null, '删除成功'), 200); },
});

const publishRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/publish', tags: ['RuleScorecards'], summary: '发布评分卡（固化快照，版本 +1）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:publish', audit: { description: '发布评分卡', module: '规则中心' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, '发布成功') },
  }),
  handler: async (c) => c.json(okBody(await publishRuleScorecard(c.req.valid('param').id), '发布成功'), 200),
});

const toggleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/toggle', tags: ['RuleScorecards'], summary: '启用/停用评分卡',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:update', audit: { description: '启停评分卡', module: '规则中心' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(toggleDecisionTableSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await toggleRuleScorecard(c.req.valid('param').id, c.req.valid('json').enabled)), 200),
});

const evaluateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/evaluate', tags: ['RuleScorecards'], summary: '测试求值（按编辑态草稿）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:evaluate' })] as const,
    request: { params: IdParam, body: { content: jsonContent(evaluateRuleScorecardSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardEvaluateResultDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await testEvaluateRuleScorecard(c.req.valid('param').id, c.req.valid('json').input)), 200),
});

const evaluateByKeyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/evaluate-by-key', tags: ['RuleScorecards'], summary: '运行时求值（按 key 取发布快照）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'rule:scorecard:evaluate' })] as const,
    request: { body: { content: jsonContent(z.object({ key: z.string().min(1).max(64), input: z.record(z.string(), z.unknown()).default({}) })), required: true } },
    responses: { ...commonErrorResponses, ...ok(RuleScorecardEvaluateResultDTO, 'ok') },
  }),
  handler: async (c) => { const b = c.req.valid('json'); return c.json(okBody(await evaluateRuleScorecardByKey(b.key, b.input)), 200); },
});

router.openapiRoutes([
  listRoute,
  evaluateByKeyRoute,
  createRouteDef,
  versionsRoute,
  rollbackRoute,
  detailRoute,
  updateRoute,
  deleteRoute,
  publishRoute,
  toggleRoute,
  evaluateRoute,
]);

export default router;
