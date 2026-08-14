import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createWikiTagSchema, updateWikiTagSchema } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { WikiTagDTO } from '../../lib/openapi-dtos';
import {
  createWikiTag, deleteWikiTag, ensureWikiTagExists, listAllWikiTags, listWikiTags,
  mapWikiTag, updateWikiTag,
} from '../../services/wiki/tags.service';

const tagsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-标签'], summary: '标签列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:tag:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional() }) },
    responses: { ...commonErrorResponses, ...okPaginated(WikiTagDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listWikiTags(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['知识中心-标签'], summary: '全部标签（编辑器打标）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(WikiTagDTO), '全部标签') },
  }),
  handler: async (c) => c.json(okBody(await listAllWikiTags()), 200),
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['知识中心-标签'], summary: '创建标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:tag:create',
      audit: { description: '创建标签', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(createWikiTagSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiTagDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createWikiTag(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['知识中心-标签'], summary: '更新标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:tag:edit',
      audit: { description: '更新标签', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateWikiTagSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiTagDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTag(await ensureWikiTagExists(id)));
    return c.json(okBody(await updateWikiTag(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['知识中心-标签'], summary: '删除标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:tag:delete',
      audit: { description: '删除标签', module: '知识中心' },
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
    setAuditBeforeData(c, mapWikiTag(await ensureWikiTagExists(id)));
    await deleteWikiTag(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

tagsRouter.openapiRoutes([
  listRoute,
  allRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default tagsRouter;
