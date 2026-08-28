/**
 * IoT 告警 API（/api/iot/alarms + /api/iot/alarm-rules）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import { IotAlarmDTO, IotAlarmRuleDTO } from '../../lib/openapi-dtos';
import {
  createIotAlarmRuleSchema, updateIotAlarmRuleSchema,
  IOT_ALARM_LEVELS, IOT_ALARM_RULE_TYPES, IOT_ALARM_STATUSES,
} from '@zenith/shared/iot';
import {
  createIotAlarmRule, deleteIotAlarmRule, ensureIotAlarmRuleExists, listIotAlarmRules,
  listIotAlarms, mapIotAlarmRule, resolveIotAlarm, updateIotAlarmRule,
} from '../../services/iot/iot-alarms.service';

// ─── 告警记录（/api/iot/alarms）──────────────────────────────────────────────
export const iotAlarmsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listAlarmsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 告警'], summary: '告警记录（含设备信息，按触发时间倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:alarm:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(IOT_ALARM_STATUSES).optional(),
        level: z.enum(IOT_ALARM_LEVELS).optional(),
        ruleType: z.enum(IOT_ALARM_RULE_TYPES).optional(),
        deviceId: z.coerce.number().int().positive().optional(),
        startTime: dateRangeBound('触发时间起'),
        endTime: dateRangeBound('触发时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotAlarmDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotAlarms(c.req.valid('query'))), 200),
});

const resolveAlarmRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/resolve',
    tags: ['IoT 告警'], summary: '手动处理告警（标记已恢复）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:alarm:resolve',
      audit: { description: '处理 IoT 告警', module: 'IoT 告警' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotAlarmDTO, '已处理'),
      404: { content: jsonContent(ErrorResponse), description: '不存在或已恢复' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await resolveIotAlarm(id), '告警已处理'), 200);
  },
});

iotAlarmsRouter.openapiRoutes([listAlarmsRoute, resolveAlarmRoute] as const);

// ─── 告警规则（/api/iot/alarm-rules）─────────────────────────────────────────
export const iotAlarmRulesRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRulesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 告警'], summary: '告警规则列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:alarm:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        ruleType: z.enum(IOT_ALARM_RULE_TYPES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotAlarmRuleDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotAlarmRules(c.req.valid('query'))), 200),
});

const createRuleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 告警'], summary: '创建告警规则（阈值/离线/事件）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:alarm:rule:create',
      audit: { description: '创建 IoT 告警规则', module: 'IoT 告警' },
    })] as const,
    request: { body: { content: jsonContent(createIotAlarmRuleSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotAlarmRuleDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotAlarmRule(c.req.valid('json')), '创建成功'), 200),
});

const updateRuleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 告警'], summary: '更新告警规则（规则类型与所属产品不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:alarm:rule:update',
      audit: { description: '更新 IoT 告警规则', module: 'IoT 告警' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotAlarmRuleSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotAlarmRuleDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotAlarmRule(await ensureIotAlarmRuleExists(id)));
    return c.json(okBody(await updateIotAlarmRule(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRuleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 告警'], summary: '删除告警规则（历史告警记录保留）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:alarm:rule:delete',
      audit: { description: '删除 IoT 告警规则', module: 'IoT 告警' },
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
    setAuditBeforeData(c, mapIotAlarmRule(await ensureIotAlarmRuleExists(id)));
    await deleteIotAlarmRule(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotAlarmRulesRouter.openapiRoutes([
  listRulesRoute,
  createRuleRoute,
  updateRuleRoute,
  deleteRuleRoute,
] as const);
