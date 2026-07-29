import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  CMS_WIDGET_RENDERER_KEYS,
  CMS_WIDGET_STATUSES,
  CMS_WIDGET_TYPES,
  batchCmsWidgetSchema,
  createCmsWidgetSchema,
  saveCmsWidgetSlotSchema,
  updateCmsWidgetSchema,
} from '@zenith/shared';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import {
  IdParam,
  PaginationQuery,
  commonErrorResponses,
  jsonContent,
  ok,
  okBody,
  okMsg,
  okPaginated,
  validationHook,
} from '../../lib/openapi-schemas';
import {
  AsyncTaskDTO,
  CmsWidgetDTO,
  CmsWidgetPreviewDTO,
  CmsWidgetRefDTO,
  CmsWidgetRendererOptionDTO,
  CmsWidgetSlotDTO,
} from '../../lib/openapi-dtos';
import {
  createCmsWidget,
  deleteCmsWidget,
  getCmsWidget,
  getCmsWidgetPreview,
  listCmsWidgetRefs,
  listCmsWidgetRenderersForSite,
  listCmsWidgetSlots,
  listCmsWidgets,
  listPublishedCmsWidgets,
  offlineCmsWidget,
  publishCmsWidget,
  saveCmsWidgetSlot,
  updateCmsWidget,
} from '../../services/cms/cms-widgets.service';
import { submitCmsWidgetBatchTask } from '../../services/cms/cms-widget-tasks';

const router = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['CMS-页面部件'],
    summary: '页面部件分页列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        siteId: z.coerce.number().int().positive(),
        keyword: z.string().max(100).optional(),
        status: z.enum(CMS_WIDGET_STATUSES).optional(),
        type: z.enum(CMS_WIDGET_TYPES).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(CmsWidgetDTO, '页面部件列表') },
  }),
  handler: async (c) => c.json(okBody(await listCmsWidgets(c.req.valid('query'))), 200),
});

const optionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/options',
    tags: ['CMS-页面部件'],
    summary: '已发布页面部件选项',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: { query: z.object({ siteId: z.coerce.number().int().positive() }) },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsWidgetDTO), '页面部件选项') },
  }),
  handler: async (c) => c.json(okBody(await listPublishedCmsWidgets(c.req.valid('query').siteId)), 200),
});

const renderersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/renderers',
    tags: ['CMS-页面部件'],
    summary: '当前站点主题支持的部件展示模板',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: {
      query: z.object({
        siteId: z.coerce.number().int().positive(),
        type: z.enum(CMS_WIDGET_TYPES).default('manual-list'),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsWidgetRendererOptionDTO), '展示模板') },
  }),
  handler: async (c) => {
    const { siteId, type } = c.req.valid('query');
    return c.json(okBody(await listCmsWidgetRenderersForSite(siteId, type)), 200);
  },
});

const slotsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/slots',
    tags: ['CMS-页面部件'],
    summary: '当前站点主题部件插槽',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: { query: z.object({ siteId: z.coerce.number().int().positive() }) },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsWidgetSlotDTO), '主题部件插槽') },
  }),
  handler: async (c) => c.json(okBody(await listCmsWidgetSlots(c.req.valid('query').siteId)), 200),
});

const saveSlotRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/slots/{slotKey}',
    tags: ['CMS-页面部件'],
    summary: '绑定或清空主题部件插槽',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:update',
      audit: { description: '更新 CMS 主题页面部件插槽', module: 'CMS内容管理' },
    })] as const,
    request: {
      params: z.object({
        slotKey: z.literal('home.sidebar').openapi({
          param: { name: 'slotKey', in: 'path' },
          example: 'home.sidebar',
        }),
      }),
      body: { content: jsonContent(saveCmsWidgetSlotSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsWidgetSlotDTO), '主题部件插槽') },
  }),
  handler: async (c) => c.json(okBody(await saveCmsWidgetSlot(
    c.req.valid('param').slotKey,
    c.req.valid('json'),
  ), '主题插槽已更新'), 200),
});

const batchRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/batch',
    tags: ['CMS-页面部件'],
    summary: '提交页面部件批量发布/下线/删除任务',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:list',
      audit: { description: '提交 CMS 页面部件批量操作', module: 'CMS内容管理' },
    })] as const,
    request: { body: { content: jsonContent(batchCmsWidgetSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(AsyncTaskDTO, '批量任务') },
  }),
  handler: async (c) => c.json(okBody(
    await submitCmsWidgetBatchTask(c.req.valid('json')),
    '批量任务已提交',
  ), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['CMS-页面部件'],
    summary: '页面部件详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetDTO, '页面部件详情') },
  }),
  handler: async (c) => c.json(okBody(await getCmsWidget(c.req.valid('param').id)), 200),
});

const refsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}/refs',
    tags: ['CMS-页面部件'],
    summary: '查看页面部件引用位置',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(CmsWidgetRefDTO), '引用位置') },
  }),
  handler: async (c) => c.json(okBody(await listCmsWidgetRefs(c.req.valid('param').id)), 200),
});

const previewRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/{id}/preview',
    tags: ['CMS-页面部件'],
    summary: '按当前草稿生成页面部件 SSR 预览',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'cms:widget:list' })] as const,
    request: {
      params: IdParam,
      query: z.object({ rendererKey: z.enum(CMS_WIDGET_RENDERER_KEYS).optional() }),
    },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetPreviewDTO, '页面部件预览') },
  }),
  handler: async (c) => c.json(okBody(await getCmsWidgetPreview(
    c.req.valid('param').id,
    c.req.valid('query').rendererKey,
  )), 200),
});

const createRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/',
    tags: ['CMS-页面部件'],
    summary: '创建页面部件草稿',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:create',
      audit: { description: '创建 CMS 页面部件', module: 'CMS内容管理' },
    })] as const,
    request: { body: { content: jsonContent(createCmsWidgetSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createCmsWidget(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'put',
    path: '/{id}',
    tags: ['CMS-页面部件'],
    summary: '保存页面部件草稿',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:update',
      audit: { description: '更新 CMS 页面部件草稿', module: 'CMS内容管理' },
    })] as const,
    request: {
      params: IdParam,
      body: { content: jsonContent(updateCmsWidgetSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetDTO, '保存成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getCmsWidget(id));
    return c.json(okBody(await updateCmsWidget(id, c.req.valid('json')), '保存成功'), 200);
  },
});

const publishRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/{id}/publish',
    tags: ['CMS-页面部件'],
    summary: '发布页面部件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:publish',
      audit: { description: '发布 CMS 页面部件', module: 'CMS内容管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetDTO, '发布成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getCmsWidget(id));
    return c.json(okBody(await publishCmsWidget(id), '发布成功，引用刷新任务已提交'), 200);
  },
});

const offlineRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/{id}/offline',
    tags: ['CMS-页面部件'],
    summary: '下线页面部件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:offline',
      audit: { description: '下线 CMS 页面部件', module: 'CMS内容管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(CmsWidgetDTO, '下线成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getCmsWidget(id));
    return c.json(okBody(await offlineCmsWidget(id), '下线成功，引用刷新任务已提交'), 200);
  },
});

const deleteRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['CMS-页面部件'],
    summary: '删除未被引用的页面部件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'cms:widget:delete',
      audit: { description: '删除 CMS 页面部件', module: 'CMS内容管理' },
    })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getCmsWidget(id));
    await deleteCmsWidget(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

router.openapiRoutes([
  listRoute,
  optionsRoute,
  renderersRoute,
  slotsRoute,
  saveSlotRoute,
  batchRoute,
  refsRoute,
  previewRoute,
  publishRoute,
  offlineRoute,
  detailRoute,
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
] as const);

export default router;
