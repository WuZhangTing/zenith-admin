import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createCmsModelSchema, updateCmsModelSchema } from '@zenith/shared/cms';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { CmsModelDTO } from '../../lib/openapi-dtos';
import {
  listCmsModels, listAllCmsModels, getCmsModel, createCmsModel, updateCmsModel, deleteCmsModel,
  getCmsModelRefs,
} from '../../services/cms/cms-models.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

/**
 * Model reads and mutations are site-scoped for ordinary operators.  The
 * service permits omission only for a platform administrator's global view.
 */
const modelScopeQuery = z.object({
  siteId: z.coerce.number().int().positive().optional(),
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['CMS-内容模型'], summary: '模型分页列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
        /** 站群可见性过滤：返回平台共享 + 该站点专属的模型 */
        siteId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsModelDTO, '模型列表') },
  }),
  handler: async (c) => c.json(okBody(await listCmsModels(c.req.valid('query'))), 200),
});

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all',
    tags: ['CMS-内容模型'], summary: '全部启用模型（栏目绑定下拉；普通请求必须提供 siteId）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:channel:list' })] as const,
    request: {
      query: modelScopeQuery,
    },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsModelDTO), '模型列表') },
  }),
  handler: async (c) => c.json(okBody(await listAllCmsModels(c.req.valid('query').siteId)), 200),
});

const refsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/refs',
    tags: ['CMS-内容模型'], summary: '模型引用统计（被哪些栏目绑定、内容/站点扩展使用量）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:list' })] as const,
    request: { params: IdParam, query: modelScopeQuery },
    responses: {
      ...commonErrorResponses,
      ...ok(z.object({
        channels: z.array(z.object({
          id: z.number().int(),
          siteId: z.number().int(),
          siteName: z.string(),
          name: z.string(),
        })),
        contentCount: z.number().int(),
        siteExtendCount: z.number().int(),
      }), '模型引用统计'),
    },
  }),
  handler: async (c) => c.json(okBody(await getCmsModelRefs(
    c.req.valid('param').id,
    c.req.valid('query').siteId,
  )), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['CMS-内容模型'], summary: '模型详情（含字段）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:list' })] as const,
    request: { params: IdParam, query: modelScopeQuery },
    responses: {
      ...commonErrorResponses,
      ...ok(CmsModelDTO, '模型详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => c.json(okBody(await getCmsModel(
    c.req.valid('param').id,
    c.req.valid('query').siteId,
  )), 200),
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['CMS-内容模型'], summary: '创建模型',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:create', audit: { description: '创建 CMS 内容模型', module: 'CMS内容管理' } })] as const,
    request: { body: { content: jsonContent(createCmsModelSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(CmsModelDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createCmsModel(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['CMS-内容模型'], summary: '更新模型（fields 提供时整组替换）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:update', audit: { description: '更新 CMS 内容模型', module: 'CMS内容管理' } })] as const,
    request: {
      params: IdParam,
      query: modelScopeQuery,
      body: { content: jsonContent(updateCmsModelSchema), required: true },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(CmsModelDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { siteId } = c.req.valid('query');
    setAuditBeforeData(c, await getCmsModel(id, siteId));
    return c.json(okBody(await updateCmsModel(id, c.req.valid('json'), siteId), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['CMS-内容模型'], summary: '删除模型',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:model:delete', audit: { description: '删除 CMS 内容模型', module: 'CMS内容管理' } })] as const,
    request: { params: IdParam, query: modelScopeQuery },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { siteId } = c.req.valid('query');
    setAuditBeforeData(c, await getCmsModel(id, siteId));
    await deleteCmsModel(id, siteId);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([listRoute, allRoute, getOneRoute, refsRoute, createRoute_, updateRoute_, deleteRoute_] as const);

export default router;
