import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  jsonContent,
  validationHook,
  commonErrorResponses,
  ok,
  okMsg,
  okBody,
} from '../../lib/openapi-schemas';
import { AiEvalDatasetDTO, AiEvalDatasetItemDTO, AiEvalExperimentDTO, AiEvalExperimentResultDTO } from '../../lib/openapi-dtos';
import {
  listEvalDatasets,
  createEvalDataset,
  updateEvalDataset,
  deleteEvalDataset,
  listEvalItems,
  addEvalItems,
  deleteEvalItem,
  runEvalExperiment,
  listEvalExperiments,
  getEvalExperimentResults,
} from '../../services/ai/ai-eval.service';
import { createAiEvalDatasetSchema, updateAiEvalDatasetSchema, addAiEvalItemsSchema, runAiExperimentSchema } from '@zenith/shared/ai';

const router = new OpenAPIHono({ defaultHook: validationHook });

const DatasetIdParam = z.object({
  id: z.string().min(1).openapi({ param: { name: 'id', in: 'path' }, example: 'ds-uuid' }),
});

const ItemParam = DatasetIdParam.extend({
  itemId: z.string().min(1).openapi({ param: { name: 'itemId', in: 'path' }, example: 'item-uuid' }),
});

const ExperimentParam = DatasetIdParam.extend({
  experimentId: z.string().min(1).openapi({ param: { name: 'experimentId', in: 'path' }, example: 'exp-uuid' }),
});

const list = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['AI'],
    summary: '评测数据集列表(Mastra Datasets)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(AiEvalDatasetDTO), '数据集列表') },
  }),
  handler: async (c) => c.json(okBody(await listEvalDatasets()), 200),
});

const create = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/',
    tags: ['AI'],
    summary: '创建评测数据集',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage' })] as const,
    request: { body: { content: jsonContent(createAiEvalDatasetSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiEvalDatasetDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createEvalDataset(c.req.valid('json')), '创建成功'), 200),
});

const update = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/{id}',
    tags: ['AI'],
    summary: '更新评测数据集',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage' })] as const,
    request: { params: DatasetIdParam, body: { content: jsonContent(updateAiEvalDatasetSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiEvalDatasetDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await updateEvalDataset(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const remove = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['AI'],
    summary: '删除评测数据集',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage' })] as const,
    request: { params: DatasetIdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await deleteEvalDataset(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const items = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}/items',
    tags: ['AI'],
    summary: '数据集条目列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:list' })] as const,
    request: { params: DatasetIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(AiEvalDatasetItemDTO), '条目列表') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listEvalItems(id)), 200);
  },
});

const addItems = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/{id}/items',
    tags: ['AI'],
    summary: '批量添加数据集条目',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage' })] as const,
    request: { params: DatasetIdParam, body: { content: jsonContent(addAiEvalItemsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(z.array(AiEvalDatasetItemDTO), '添加成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await addEvalItems(id, c.req.valid('json')), '添加成功'), 200);
  },
});

const removeItem = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/{id}/items/{itemId}',
    tags: ['AI'],
    summary: '删除数据集条目',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage' })] as const,
    request: { params: ItemParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id, itemId } = c.req.valid('param');
    await deleteEvalItem(id, itemId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const runExperiment = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/{id}/experiments',
    tags: ['AI'],
    summary: '发起实验(异步执行,经实验列表轮询状态)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:manage', audit: { description: '发起评测实验', module: '智能助手' } })] as const,
    request: { params: DatasetIdParam, body: { content: jsonContent(runAiExperimentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(z.object({ experimentId: z.string(), name: z.string() }).openapi('AiEvalExperimentStarted'), '已发起') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await runEvalExperiment(id, c.req.valid('json')), '实验已发起'), 200);
  },
});

const experiments = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}/experiments',
    tags: ['AI'],
    summary: '实验列表(含各打分器平均分,可横向对比)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:list' })] as const,
    request: { params: DatasetIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(AiEvalExperimentDTO), '实验列表') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listEvalExperiments(id)), 200);
  },
});

const experimentResults = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}/experiments/{experimentId}',
    tags: ['AI'],
    summary: '实验详情与逐条结果',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'ai:eval:list' })] as const,
    request: { params: ExperimentParam },
    responses: {
      ...commonErrorResponses,
      ...ok(z.object({ experiment: AiEvalExperimentDTO, results: z.array(AiEvalExperimentResultDTO) }).openapi('AiEvalExperimentDetail'), '实验结果'),
    },
  }),
  handler: async (c) => {
    const { id, experimentId } = c.req.valid('param');
    return c.json(okBody(await getEvalExperimentResults(id, experimentId)), 200);
  },
});

router.openapiRoutes([list, create, update, remove, items, addItems, removeItem, runExperiment, experiments, experimentResults] as const);

export default router;
