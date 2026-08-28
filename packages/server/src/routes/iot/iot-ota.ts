/**
 * IoT 三期 API：总览仪表盘（/api/iot/dashboard）、固件包（/api/iot/firmwares）、
 * OTA 升级任务（/api/iot/ota-tasks）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody, errBody,
} from '../../lib/openapi-schemas';
import {
  IotDashboardDTO, IotFirmwareDTO, IotOtaTaskDTO, IotOtaTaskDeviceDTO,
} from '../../lib/openapi-dtos';
import {
  createIotOtaTaskSchema, updateIotFirmwareSchema,
  IOT_FIRMWARE_VERSION_PATTERN, IOT_OTA_DEVICE_STATUSES, IOT_OTA_TASK_STATUSES,
} from '@zenith/shared/iot';
import { getIotDashboard } from '../../services/iot/iot-dashboard.service';
import {
  createIotFirmware, deleteIotFirmware, ensureIotFirmwareExists, listIotFirmwares,
  mapIotFirmware, updateIotFirmware,
} from '../../services/iot/iot-firmware.service';
import {
  cancelIotOtaTask, createIotOtaTask, getIotOtaTask, listIotOtaTaskDevices, listIotOtaTasks,
} from '../../services/iot/iot-ota.service';

// ─── 仪表盘 ───────────────────────────────────────────────────────────────────
export const iotDashboardRouter = new OpenAPIHono({ defaultHook: validationHook });

const dashboardRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 仪表盘'], summary: 'IoT 总览（统计卡 / 在线与告警趋势 / 产品分布 / 最近告警与事件）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:dashboard:view' })] as const,
    responses: { ...commonErrorResponses, ...ok(IotDashboardDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await getIotDashboard()), 200),
});

iotDashboardRouter.openapiRoutes([dashboardRoute] as const);

// ─── 固件包 ───────────────────────────────────────────────────────────────────
export const iotFirmwaresRouter = new OpenAPIHono({ defaultHook: validationHook });

const uploadFirmwareFieldsSchema = z.object({
  productId: z.coerce.number().int().positive(),
  version: z.string().regex(IOT_FIRMWARE_VERSION_PATTERN, '版本号需为语义化格式，如 1.2.3'),
  releaseNotes: z.string().max(4000).optional(),
});

const listFirmwaresRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 固件'], summary: '固件包列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:ota:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotFirmwareDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotFirmwares(c.req.valid('query'))), 200),
});

const uploadFirmwareRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 固件'], summary: '上传固件包（multipart，服务端计算 SHA256）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:ota:firmware:manage',
      audit: { description: '上传 IoT 固件', module: 'IoT 固件', recordBody: false },
    })] as const,
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().openapi({ type: 'string', format: 'binary' }),
              productId: z.coerce.number().int().positive(),
              version: z.string(),
              releaseNotes: z.string().optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(IotFirmwareDTO, '上传成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数不合法或未选择文件' },
    },
  }),
  handler: async (c) => {
    const body = await c.req.parseBody();
    const parsed = uploadFirmwareFieldsSchema.safeParse({
      productId: body.productId,
      version: body.version,
      releaseNotes: body.releaseNotes || undefined,
    });
    if (!parsed.success) return c.json(errBody(parsed.error.issues[0]?.message ?? '参数不合法', 400), 400);
    if (!(body.file instanceof File)) return c.json(errBody('请选择要上传的固件文件', 400), 400);
    const row = await createIotFirmware({
      productId: parsed.data.productId,
      version: parsed.data.version,
      releaseNotes: parsed.data.releaseNotes ?? null,
    }, body.file);
    return c.json(okBody(row, '上传成功'), 200);
  },
});

const updateFirmwareRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 固件'], summary: '更新固件（仅发布说明与状态；版本与文件不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:ota:firmware:manage',
      audit: { description: '更新 IoT 固件', module: 'IoT 固件' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotFirmwareSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotFirmwareDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotFirmware(await ensureIotFirmwareExists(id)));
    return c.json(okBody(await updateIotFirmware(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteFirmwareRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 固件'], summary: '删除固件（存在升级任务时拒绝，托管文件一并回收）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:ota:firmware:manage',
      audit: { description: '删除 IoT 固件', module: 'IoT 固件' },
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
    setAuditBeforeData(c, mapIotFirmware(await ensureIotFirmwareExists(id)));
    await deleteIotFirmware(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotFirmwaresRouter.openapiRoutes([
  listFirmwaresRoute,
  uploadFirmwareRoute,
  updateFirmwareRoute,
  deleteFirmwareRoute,
] as const);

// ─── OTA 任务 ─────────────────────────────────────────────────────────────────
export const iotOtaTasksRouter = new OpenAPIHono({ defaultHook: validationHook });

const listTasksRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 固件'], summary: '升级任务列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:ota:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        productId: z.coerce.number().int().positive().optional(),
        status: z.enum(IOT_OTA_TASK_STATUSES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotOtaTaskDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotOtaTasks(c.req.valid('query'))), 200),
});

const createTaskRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 固件'], summary: '创建升级任务（WS 在线即推，离线心跳捎带；版本上报一致即成功）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:ota:task:create',
      audit: { description: '创建 IoT 升级任务', module: 'IoT 固件' },
    })] as const,
    request: { body: { content: jsonContent(createIotOtaTaskSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotOtaTaskDTO, '任务已创建') },
  }),
  handler: async (c) => c.json(okBody(await createIotOtaTask(c.req.valid('json')), '升级任务已创建'), 200),
});

const getTaskRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['IoT 固件'], summary: '升级任务详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:ota:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotOtaTaskDTO, '任务详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getIotOtaTask(id)), 200);
  },
});

const listTaskDevicesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/devices',
    tags: ['IoT 固件'], summary: '升级任务设备明细',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:ota:list' })] as const,
    request: {
      params: IdParam,
      query: PaginationQuery.extend({
        status: z.enum(IOT_OTA_DEVICE_STATUSES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotOtaTaskDeviceDTO, '设备明细') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listIotOtaTaskDevices(id, c.req.valid('query'))), 200);
  },
});

const cancelTaskRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/cancel',
    tags: ['IoT 固件'], summary: '取消升级任务（未终态设备一并取消）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:ota:task:create',
      audit: { description: '取消 IoT 升级任务', module: 'IoT 固件' },
    })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotOtaTaskDTO, '已取消'),
      400: { content: jsonContent(ErrorResponse), description: '任务已结束' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await cancelIotOtaTask(id), '任务已取消'), 200);
  },
});

iotOtaTasksRouter.openapiRoutes([
  listTasksRoute,
  createTaskRoute,
  getTaskRoute,
  listTaskDevicesRoute,
  cancelTaskRoute,
] as const);
