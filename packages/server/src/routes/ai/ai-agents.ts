import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import {
  jsonContent,
  validationHook,
  commonErrorResponses,
  ok,
  okMsg,
  IdParam,
  okBody,
} from '../../lib/openapi-schemas';
import { AiAgentDTO, AiBuiltinAgentDTO } from '../../lib/openapi-dtos';
import {
  listMyAgents,
  listBuiltinAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentDetail,
} from '../../services/ai/ai-agents.service';
import { createAiAgentSchema, updateAiAgentSchema } from '@zenith/shared/ai';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listMine = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['AI'],
    summary: '获取我的智能体列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(AiAgentDTO), '智能体列表') },
  }),
  handler: async (c) => c.json(okBody(await listMyAgents()), 200),
});

const builtin = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/builtin',
    tags: ['AI'],
    summary: '内置智能体列表(编程式定义,只读)',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(AiBuiltinAgentDTO), '内置智能体列表') },
  }),
  handler: async (c) => c.json(okBody(await listBuiltinAgents()), 200),
});

const detail = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['AI'],
    summary: '获取智能体详情（仅创建者）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(AiAgentDTO, '智能体详情') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getAgentDetail(id)), 200);
  },
});

const create = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/',
    tags: ['AI'],
    summary: '创建智能体（创建即用）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { body: { content: jsonContent(createAiAgentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiAgentDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createAgent(c.req.valid('json')), '创建成功'), 200),
});

const update = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/{id}',
    tags: ['AI'],
    summary: '更新智能体（仅创建者）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: IdParam, body: { content: jsonContent(updateAiAgentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AiAgentDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await updateAgent(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const remove = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['AI'],
    summary: '删除智能体（仅创建者）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await deleteAgent(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([listMine, builtin, detail, create, update, remove] as const);

export default router;
