import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createDriveTagSchema, updateDriveTagSchema } from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { IdParam, commonErrorResponses, jsonContent, ok, okBody, okMsg, validationHook } from '../../lib/openapi-schemas';
import { DriveTagDTO } from '../../lib/openapi-dtos';
import { createDriveTag, deleteDriveTag, listDriveTags, updateDriveTag } from '../../services/drive/drive-extras.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-标签';

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: [TAG], summary: '空间标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { query: z.object({ spaceId: z.coerce.number().int().positive() }) },
    responses: { ...commonErrorResponses, ...ok(z.array(DriveTagDTO), '标签') },
  }),
  handler: async (c) => c.json(okBody(await listDriveTags(c.req.valid('query').spaceId)), 200),
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: [TAG], summary: '新建标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit' })] as const,
    request: { body: { content: jsonContent(createDriveTagSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveTagDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createDriveTag(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: [TAG], summary: '更新标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit' })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateDriveTagSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveTagDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await updateDriveTag(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: [TAG], summary: '删除标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    await deleteDriveTag(c.req.valid('param').id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([listRoute, createRoute_, updateRoute_, deleteRoute_] as const);

export default router;
