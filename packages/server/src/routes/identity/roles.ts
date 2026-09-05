import { OpenAPIHono } from '@hono/zod-openapi';
import { roleContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, conflictResponse, okBody } from '../../lib/openapi-schemas';
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
  op: roleContract.memberPreview,
  scopeType: 'role',
  permission: 'system:role:list',
});

const rolesRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:role:list' })] as const;

const allRoute = defineContractRoute(roleContract.all, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listAllRoles()), 200),
});

const listRouteDef = defineContractRoute(roleContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listRoles(c.req.valid('query'))), 200),
});

const getOneRoute = defineContractRoute(roleContract.detail, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getRole(c.req.valid('param').id)), 200),
});

const createRoleRoute = defineContractRoute(roleContract.create, {
  middleware: [authMiddleware, guard({ permission: 'system:role:create', audit: { description: '创建角色', module: '角色管理' } })] as const,
  handler: async (c) => c.json(okBody(await createRole(c.req.valid('json')), '创建成功'), 200),
});

const updateRoleRoute = defineContractRoute(roleContract.update, {
  middleware: [authMiddleware, guard({ permission: 'system:role:update', audit: { description: '更新角色', module: '角色管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateRole(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(roleContract.remove, {
  middleware: [authMiddleware, guard({ permission: 'system:role:delete', audit: { description: '删除角色', module: '角色管理' } })] as const,
  responses: conflictResponse,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteRole(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const assignMenusRoute = defineContractRoute(roleContract.assignMenus, {
  middleware: [authMiddleware, guard({ permission: 'system:role:assign', audit: { description: '分配角色菜单', module: '角色管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const before = await getRoleBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await assignRoleMenus(id, data.menuIds);
    return c.json(okBody(null, '菜单权限已更新'), 200);
  },
});

const getUsersRoute = defineContractRoute(roleContract.users, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getRoleUsers(c.req.valid('param').id)), 200),
});

const assignUsersRoute = defineContractRoute(roleContract.assignUsers, {
  middleware: [authMiddleware, guard({ permission: 'system:role:assign', audit: { description: '分配角色用户', module: '角色管理' } })] as const,
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
