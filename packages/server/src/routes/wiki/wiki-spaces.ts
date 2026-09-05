import { OpenAPIHono } from '@hono/zod-openapi';
import { wikiSpaceContract } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData, setAuditAfterData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  createWikiSpace, deleteWikiSpace, ensureWikiSpaceExists, getWikiSpace,
  getWikiSpaceMembersBeforeAudit, listMyWikiSpaces, listWikiSpaceMembers, listWikiSpaces,
  mapWikiSpace, saveWikiSpaceMembers, updateWikiSpace,
} from '../../services/wiki/spaces.service';

const spacesRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'wiki:space:list' })] as const;

const listRoute = defineContractRoute(wikiSpaceContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listWikiSpaces(c.req.valid('query'))), 200),
});

const myRoute = defineContractRoute(wikiSpaceContract.my, {
  middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })],
  handler: async (c) => c.json(okBody(await listMyWikiSpaces()), 200),
});

const getOneRoute = defineContractRoute(wikiSpaceContract.detail, {
  middleware: read,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getWikiSpace(id)), 200);
  },
});

const createRouteDef = defineContractRoute(wikiSpaceContract.create, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:space:create',
    audit: { description: '创建知识空间', module: '知识中心' },
  })],
  handler: async (c) => c.json(okBody(await createWikiSpace(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(wikiSpaceContract.update, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:space:edit',
    audit: { description: '更新知识空间', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiSpace(await ensureWikiSpaceExists(id)));
    return c.json(okBody(await updateWikiSpace(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(wikiSpaceContract.remove, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:space:delete',
    audit: { description: '删除知识空间', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiSpace(await ensureWikiSpaceExists(id)));
    await deleteWikiSpace(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const listMembersRoute = defineContractRoute(wikiSpaceContract.listMembers, {
  middleware: read,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listWikiSpaceMembers(id)), 200);
  },
});

const saveMembersRoute = defineContractRoute(wikiSpaceContract.saveMembers, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:space:grant',
    audit: { description: '分配空间成员', module: '知识中心' },
  })],
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
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
  listMembersRoute,
  saveMembersRoute,
] as const);

export default spacesRouter;
