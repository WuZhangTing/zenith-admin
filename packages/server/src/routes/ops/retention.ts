import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { updateRetentionPolicySchema } from '@zenith/shared/ops';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { commonErrorResponses, jsonContent, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { RetentionPolicyDTO, RetentionPreviewDTO, RetentionRunResultDTO } from '../../lib/openapi-dtos';
import {
  listPolicies,
  previewPolicyPending,
  runPolicyNow,
  updatePolicy,
} from '../../services/ops/retention.service';

const retentionRouter = new OpenAPIHono({ defaultHook: validationHook });

const VIEW_PERM = 'system:retention:view';
const EDIT_PERM = 'system:retention:edit';
const RUN_PERM = 'system:retention:run';

const PolicyKeyParam = z.object({
  key: z.string().min(1).openapi({ param: { name: 'key', in: 'path' }, example: 'operation_logs' }),
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['Retention'], summary: '数据保留策略列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(RetentionPolicyDTO), '策略列表') },
  }),
  handler: async (c) => c.json(okBody(await listPolicies()), 200),
});

const updateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{key}', tags: ['Retention'], summary: '更新保留策略',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: EDIT_PERM,
      audit: { description: '更新数据保留策略', module: '数据保留' },
    })] as const,
    request: { params: PolicyKeyParam, body: { content: jsonContent(updateRetentionPolicySchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RetentionPolicyDTO, '更新后的策略') },
  }),
  handler: async (c) => {
    const { key } = c.req.valid('param');
    const list = await listPolicies();
    setAuditBeforeData(c, list.find((item) => item.key === key));
    const updated = await updatePolicy(key, c.req.valid('json'));
    setAuditAfterData(c, updated);
    return c.json(okBody(updated), 200);
  },
});

const previewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{key}/preview', tags: ['Retention'], summary: '预览待清理行数',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: VIEW_PERM })] as const,
    request: { params: PolicyKeyParam },
    responses: { ...commonErrorResponses, ...ok(RetentionPreviewDTO, '预览结果') },
  }),
  handler: async (c) => c.json(okBody(await previewPolicyPending(c.req.valid('param').key)), 200),
});

const runRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{key}/run', tags: ['Retention'], summary: '立即执行保留策略',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: RUN_PERM,
      audit: { description: '手动执行数据保留策略', module: '数据保留' },
    })] as const,
    request: { params: PolicyKeyParam },
    responses: { ...commonErrorResponses, ...ok(RetentionRunResultDTO, '执行结果') },
  }),
  handler: async (c) => {
    const { key } = c.req.valid('param');
    setAuditBeforeData(c, await previewPolicyPending(key));
    const deleted = await runPolicyNow(key);
    setAuditAfterData(c, { key, deleted });
    return c.json(okBody({ key, deleted }, `已清理 ${deleted} 行`), 200);
  },
});

retentionRouter.openapiRoutes([listRoute, updateRoute, previewRoute, runRoute] as const);

export default retentionRouter;
