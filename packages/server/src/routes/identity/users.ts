import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { BatchIdsBody, ErrorResponse, IdParam, PaginationQuery, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { AlertRecipientUserDTO, UserDTO, UserMenuPermissionsDTO, UserDataPermissionDTO, UserEffectivePermissionsDTO } from '../../lib/openapi-dtos';
import {
  listAlertRecipientUsers, listAllUsers, listUsers, createUser, batchDeleteUsers, batchUpdateUserStatus, batchResetUsersPassword,
  updateUser, deleteUser, updateUserPassword, unlockUserById,
  getUserBeforeAudit, getUsersBeforeAudit,
  getUser,
  getUserMenuPermissions, assignUserMenus,
  getUserDataPermission, updateUserDataPermission, getUserEffectivePermissions,
  assignRolesToUser,
  getUserRoleAssignmentAudit,
  getUserMenuPermissionsBeforeAudit,
  getUserDataPermissionBeforeAudit,
} from '../../services/identity/users.service';

const usersRouter = new OpenAPIHono({ defaultHook: validationHook });

const createUserSchema = z.object({
  username: z.string().min(2).max(32),
  nickname: z.string().min(1).max(32),
  email: z.preprocess((v) => (v === '' ? null : v), z.email('邮箱格式不正确').nullable().optional()),
  password: z.string().min(6).max(64),
  phone: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^1[3-9]\d{9}$/).optional()),
  gender: z.string().max(20).nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  positionIds: z.array(z.number().int().positive()).default([]),
  roleIds: z.array(z.number().int()).default([]),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
});
const updateUserSchema = z.object({
  username: z.string().min(2).max(32).optional(),
  nickname: z.string().min(1).max(32).optional(),
  email: z.preprocess((v) => (v === '' ? null : v), z.email('邮箱格式不正确').nullable().optional()),
  phone: z.preprocess((v) => (v === '' ? undefined : v), z.string().regex(/^1[3-9]\d{9}$/).optional()),
  gender: z.string().max(20).nullable().optional(),
  departmentId: z.number().int().positive().nullable().optional(),
  positionIds: z.array(z.number().int().positive()).optional(),
  roleIds: z.array(z.number().int()).optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
  avatar: z.string().max(512).nullable().optional(),
});
const resetUserPasswordSchema = z.object({ password: z.string().min(6).max(64) });
const batchStatusSchema = z.object({ ids: z.array(z.number().int()), status: z.enum(['enabled', 'disabled']) });

const getAllUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/all', tags: ['Users'], summary: '全量用户（供下拉框）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:list' })] as const,
    request: {},
    responses: { ...commonErrorResponses, ...ok(z.array(UserDTO), '全量用户') },
  }),
  handler: async (c) => c.json(okBody(await listAllUsers()), 200),
});

const getAlertRecipientUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/alert-recipients', tags: ['Users'], summary: '告警接收用户下拉项',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: ['alert:rule:create', 'alert:rule:update'] })] as const,
    request: {},
    responses: { ...commonErrorResponses, ...ok(z.array(AlertRecipientUserDTO), '告警接收用户') },
  }),
  handler: async (c) => c.json(okBody(await listAlertRecipientUsers()), 200),
});

const listUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['Users'], summary: '用户列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(), phone: z.string().optional(),
        departmentId: z.coerce.number().optional(), status: z.enum(['enabled', 'disabled']).optional(),
        startTime: dateRangeBound('起始时间'), endTime: dateRangeBound('结束时间'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(UserDTO, 'ok') },
  }),
  handler: async (c) => c.json(okBody(await listUsers(c.req.valid('query'))), 200),
});

const createUserRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['Users'], summary: '创建用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:create', audit: { description: '创建用户', module: '用户管理' } })] as const,
    request: { body: { content: jsonContent(createUserSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(UserDTO, '创建成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => c.json(okBody(await createUser(c.req.valid('json')), '创建成功'), 200),
});

const batchDeleteUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch', tags: ['Users'], summary: '批量删除用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:delete', audit: { description: '批量删除用户', module: '用户管理' } })] as const,
    request: { body: { content: jsonContent(BatchIdsBody), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    const before = await getUsersBeforeAudit(ids);
    if (before.length > 0) setAuditBeforeData(c, before);
    const count = await batchDeleteUsers(ids);
    return c.json(okBody(null, `已删除 ${count} 个用户`), 200);
  },
});

const batchResetPasswordRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/batch-password', tags: ['Users'], summary: '批量重置用户密码',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:update', audit: { description: '批量重置用户密码', module: '用户管理' } })] as const,
    request: { body: { content: jsonContent(z.object({ ids: z.array(z.number().int()), password: z.string().min(6).max(64) })), required: true } },
    responses: { ...okMsg('密码重置成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { ids, password } = c.req.valid('json');
    await batchResetUsersPassword(ids, password);
    return c.json(okBody(null, '密码重置成功'), 200);
  },
});

const batchStatusUsersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/batch-status', tags: ['Users'], summary: '批量修改用户状态',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:update', audit: { description: '批量修改用户状态', module: '用户管理' } })] as const,
    request: { body: { content: jsonContent(batchStatusSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
    },
  }),
  handler: async (c) => {
    const { ids, status } = c.req.valid('json');
    const before = await getUsersBeforeAudit(ids);
    if (before.length > 0) setAuditBeforeData(c, before);
    await batchUpdateUserStatus(ids, status);
    return c.json(okBody(null, '状态已更新'), 200);
  },
});

const updateUserPasswordRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/password', tags: ['Users'], summary: '修改用户密码',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:update', audit: { description: '修改用户密码', module: '用户管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(resetUserPasswordSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('ok'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { password } = c.req.valid('json');
    const before = await getUserBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await updateUserPassword(id, password);
    return c.json(okBody(null, '密码修改成功'), 200);
  },
});

const unlockUserRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/unlock', tags: ['Users'], summary: '解锁账号',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:update', audit: { description: '解除账号锁定', module: '用户管理' } })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('ok'),
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getUserBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await unlockUserById(id);
    return c.json(okBody(null, '解锁成功'), 200);
  },
});

const getOneUserRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['Users'], summary: '获取用户详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:list' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(UserDTO, '用户详情'),
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => c.json(okBody(await getUser(c.req.valid('param').id)), 200),
});

const updateUserRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}', tags: ['Users'], summary: '更新用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:update', audit: { description: '更新用户', module: '用户管理' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updateUserSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...ok(UserDTO, '更新成功'),
      400: { content: jsonContent(ErrorResponse), description: '参数错误' },
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getUserBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    const updated = await updateUser(id, c.req.valid('json'));
    return c.json(okBody(updated, '更新成功'), 200);
  },
});

const deleteUserRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}', tags: ['Users'], summary: '删除用户',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:delete', audit: { description: '删除用户', module: '用户管理' } })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...okMsg('删除成功'),
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getUserBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteUser(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const assignUserRolesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/roles', tags: ['Users'], summary: '分配用户角色',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign', audit: { description: '分配用户角色', module: '用户管理' } })] as const,
    request: {
      params: IdParam,
      body: {
        content: { 'application/json': { schema: z.object({ roleIds: z.array(z.number().int()) }) } },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...okMsg('保存成功'),
      404: { content: jsonContent(ErrorResponse), description: '用户不存在' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { roleIds } = c.req.valid('json');
    const before = await getUserRoleAssignmentAudit(id);
    if (before) setAuditBeforeData(c, before);
    await assignRolesToUser(id, roleIds);
    const after = await getUserRoleAssignmentAudit(id);
    if (after) setAuditAfterData(c, after);
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const getUserMenusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/menus', tags: ['Users'], summary: '获取用户菜单权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(UserMenuPermissionsDTO, '获取成功'),
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = await getUserMenuPermissions(id);
    return c.json(okBody(data), 200);
  },
});

const assignUserMenusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/menus', tags: ['Users'], summary: '分配用户菜单权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign', audit: { description: '分配用户菜单权限', module: '用户管理' } })] as const,
    request: {
      params: IdParam,
      body: { content: { 'application/json': { schema: z.object({ menuIds: z.array(z.number().int()) }) } }, required: true },
    },
    responses: {
      ...commonErrorResponses,
      ...okMsg('保存成功'),
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { menuIds } = c.req.valid('json');
    const before = await getUserMenuPermissionsBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await assignUserMenus(id, menuIds);
    const after = await getUserMenuPermissionsBeforeAudit(id);
    if (after) setAuditAfterData(c, after);
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const getUserDataPermissionRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/data-permission', tags: ['Users'], summary: '获取用户数据权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(UserDataPermissionDTO, '获取成功'),
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = await getUserDataPermission(id);
    return c.json(okBody(data), 200);
  },
});

const updateUserDataPermissionRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/data-permission', tags: ['Users'], summary: '设置用户数据权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign', audit: { description: '设置用户数据权限', module: '用户管理' } })] as const,
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              dataScope: z.enum(['all', 'custom', 'dept_only', 'dept', 'self']).nullable(),
              deptScopeIds: z.array(z.number().int()),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...okMsg('保存成功'),
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const before = await getUserDataPermissionBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await updateUserDataPermission(id, data);
    const after = await getUserDataPermissionBeforeAudit(id);
    if (after) setAuditAfterData(c, after);
    return c.json(okBody(null, '保存成功'), 200);
  },
});

const getUserEffectivePermissionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/effective-permissions', tags: ['Users'], summary: '获取用户最终有效权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'system:user:assign' })] as const,
    request: { params: IdParam },
    responses: {
      ...commonErrorResponses,
      ...ok(UserEffectivePermissionsDTO, '获取成功'),
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = await getUserEffectivePermissions(id);
    return c.json(okBody(data), 200);
  },
});

usersRouter.openapiRoutes([
  getAlertRecipientUsersRoute, getAllUsersRoute, listUsersRoute, createUserRoute, batchDeleteUsersRoute, batchStatusUsersRoute, batchResetPasswordRoute,
  updateUserPasswordRoute, unlockUserRoute,
  getOneUserRoute, updateUserRoute, deleteUserRoute,
  getUserMenusRoute, assignUserMenusRoute,
  assignUserRolesRoute,
  getUserDataPermissionRoute, updateUserDataPermissionRoute, getUserEffectivePermissionsRoute,
] as const);

export default usersRouter;
