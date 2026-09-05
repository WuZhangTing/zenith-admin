import { OpenAPIHono } from '@hono/zod-openapi';
import { positionContract } from '@zenith/shared/identity';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import { defineScopeMembersRoute } from './_scope-members';
import {
  listAllPositions,
  listPositions,
  createPosition,
  updatePosition,
  deletePosition,
  batchDeletePositions,
  getPositionsBeforeAudit,
  getPositionBeforeAudit,
  getPosition,
  listPositionMembers,
  setPositionMembers,
  getPositionMembersBeforeAudit,
} from '../../services/identity/positions.service';

const positionsRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'system:position:list' })] as const;

const allRoute = defineContractRoute(positionContract.all, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listAllPositions()), 200),
});

const listRoute = defineContractRoute(positionContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listPositions(c.req.valid('query'))), 200),
});

const getOneRoute = defineContractRoute(positionContract.detail, {
  middleware: read,
  handler: async (c) => c.json(okBody(await getPosition(c.req.valid('param').id)), 200),
});

const createPositionRoute = defineContractRoute(positionContract.create, {
  middleware: [authMiddleware, guard({ permission: 'system:position:create', audit: { description: '创建岗位', module: '岗位管理' } })] as const,
  handler: async (c) => c.json(okBody(await createPosition(c.req.valid('json')), '创建成功'), 200),
});

const updatePositionRoute = defineContractRoute(positionContract.update, {
  middleware: [authMiddleware, guard({ permission: 'system:position:update', audit: { description: '更新岗位', module: '岗位管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getPositionBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    const updated = await updatePosition(id, c.req.valid('json'));
    setAuditAfterData(c, updated);
    return c.json(okBody(updated, '更新成功'), 200);
  },
});

const batchDeleteRoute = defineContractRoute(positionContract.removeBatch, {
  middleware: [authMiddleware, guard({ permission: 'system:position:delete', audit: { description: '批量删除岗位', module: '岗位管理' } })] as const,
  handler: async (c) => {
    const { ids } = c.req.valid('json');
    const before = await getPositionsBeforeAudit(ids);
    if (before.length > 0) setAuditBeforeData(c, before);
    const { count } = await batchDeletePositions(ids);
    return c.json(okBody(null, `已删除 ${count} 个岗位`), 200);
  },
});

const deleteRoute = defineContractRoute(positionContract.remove, {
  middleware: [authMiddleware, guard({ permission: 'system:position:delete', audit: { description: '删除岗位', module: '岗位管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await getPositionBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await deletePosition(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const listMembersRoute = defineContractRoute(positionContract.members, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listPositionMembers(c.req.valid('param').id)), 200),
});

const memberPreviewRoute = defineScopeMembersRoute({
  op: positionContract.memberPreview,
  scopeType: 'position',
  permission: 'system:position:list',
});

const setMembersRoute = defineContractRoute(positionContract.setMembers, {
  middleware: [authMiddleware, guard({ permission: 'system:position:update', audit: { description: '设置岗位成员', module: '岗位管理' } })] as const,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { userIds } = c.req.valid('json');
    const before = await getPositionMembersBeforeAudit(id);
    if (before) setAuditBeforeData(c, before);
    await setPositionMembers(id, userIds);
    const after = await getPositionMembersBeforeAudit(id);
    if (after) setAuditAfterData(c, after);
    return c.json(okBody(null, '保存成功'), 200);
  },
});

// DELETE /batch 必须先于 DELETE /{id} 注册，否则 "batch" 会被当成 id
positionsRouter.openapiRoutes([allRoute, listRoute, getOneRoute, createPositionRoute, updatePositionRoute, batchDeleteRoute, deleteRoute, listMembersRoute, memberPreviewRoute, setMembersRoute] as const);

export default positionsRouter;
