import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { WIKI_SPACE_VISIBILITIES, createWikiSpaceSchema, saveWikiSpaceMembersSchema, updateWikiSpaceSchema } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData, setAuditAfterData } from '../../middleware/guard';
import {
  ErrorResponse, jsonContent, PaginationQuery, validationHook, commonErrorResponses,
  ok, okPaginated, okMsg, IdParam, okBody,
} from '../../lib/openapi-schemas';
import { WikiSpaceDTO, WikiSpaceMemberDTO } from '../../lib/openapi-dtos';
import {
  createWikiSpace, deleteWikiSpace, ensureWikiSpaceExists, getWikiSpace,
  getWikiSpaceMembersBeforeAudit, listMyWikiSpaces, listWikiSpaceMembers, listWikiSpaces,
  mapWikiSpace, saveWikiSpaceMembers, updateWikiSpace,
} from '../../services/wiki/spaces.service';

const spacesRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/',
    tags: ['知识中心-空间'], summary: '知识空间列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:space:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        visibility: z.enum(WIKI_SPACE_VISIBILITIES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(WikiSpaceDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listWikiSpaces(c.req.valid('query'))), 200),
});

const myRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/my',
    tags: ['知识中心-空间'], summary: '我可访问的空间（文档中心侧栏）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(WikiSpaceDTO), '我可访问的空间') },
  }),
  handler: async (c) => c.json(okBody(await listMyWikiSpaces()), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}',
    tags: ['知识中心-空间'], summary: '空间详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:space:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiSpaceDTO, '空间详情'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getWikiSpace(id)), 200);
  },
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/',
    tags: ['知识中心-空间'], summary: '创建空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:space:create',
      audit: { description: '创建知识空间', module: '知识中心' },
    })] as const,
    request: { body: { content: jsonContent(createWikiSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(WikiSpaceDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createWikiSpace(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}',
    tags: ['知识中心-空间'], summary: '更新空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:space:edit',
      audit: { description: '更新知识空间', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateWikiSpaceSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(WikiSpaceDTO, '更新成功'),
      404: { content: jsonContent(ErrorResponse), description: '不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiSpace(await ensureWikiSpaceExists(id)));
    return c.json(okBody(await updateWikiSpace(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}',
    tags: ['知识中心-空间'], summary: '删除空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:space:delete',
      audit: { description: '删除知识空间', module: '知识中心' },
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
    setAuditBeforeData(c, mapWikiSpace(await ensureWikiSpaceExists(id)));
    await deleteWikiSpace(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const listMembersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/members',
    tags: ['知识中心-空间'], summary: '空间成员列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'wiki:space:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(WikiSpaceMemberDTO), '成员列表') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listWikiSpaceMembers(id)), 200);
  },
});

const saveMembersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/members',
    tags: ['知识中心-空间'], summary: '保存空间成员（全量替换）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: 'wiki:space:grant',
      audit: { description: '分配空间成员', module: '知识中心' },
    })] as const,
    request: { params: IdParam, body: { content: jsonContent(saveWikiSpaceMembersSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('保存成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getWikiSpaceMembersBeforeAudit(id));
    await saveWikiSpaceMembers(id, c.req.valid('json'));
    setAuditAfterData(c, await getWikiSpaceMembersBeforeAudit(id));
    return c.json(okBody(null, '保存成功'), 200);
  },
});

spacesRouter.openapiRoutes([
  listRoute,
  myRoute,
  getOneRoute,
  createRoute_,
  updateRoute_,
  deleteRoute_,
  listMembersRoute,
  saveMembersRoute,
] as const);

export default spacesRouter;
