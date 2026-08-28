/**
 * IoT 设备管理 API（/api/iot/devices）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, BatchIdsBody, okBody, errBody, dateRangeBound,
} from '../../lib/openapi-schemas';
import {
  IotCommandDTO, IotDeviceDTO, IotDeviceEventDTO, IotDeviceLogDTO, IotDeviceShadowDTO,
  IotTelemetryAggPointDTO, IotTelemetryPointDTO, IotTopologyDTO,
} from '../../lib/openapi-dtos';
import {
  createIotDeviceSchema, updateIotDeviceSchema, sendIotCommandSchema, setIotDesiredSchema,
  IOT_DEVICE_EVENT_KINDS, IOT_EVENT_LEVELS, IOT_LOG_LEVELS, IOT_NODE_TYPES,
} from '@zenith/shared/iot';
import {
  listIotDevices, getIotDevice, createIotDevice, updateIotDevice, deleteIotDevices,
  resetIotDeviceSecret, clearIotDeviceTelemetry, ensureIotDeviceExists, mapIotDevice,
} from '../../services/iot/iot-devices.service';
import { listIotTelemetry, listIotCommands, sendIotCommand } from '../../services/iot/iot-telemetry.service';
import { listIotTelemetryAgg } from '../../services/iot/iot-rollup.service';
import { clearIotDesired, getIotDeviceShadow, setIotDesired } from '../../services/iot/iot-shadow.service';
import { listIotDeviceEvents } from '../../services/iot/iot-events.service';
import { listIotDeviceLogs } from '../../services/iot/iot-device-logs.service';
import { getIotDeviceTopology } from '../../services/iot/iot-topology.service';

const iotDevicesRouter = new OpenAPIHono({ defaultHook: validationHook });

// ─── GET / — 分页列表 ─────────────────────────────────────────────────────────
const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 设备'], summary: '设备列表（含在线态与最近指标快照）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
        productId: z.coerce.number().int().positive().optional(),
        groupId: z.coerce.number().int().positive().optional(),
        nodeType: z.enum(IOT_NODE_TYPES).optional(),
        gatewayId: z.coerce.number().int().positive().optional(),
        startTime: dateRangeBound('创建时间起'),
        endTime: dateRangeBound('创建时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotDeviceDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotDevices(c.req.valid('query'))), 200),
});

// ─── DELETE /batch ────────────────────────────────────────────────────────────
const batchDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch',
    tags: ['IoT 设备'], summary: '批量删除设备',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:delete',
      audit: { description: '批量删除 IoT 设备', module: 'IoT 设备' },
    })] as const,
    request: { body: { content: jsonContent(BatchIdsBody), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('批量删除成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    if (!ids?.length) return c.json(errBody('请选择要删除的记录'), 400);
    const deleted = await deleteIotDevices(ids);
    return c.json(okBody(null, `已删除 ${deleted} 台设备`), 200);
  },
});

// ─── GET /{id} — 详情 ─────────────────────────────────────────────────────────
const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['IoT 设备'], summary: '设备详情（含接入凭证与实时状态）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotDeviceDTO, '设备详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getIotDevice(id)), 200);
  },
});

// ─── GET /{id}/telemetry — 遥测点列 ──────────────────────────────────────────
const telemetryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/telemetry',
    tags: ['IoT 设备'], summary: '设备遥测（时间窗内点列，升序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:telemetry:view' })] as const,
    request: {
      params: IdParam,
      query: z.object({
        days: z.coerce.number().int().min(1).max(90).optional().openapi({ description: '时间窗天数，默认 1' }),
        limit: z.coerce.number().int().min(1).max(2000).optional().openapi({ description: '最大点数，默认 500' }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.array(IotTelemetryPointDTO), '遥测点列') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listIotTelemetry(id, c.req.valid('query'))), 200);
  },
});

// ─── GET /{id}/telemetry/agg — 长窗口小时聚合 ────────────────────────────────
const telemetryAggRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/telemetry/agg',
    tags: ['IoT 设备'], summary: '设备遥测小时聚合（长窗口图表：min/max/avg 区间带）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:telemetry:view' })] as const,
    request: {
      params: IdParam,
      query: z.object({
        property: z.string().min(1).max(64).openapi({ description: '数值属性标识符' }),
        days: z.coerce.number().int().min(1).max(90).optional().openapi({ description: '时间窗天数，默认 7' }),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.array(IotTelemetryAggPointDTO), '聚合点列') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { property, days } = c.req.valid('query');
    return c.json(okBody(await listIotTelemetryAgg(id, property, days)), 200);
  },
});

// ─── 指令：列表 + 下发 ────────────────────────────────────────────────────────
const listCommandsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/commands',
    tags: ['IoT 设备'], summary: '指令下发记录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:command:send' })] as const,
    request: { params: IdParam, query: PaginationQuery },
    responses: { ...commonErrorResponses, ...okPaginated(IotCommandDTO, '指令记录') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listIotCommands(id, c.req.valid('query'))), 200);
  },
});

const sendCommandRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/commands',
    tags: ['IoT 设备'], summary: '下发指令（WS 在线即时推送，离线等待上线补推）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:command:send',
      audit: { description: '下发 IoT 指令', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(sendIotCommandSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotCommandDTO, '已下发') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const row = await sendIotCommand(id, c.req.valid('json'));
    return c.json(okBody(row, row.status === 'delivered' ? '指令已实时送达设备' : '设备离线，指令将在上线后送达'), 200);
  },
});

// ─── POST /{id}/reset-secret ─────────────────────────────────────────────────
const resetSecretRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/reset-secret',
    tags: ['IoT 设备'], summary: '重置接入密钥（旧密钥立即失效）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:update',
      audit: { description: '重置 IoT 设备密钥', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(IotDeviceDTO, '已重置') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await resetIotDeviceSecret(id), '密钥已重置，请更新设备侧配置'), 200);
  },
});

// ─── DELETE /{id}/telemetry — 清空遥测 ───────────────────────────────────────
const clearTelemetryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/telemetry',
    tags: ['IoT 设备'], summary: '清空设备遥测数据',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:update',
      audit: { description: '清空 IoT 设备遥测', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('已清空') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const deleted = await clearIotDeviceTelemetry(id);
    return c.json(okBody(null, `已清空 ${deleted} 条遥测数据`), 200);
  },
});

// ─── 影子与事件 ───────────────────────────────────────────────────────────────
const getShadowRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/shadow',
    tags: ['IoT 设备'], summary: '设备影子（reported / desired / 在线标记）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(IotDeviceShadowDTO, '设备影子') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getIotDeviceShadow(id)), 200);
  },
});

const setDesiredRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/shadow/desired',
    tags: ['IoT 设备'], summary: '设置期望属性（rw 属性，按物模型校验；WS 在线即时推送）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:command:send',
      audit: { description: '设置 IoT 期望属性', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(setIotDesiredSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotDeviceShadowDTO, '已设置') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const row = await setIotDesired(id, c.req.valid('json'));
    return c.json(okBody(row, '期望属性已下发，设备确认后自动收敛'), 200);
  },
});

const clearDesiredRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/shadow/desired',
    tags: ['IoT 设备'], summary: '清空期望属性（放弃未确认的下发）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:command:send',
      audit: { description: '清空 IoT 期望属性', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(IotDeviceShadowDTO, '已清空') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await clearIotDesired(id), '期望属性已清空'), 200);
  },
});

const listEventsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/events',
    tags: ['IoT 设备'], summary: '设备事件流（生命周期 + 物模型事件，倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: {
      params: IdParam,
      query: PaginationQuery.extend({
        kind: z.enum(IOT_DEVICE_EVENT_KINDS).optional(),
        level: z.enum(IOT_EVENT_LEVELS).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotDeviceEventDTO, '事件流') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotDeviceExists(id);
    return c.json(okBody(await listIotDeviceEvents(id, c.req.valid('query'))), 200);
  },
});

// ─── POST / — 创建 ────────────────────────────────────────────────────────────
const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 设备'], summary: '注册设备（自动生成 SN 与接入密钥）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:create',
      audit: { description: '注册 IoT 设备', module: 'IoT 设备' },
    })] as const,
    request: { body: { content: jsonContent(createIotDeviceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotDeviceDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotDevice(c.req.valid('json')), '创建成功'), 200),
});

// ─── PUT /{id} — 更新 ─────────────────────────────────────────────────────────
const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 设备'], summary: '更新设备',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:update',
      audit: { description: '更新 IoT 设备', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotDeviceSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotDeviceDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await ensureIotDeviceExists(id);
    // 审计快照不含接入密钥
    const { secret: _secret, ...safeBefore } = mapIotDevice(before);
    setAuditBeforeData(c, safeBefore);
    return c.json(okBody(await updateIotDevice(id, c.req.valid('json')), '更新成功'), 200);
  },
});

// ─── DELETE /{id} — 删除 ──────────────────────────────────────────────────────
const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 设备'], summary: '删除设备（级联清除遥测与指令）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:device:delete',
      audit: { description: '删除 IoT 设备', module: 'IoT 设备' },
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
    const before = await ensureIotDeviceExists(id);
    const { secret: _secret, ...safeBefore } = mapIotDevice(before);
    setAuditBeforeData(c, safeBefore);
    await deleteIotDevices([id]);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 五期：拓扑与设备日志 ─────────────────────────────────────────────────────
const topologyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/topology',
    tags: ['IoT 设备'], summary: '网关拓扑（子设备 + 在线态 + 活跃告警数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotTopologyDTO, '拓扑'),
      404: { content: jsonContent(ErrorResponse), description: '设备不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const device = await ensureIotDeviceExists(id);
    return c.json(okBody(await getIotDeviceTopology(device)), 200);
  },
});

const listLogsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/logs',
    tags: ['IoT 设备'], summary: '设备运行日志（级别/关键字筛选，倒序）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: {
      params: IdParam,
      query: PaginationQuery.extend({
        level: z.enum(IOT_LOG_LEVELS).optional(),
        keyword: z.string().optional(),
        startTime: dateRangeBound('上报时间起'),
        endTime: dateRangeBound('上报时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotDeviceLogDTO, '设备日志') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotDeviceExists(id);
    return c.json(okBody(await listIotDeviceLogs(id, c.req.valid('query'))), 200);
  },
});

iotDevicesRouter.openapiRoutes([
  listRoute,
  batchDeleteRoute,
  getOneRoute,
  telemetryAggRoute,
  telemetryRoute,
  listCommandsRoute,
  sendCommandRoute,
  resetSecretRoute,
  clearTelemetryRoute,
  getShadowRoute,
  setDesiredRoute,
  clearDesiredRoute,
  listEventsRoute,
  topologyRoute,
  listLogsRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default iotDevicesRouter;
