import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createCmsFragmentSchema, updateCmsFragmentSchema, CMS_FRAGMENT_TYPES } from '@zenith/shared';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { CmsFragmentDTO } from '../../lib/openapi-dtos';
import {
  listCmsFragments, getCmsFragment, createCmsFragment, updateCmsFragment, deleteCmsFragment,
  ensureCmsFragmentExists, mapCmsFragment,
} from '../../services/cms/cms-fragments.service';
import { sanitizeCmsFragmentContent } from '../../services/cms/cms-fragment-content';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['CMS-碎片管理'], summary: '碎片分页列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        siteId: z.coerce.number().int().positive(),
        keyword: z.string().optional(),
        type: z.enum(CMS_FRAGMENT_TYPES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsFragmentDTO, '碎片列表') },
  }),
  handler: async (c) => c.json(okBody(await listCmsFragments(c.req.valid('query'))), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['CMS-碎片管理'], summary: '碎片详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(CmsFragmentDTO, '碎片详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => c.json(okBody(await getCmsFragment(c.req.valid('param').id)), 200),
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['CMS-碎片管理'], summary: '创建碎片',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:create', audit: { description: '创建 CMS 碎片', module: 'CMS内容管理' } })] as const,
    request: { body: { content: jsonContent(createCmsFragmentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(CmsFragmentDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createCmsFragment(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['CMS-碎片管理'], summary: '更新碎片',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:update', audit: { description: '更新 CMS 碎片', module: 'CMS内容管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateCmsFragmentSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(CmsFragmentDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapCmsFragment(await ensureCmsFragmentExists(id)));
    return c.json(okBody(await updateCmsFragment(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['CMS-碎片管理'], summary: '删除碎片',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:delete', audit: { description: '删除 CMS 碎片', module: 'CMS内容管理' } })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapCmsFragment(await ensureCmsFragmentExists(id)));
    await deleteCmsFragment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const previewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/preview',
    tags: ['CMS-碎片管理'], summary: '碎片内容预览净化',
    description: '返回净化后的内容，供编辑器实时预览。净化白名单只有服务端一份，'
      + '前端自行实现会与它漂移，预览就又变成「所见非所得」。',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:fragment:list' })] as const,
    request: {
      body: {
        content: jsonContent(z.object({
          type: z.enum(CMS_FRAGMENT_TYPES),
          content: z.string().max(200_000).nullable().optional(),
        })),
        required: true,
      },
    },
    responses: { ...commonErrorResponses, ...ok(z.object({ content: z.string() }), '净化后的内容') },
  }),
  handler: async (c) => {
    const { type, content } = c.req.valid('json');
    return c.json(okBody({ content: sanitizeCmsFragmentContent(type, content ?? '') ?? '' }), 200);
  },
});

// preview 必须排在 /{id} 之前，否则会被当成 id 参数吞掉
router.openapiRoutes([listRoute, previewRoute, getOneRoute, createRoute_, updateRoute_, deleteRoute_] as const);

export default router;
