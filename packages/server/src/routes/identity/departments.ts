import { OpenAPIHono } from '@hono/zod-openapi';
import { departmentContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { defineScopeMembersRoute } from './_scope-members';
import {
  listDepartmentTree,
  listDepartmentsFlat,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentBeforeAudit,
  getDepartment,
} from '../../services/identity/departments.service';

const memberPreviewRoute = defineScopeMembersRoute({
  op: departmentContract.memberPreview,
  scopeType: 'department',
  permission: 'system:department:list',
});

const departmentsRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:department:list' })] as const;

const listRoute = defineContractRoute(departmentContract.tree, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listDepartmentTree(c.req.valid('query'))), 200),
});

const flatRoute = defineContractRoute(departmentContract.flat, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listDepartmentsFlat()), 200),
});

const getOneRoute = defineContractRoute(departmentContract.detail, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getDepartment(c.req.valid('param').id)), 200),
});

const createRouteDef = defineContractRoute(departmentContract.create, {
  middleware: [authMiddleware, guard({ permission: 'system:department:create', audit: { description: '创建部门', module: '部门管理' } })] as const,
  handler: async (c) => c.json(okBody(await createDepartment(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(departmentContract.update, {
  middleware: [authMiddleware, guard({ permission: 'system:department:update', audit: { description: '更新部门', module: '部门管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getDepartmentBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    return c.json(okBody(await updateDepartment(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(departmentContract.remove, {
  middleware: [authMiddleware, guard({ permission: 'system:department:delete', audit: { description: '删除部门', module: '部门管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getDepartmentBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deleteDepartment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

departmentsRouter.openapiRoutes([listRoute, flatRoute, getOneRoute, createRouteDef, updateRouteDef, deleteRouteDef, memberPreviewRoute] as const);

export default departmentsRouter;
