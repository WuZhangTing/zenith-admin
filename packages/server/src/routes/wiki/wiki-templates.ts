import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createWikiTemplateSchema, updateWikiTemplateSchema } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { WikiTemplateDTO } from '../../lib/openapi-dtos';
import {
  createWikiTemplate, deleteWikiTemplate, ensureWikiTemplateExists, getWikiTemplate,
  listAllWikiTemplates, listWikiTemplates, mapWikiTemplate, updateWikiTemplate,
} from '../../services/wiki/templates.service';

const templatesRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-模板'], summary: '文档模板列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:template:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(WikiTemplateDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listWikiTemplates(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['知识中心-模板'], summary: '全部启用模板（编辑器选用）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(WikiTemplateDTO), '全部启用模板') },
  }),
  handler: async (c) => c.json(okBody(await listAllWikiTemplates()), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['知识中心-模板'], summary: '模板详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:template:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiTemplateDTO, '模板详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getWikiTemplate(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['知识中心-模板'], summary: '创建模板',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:template:create',
      audit: { description: '创建文档模板', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(createWikiTemplateSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiTemplateDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createWikiTemplate(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['知识中心-模板'], summary: '更新模板',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:template:edit',
      audit: { description: '更新文档模板', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateWikiTemplateSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiTemplateDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTemplate(await ensureWikiTemplateExists(id)));
    return c.json(okBody(await updateWikiTemplate(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['知识中心-模板'], summary: '删除模板',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:template:delete',
      audit: { description: '删除文档模板', module: '知识中心' },
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
    setAuditBeforeData(c, mapWikiTemplate(await ensureWikiTemplateExists(id)));
    await deleteWikiTemplate(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

templatesRouter.openapiRoutes([
  listRoute,
  allRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
] as const);

export default templatesRouter;
