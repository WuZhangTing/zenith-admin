/**
 * IoT 设备分组 API（/api/iot/groups）
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { IotDeviceGroupDTO } from '../../lib/openapi-dtos';
import { createIotDeviceGroupSchema, updateIotDeviceGroupSchema } from '@zenith/shared/iot';
import {
  createIotDeviceGroup, deleteIotDeviceGroup, ensureIotDeviceGroupExists, getIotDeviceGroup,
  listAllIotDeviceGroups, listIotDeviceGroups, mapIotDeviceGroup, updateIotDeviceGroup,
} from '../../services/iot/iot-groups.service';

const iotGroupsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['IoT 分组'], summary: '设备分组列表（含设备数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional() }) },
    responses: { ...commonErrorResponses, ...okPaginated(IotDeviceGroupDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listIotDeviceGroups(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['IoT 分组'], summary: '全部分组（供筛选与批量操作圈选）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(IotDeviceGroupDTO), '全部分组') },
  }),
  handler: async (c) => c.json(okBody(await listAllIotDeviceGroups()), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['IoT 分组'], summary: '分组详情（含成员设备 id）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'iot:device:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(IotDeviceGroupDTO, '分组详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getIotDeviceGroup(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['IoT 分组'], summary: '创建分组',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:group:manage',
      audit: { description: '创建 IoT 设备分组', module: 'IoT 设备' },
    })] as const,
    request: { body: { content: jsonContent(createIotDeviceGroupSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(IotDeviceGroupDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createIotDeviceGroup(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['IoT 分组'], summary: '更新分组（含成员全量替换）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:group:manage',
      audit: { description: '更新 IoT 设备分组', module: 'IoT 设备' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateIotDeviceGroupSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(IotDeviceGroupDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapIotDeviceGroup(await ensureIotDeviceGroupExists(id)));
    return c.json(okBody(await updateIotDeviceGroup(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['IoT 分组'], summary: '删除分组（设备本身不受影响）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'iot:group:manage',
      audit: { description: '删除 IoT 设备分组', module: 'IoT 设备' },
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
    setAuditBeforeData(c, mapIotDeviceGroup(await ensureIotDeviceGroupExists(id)));
    await deleteIotDeviceGroup(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

iotGroupsRouter.openapiRoutes([
  listRoute,
  allRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default iotGroupsRouter;
