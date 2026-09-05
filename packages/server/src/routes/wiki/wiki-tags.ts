import { OpenAPIHono } from '@hono/zod-openapi';
import { wikiTagContract } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  createWikiTag, deleteWikiTag, ensureWikiTagExists, listAllWikiTags, listWikiTags,
  mapWikiTag, updateWikiTag,
} from '../../services/wiki/tags.service';

const tagsRouter = new OpenAPIHono({ defaultHook: validationHook });

const listRoute = defineContractRoute(wikiTagContract.list, {
  middleware: [authMiddleware, guard({ permission: 'wiki:tag:list' })],
  handler: async (c) => c.json(okBody(await listWikiTags(c.req.valid('query'))), 200),
});

const allRoute = defineContractRoute(wikiTagContract.all, {
  middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })],
  handler: async (c) => c.json(okBody(await listAllWikiTags()), 200),
});

const createRouteDef = defineContractRoute(wikiTagContract.create, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:tag:create',
    audit: { description: '创建标签', module: '知识中心' },
  })],
  handler: async (c) => c.json(okBody(await createWikiTag(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(wikiTagContract.update, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:tag:edit',
    audit: { description: '更新标签', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTag(await ensureWikiTagExists(id)));
    return c.json(okBody(await updateWikiTag(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(wikiTagContract.remove, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:tag:delete',
    audit: { description: '删除标签', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTag(await ensureWikiTagExists(id)));
    await deleteWikiTag(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

tagsRouter.openapiRoutes([
  listRoute,
  allRoute,
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
] as const);

export default tagsRouter;
