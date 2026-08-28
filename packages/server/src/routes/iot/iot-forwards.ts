/**
 * IoT 数据流转 API（/api/iot/forward-rules）
 *
 * CRUD + 投递日志查询；运行时派发见 iot-forward.service（挂在遥测/事件/告警/生命周期）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotForwardLogDTO, IotForwardRuleDTO } from '../../lib/openapi-dtos';
import {
  createIotForwardRuleSchema, updateIotForwardRuleSchema, IOT_FORWARD_SOURCES,
} from '@zenith/shared/iot';
import {
  createIotForwardRule, deleteIotForwardRule, ensureIotForwardRuleExists,
  listIotForwardLogs, listIotForwardRules, mapIotForwardRule, updateIotForwardRule,
} from '../../services/iot/iot-forward.service';

export const iotForwardRulesRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 数据流转'], summary: '流转规则列表（含近 24h 投递数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:forward:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        source: z.enum(IOT_FORWARD_SOURCES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotForwardRuleDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotForwardRules(c.req.valid('query'))), 200),
});

const listLogsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/logs',
    tags: ['IoT 数据流转'], summary: '投递日志（按时间倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:forward:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        ruleId: z.coerce.number().int().positive().optional(),
        status: z.enum(['succeeded', 'failed']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotForwardLogDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotForwardLogs(c.req.valid('query'))), 200),
});

const createForwardRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 数据流转'], summary: '创建流转规则（HTTP 推送目的地，可选 HMAC 签名）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:forward:create',
      audit: { description: '创建 IoT 流转规则', module: 'IoT 数据流转' },
    })] as const,
    request: { body: { content: jsonContent(createIotForwardRuleSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotForwardRuleDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotForwardRule(c.req.valid('json')), '创建成功'), 200),
});

const updateForwardRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 数据流转'], summary: '更新流转规则（数据源不可变更；启停会清零失败计数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:forward:update',
      audit: { description: '更新 IoT 流转规则', module: 'IoT 数据流转' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotForwardRuleSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotForwardRuleDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotForwardRule(await ensureIotForwardRuleExists(id)));
    return c.json(okBody(await updateIotForwardRule(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteForwardRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 数据流转'], summary: '删除流转规则（投递日志级联删除）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:forward:delete',
      audit: { description: '删除 IoT 流转规则', module: 'IoT 数据流转' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotForwardRule(await ensureIotForwardRuleExists(id)));
    await deleteIotForwardRule(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotForwardRulesRouter.openapiRoutes([
  listRoute,
  listLogsRoute,
  createForwardRoute,
  updateForwardRoute,
  deleteForwardRoute,
] as const);
