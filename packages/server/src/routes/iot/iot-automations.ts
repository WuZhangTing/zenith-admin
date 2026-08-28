/**
 * IoT 场景联动 API（/api/iot/automations）
 *
 * CRUD + 执行记录查询；触发评估在设备接入热路径（见 iot-automations.service）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotAutomationDTO, IotAutomationRunDTO } from '../../lib/openapi-dtos';
import {
  createIotAutomationSchema, updateIotAutomationSchema, IOT_AUTOMATION_TRIGGERS,
} from '@zenith/shared/iot';
import {
  createIotAutomation, deleteIotAutomation, ensureIotAutomationExists,
  listIotAutomationRuns, listIotAutomations, mapIotAutomation, updateIotAutomation,
} from '../../services/iot/iot-automations.service';

export const iotAutomationsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 场景联动'], summary: '联动规则列表（含近 24h 触发次数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:automation:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        triggerType: z.enum(IOT_AUTOMATION_TRIGGERS).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotAutomationDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotAutomations(c.req.valid('query'))), 200),
});

const listRunsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/runs',
    tags: ['IoT 场景联动'], summary: '联动执行记录（按时间倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:automation:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        automationId: z.coerce.number().int().positive().optional(),
        deviceId: z.coerce.number().int().positive().optional(),
        success: z.enum(['true', 'false']).optional()
          .transform((v) => (v === undefined ? undefined : v === 'true')),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotAutomationRunDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotAutomationRuns(c.req.valid('query'))), 200),
});

const createAutomationRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 场景联动'], summary: '创建联动规则（触发器 + 动作编排）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:automation:create',
      audit: { description: '创建 IoT 场景联动', module: 'IoT 场景联动' },
    })] as const,
    request: { body: { content: jsonContent(createIotAutomationSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotAutomationDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotAutomation(c.req.valid('json')), '创建成功'), 200),
});

const updateAutomationRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 场景联动'], summary: '更新联动规则（触发类型与所属产品不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:automation:update',
      audit: { description: '更新 IoT 场景联动', module: 'IoT 场景联动' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotAutomationSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotAutomationDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotAutomation(await ensureIotAutomationExists(id)));
    return c.json(okBody(await updateIotAutomation(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteAutomationRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 场景联动'], summary: '删除联动规则（执行记录级联删除）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:automation:delete',
      audit: { description: '删除 IoT 场景联动', module: 'IoT 场景联动' },
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
    setAuditBeforeData(c, mapIotAutomation(await ensureIotAutomationExists(id)));
    await deleteIotAutomation(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotAutomationsRouter.openapiRoutes([
  listRoute,
  listRunsRoute,
  createAutomationRoute,
  updateAutomationRoute,
  deleteAutomationRoute,
] as const);
