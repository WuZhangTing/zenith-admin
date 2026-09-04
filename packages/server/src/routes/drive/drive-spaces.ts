import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  DRIVE_SPACE_TYPES,
  createDriveSpaceSchema,
  saveDriveSpaceMembersSchema,
  transferDriveSpaceSchema,
  updateDriveSpaceSchema,
} from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { IdParam, PaginationQuery, commonErrorResponses, jsonContent, ok, okBody, okMsg, okPaginated, validationHook, ErrorResponse } from '../../lib/openapi-schemas';
import { DriveSpaceDTO, DriveSpaceMemberDTO } from '../../lib/openapi-dtos';
import {
  createTeamSpace,
  deleteDriveSpace,
  ensureDriveSpaceExists,
  getDriveSpace,
  getSpaceMembersBeforeAudit,
  listDriveSpaces,
  listMySpaces,
  listSpaceMembers,
  saveSpaceMembers,
  transferDriveSpace,
  updateDriveSpace,
} from '../../services/drive/drive-spaces.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-空间';

const mySpacesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/my', tags: [TAG], summary: '我可访问的空间（个人 / 部门 / 协作）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    responses: { ...commonErrorResponses, ...ok(z.array(DriveSpaceDTO), '空间列表') },
  }),
  handler: async (c) => c.json(okBody(await listMySpaces()), 200),
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: [TAG], summary: '共享空间分页（当前用户可访问的部门 / 协作空间）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        type: z.enum(DRIVE_SPACE_TYPES).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveSpaceDTO, '空间列表') },
  }),
  handler: async (c) => c.json(okBody(await listDriveSpaces(c.req.valid('query'))), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: [TAG], summary: '空间详情（含 myRole 与用量）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '空间详情'), 404: { content: jsonContent(ErrorResponse), description: '不存在' } },
  }),
  handler: async (c) => c.json(okBody(await getDriveSpace(c.req.valid('param').id)), 200),
});

const createRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: [TAG], summary: '创建协作空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:create', audit: { description: '创建协作空间', module: '企业网盘' } })] as const,
    request: { body: { content: jsonContent(createDriveSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createTeamSpace(c.req.valid('json')), '创建成功'), 200),
});

const updateRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: [TAG], summary: '更新空间（需空间 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:edit', audit: { description: '更新网盘空间', module: '企业网盘' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateDriveSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDriveSpaceExists(id));
    return c.json(okBody(await updateDriveSpace(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRoute_ = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: [TAG], summary: '删除空空间（需空间 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:delete', audit: { description: '删除网盘空间', module: '企业网盘' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDriveSpaceExists(id));
    await deleteDriveSpace(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const membersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/members', tags: [TAG], summary: '空间成员',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(DriveSpaceMemberDTO), '成员列表') },
  }),
  handler: async (c) => c.json(okBody(await listSpaceMembers(c.req.valid('param').id)), 200),
});

const saveMembersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/members', tags: [TAG], summary: '全量保存空间成员（需空间 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:grant', audit: { description: '保存网盘空间成员', module: '企业网盘' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(saveDriveSpaceMembersSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('保存成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getSpaceMembersBeforeAudit(id));
    await saveSpaceMembers(id, c.req.valid('json'));
    setAuditAfterData(c, await getSpaceMembersBeforeAudit(id));
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const transferRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/transfer', tags: [TAG], summary: '转让协作空间',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:space:edit', audit: { description: '转让网盘空间', module: '企业网盘' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(transferDriveSpaceSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveSpaceDTO, '转让成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await ensureDriveSpaceExists(id));
    return c.json(okBody(await transferDriveSpace(id, c.req.valid('json').ownerId), '转让成功'), 200);
  },
});

router.openapiRoutes([mySpacesRoute, listRoute, createRoute_, getOneRoute, updateRoute_, deleteRoute_, membersRoute, saveMembersRoute, transferRoute] as const);

export default router;
