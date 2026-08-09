import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { createRoleSchema, updateRoleSchema, assignRoleMenusSchema, assignRoleUsersSchema } from '@zenith/shared/identity';
import { IdParam, PaginationQuery, commonErrorResponses, conflictResponse, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { RoleDTO, UserDTO } from '../../lib/openapi-dtos';
import { defineScopeMembersRoute } from './_scope-members';
import {
  listAllRoles,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignRoleMenus,
  getRoleUsers,
  assignRoleUsers,
  getRoleBeforeAudit,
} from '../../services/identity/roles.service';

const memberPreviewRoute = defineScopeMembersRoute({
  scopeType: 'role',
  tag: 'Roles',
  permission: 'system:role:list',
  summary: '角色成员分页预览',
});

const rolesRouter = new OpenAPIHono({ defaultHook: validationHook });

const allRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all', tags: ['Roles'], summary: '全量角色（供下拉框）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:list' })] as const,
    request: {},
    responses: { ...commonErrorResponses, ...ok(z.array(RoleDTO), '全量角色') },
  }),
  handler: async (c) => c.json(okBody(await listAllRoles()), 200),
});

const listRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['Roles'], summary: '角色列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
        startTime: dateRangeBound('起始时间'),
        endTime: dateRangeBound('结束时间'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(RoleDTO, '角色列表') },
  }),
  handler: async (c) => c.json(okBody(await listRoles(c.req.valid('query'))), 200),
});

const getOneRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['Roles'], summary: '获取单个角色（含 menuIds）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(RoleDTO, '角色详情') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getRole(id)), 200);
  },
});

const createRoleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['Roles'], summary: '新增角色',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:create', audit: { description: '创建角色', module: '角色管理' } })] as const,
    request: { body: { content: jsonContent(createRoleSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RoleDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createRole(c.req.valid('json')), '创建成功'), 200),
});

const updateRoleRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['Roles'], summary: '更新角色',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:update', audit: { description: '更新角色', module: '角色管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateRoleSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(RoleDTO, '更新成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateRole(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['Roles'], summary: '删除角色',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:delete', audit: { description: '删除角色', module: '角色管理' } })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...conflictResponse, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteRole(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const assignMenusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/menus', tags: ['Roles'], summary: '分配角色菜单',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:assign', audit: { description: '分配角色菜单', module: '角色管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(assignRoleMenusSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('菜单权限已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await assignRoleMenus(id, data.menuIds);
    return c.json(okBody(null, '菜单权限已更新'), 200);
  },
});

const getUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/users', tags: ['Roles'], summary: '获取角色关联用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:list' })] as const,
    request: { params: IdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(UserDTO), '用户列表') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getRoleUsers(id)), 200);
  },
});

const assignUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/users', tags: ['Roles'], summary: '分配角色用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:role:assign', audit: { description: '分配角色用户', module: '角色管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(assignRoleUsersSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('用户分配已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await assignRoleUsers(id, data.userIds);
    return c.json(okBody(null, '用户分配已更新'), 200);
  },
});

rolesRouter.openapiRoutes([allRoute, listRouteDef, getOneRoute, createRoleRoute, updateRoleRoute, deleteRouteDef, assignMenusRoute, getUsersRoute, assignUsersRoute, memberPreviewRoute] as const);

export default rolesRouter;
