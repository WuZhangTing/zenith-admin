/**
 * IoT 产品管理 API（/api/iot/products）：产品 CRUD + 物模型（属性/服务/事件）与 TSL 导入导出
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import {
  IotProductDTO, IotProductEventDTO, IotProductPropertyDTO, IotProductServiceDTO, IotThingModelDTO,
} from '../../lib/openapi-dtos';
import {
  createIotEventSchema, createIotPropertySchema, createIotServiceSchema, createIotProductSchema,
  importIotTslSchema, updateIotEventSchema, updateIotPropertySchema, updateIotProductSchema, updateIotServiceSchema,
} from '@zenith/shared/iot';
import {
  listIotProducts, listAllIotProducts, getIotProduct, createIotProduct,
  updateIotProduct, deleteIotProduct, ensureIotProductExists, mapIotProduct,
} from '../../services/iot/iot-devices.service';
import {
  createIotEvent, createIotProperty, createIotService, deleteIotEvent, deleteIotProperty, deleteIotService,
  ensureIotEventExists, ensureIotPropertyExists, ensureIotServiceExists, getThingModel, importIotTsl,
  mapIotEvent, mapIotProperty, mapIotService, updateIotEvent, updateIotProperty, updateIotService,
} from '../../services/iot/iot-model.service';

const SubIdParam = (name: 'propertyId' | 'serviceId' | 'eventId') => z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' }, example: 1 }),
  [name]: z.coerce.number().int().positive().openapi({ param: { name, in: 'path' }, example: 1 }),
}) as z.ZodObject<Record<'id' | typeof name, z.ZodNumber>>;

const iotProductsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 产品'], summary: '产品列表（含设备数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:product:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(IotProductDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotProducts(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['IoT 产品'], summary: '全部启用产品（供下拉框）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:product:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(IotProductDTO), '全部产品') },
  }),
  handler: async (c) => c.json(okBody(await listAllIotProducts()), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['IoT 产品'], summary: '产品详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:product:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotProductDTO, '产品详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getIotProduct(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 产品'], summary: '创建产品',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:create',
      audit: { description: '创建 IoT 产品', module: 'IoT 产品' },
    })] as const,
    request: { body: { content: jsonContent(createIotProductSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotProduct(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 产品'], summary: '更新产品',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '更新 IoT 产品', module: 'IoT 产品' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotProductSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotProductDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotProduct(await ensureIotProductExists(id)));
    return c.json(okBody(await updateIotProduct(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 产品'], summary: '删除产品（有设备时拒绝）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:delete',
      audit: { description: '删除 IoT 产品', module: 'IoT 产品' },
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
    setAuditBeforeData(c, mapIotProduct(await ensureIotProductExists(id)));
    await deleteIotProduct(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 物模型 ───────────────────────────────────────────────────────────────────
const getModelRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/model',
    tags: ['IoT 物模型'], summary: '产品物模型（属性/服务/事件，导出 TSL 同源）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:product:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(IotThingModelDTO, '物模型') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotProductExists(id);
    return c.json(okBody(await getThingModel(id)), 200);
  },
});

const importModelRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/model/import',
    tags: ['IoT 物模型'], summary: '导入 TSL（全量替换属性/服务/事件）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '导入 IoT 物模型', module: 'IoT 产品' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(importIotTslSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotThingModelDTO, '导入成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotProductExists(id);
    return c.json(okBody(await importIotTsl(id, c.req.valid('json')), '物模型已导入'), 200);
  },
});

const createPropertyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/properties',
    tags: ['IoT 物模型'], summary: '新增属性',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '新增 IoT 物模型属性', module: 'IoT 产品' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(createIotPropertySchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductPropertyDTO, '创建成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotProductExists(id);
    return c.json(okBody(await createIotProperty(id, c.req.valid('json')), '创建成功'), 200);
  },
});

const updatePropertyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/properties/{propertyId}',
    tags: ['IoT 物模型'], summary: '更新属性（标识符不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '更新 IoT 物模型属性', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('propertyId'), body: { content: jsonContent(updateIotPropertySchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductPropertyDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id, propertyId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotProperty(await ensureIotPropertyExists(id, propertyId)));
    return c.json(okBody(await updateIotProperty(id, propertyId, c.req.valid('json')), '更新成功'), 200);
  },
});

const deletePropertyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/properties/{propertyId}',
    tags: ['IoT 物模型'], summary: '删除属性',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '删除 IoT 物模型属性', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('propertyId') },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id, propertyId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotProperty(await ensureIotPropertyExists(id, propertyId)));
    await deleteIotProperty(id, propertyId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const createServiceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/services',
    tags: ['IoT 物模型'], summary: '新增服务',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '新增 IoT 物模型服务', module: 'IoT 产品' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(createIotServiceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductServiceDTO, '创建成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotProductExists(id);
    return c.json(okBody(await createIotService(id, c.req.valid('json')), '创建成功'), 200);
  },
});

const updateServiceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/services/{serviceId}',
    tags: ['IoT 物模型'], summary: '更新服务（标识符不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '更新 IoT 物模型服务', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('serviceId'), body: { content: jsonContent(updateIotServiceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductServiceDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id, serviceId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotService(await ensureIotServiceExists(id, serviceId)));
    return c.json(okBody(await updateIotService(id, serviceId, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteServiceRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/services/{serviceId}',
    tags: ['IoT 物模型'], summary: '删除服务',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '删除 IoT 物模型服务', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('serviceId') },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id, serviceId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotService(await ensureIotServiceExists(id, serviceId)));
    await deleteIotService(id, serviceId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const createEventRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/events',
    tags: ['IoT 物模型'], summary: '新增事件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '新增 IoT 物模型事件', module: 'IoT 产品' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(createIotEventSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductEventDTO, '创建成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await ensureIotProductExists(id);
    return c.json(okBody(await createIotEvent(id, c.req.valid('json')), '创建成功'), 200);
  },
});

const updateEventRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/events/{eventId}',
    tags: ['IoT 物模型'], summary: '更新事件（标识符不可变更）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '更新 IoT 物模型事件', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('eventId'), body: { content: jsonContent(updateIotEventSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotProductEventDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id, eventId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotEvent(await ensureIotEventExists(id, eventId)));
    return c.json(okBody(await updateIotEvent(id, eventId, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteEventRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/events/{eventId}',
    tags: ['IoT 物模型'], summary: '删除事件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:product:update',
      audit: { description: '删除 IoT 物模型事件', module: 'IoT 产品' },
    })] as const,
    request: { params: SubIdParam('eventId') },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id, eventId } = c.req.valid('param');
    await ensureIotProductExists(id);
    setAuditBeforeData(c, mapIotEvent(await ensureIotEventExists(id, eventId)));
    await deleteIotEvent(id, eventId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotProductsRouter.openapiRoutes([
  listRoute,
  allRoute,
  getModelRoute,
  importModelRoute,
  createPropertyRoute,
  updatePropertyRoute,
  deletePropertyRoute,
  createServiceRoute,
  updateServiceRoute,
  deleteServiceRoute,
  createEventRoute,
  updateEventRoute,
  deleteEventRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default iotProductsRouter;
