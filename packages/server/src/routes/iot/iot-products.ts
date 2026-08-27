/**
 * IoT 产品管理 API（/api/iot/products）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotProductDTO } from '../../lib/openapi-dtos';
import { createIotProductSchema, updateIotProductSchema } from '@zenith/shared/iot';
import {
  listIotProducts, listAllIotProducts, getIotProduct, createIotProduct,
  updateIotProduct, deleteIotProduct, ensureIotProductExists, mapIotProduct,
} from '../../services/iot/iot-devices.service';

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

iotProductsRouter.openapiRoutes([
  listRoute,
  allRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default iotProductsRouter;
