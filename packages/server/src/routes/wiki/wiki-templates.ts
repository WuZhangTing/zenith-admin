import { OpenAPIHono } from '@hono/zod-openapi';
import { wikiTemplateContract } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  createWikiTemplate, deleteWikiTemplate, ensureWikiTemplateExists, getWikiTemplate,
  listAllWikiTemplates, listWikiTemplates, mapWikiTemplate, updateWikiTemplate,
} from '../../services/wiki/templates.service';

const templatesRouter = new OpenAPIHono({ defaultHook: validationHook });

const read = [authMiddleware, guard({ permission: 'wiki:template:list' })] as const;

const listRoute = defineContractRoute(wikiTemplateContract.list, {
  middleware: read,
  handler: async (c) => c.json(okBody(await listWikiTemplates(c.req.valid('query'))), 200),
});

const allRoute = defineContractRoute(wikiTemplateContract.all, {
  middleware: [authMiddleware, guard({ permission: 'wiki:doc:list' })],
  handler: async (c) => c.json(okBody(await listAllWikiTemplates()), 200),
});

const getOneRoute = defineContractRoute(wikiTemplateContract.detail, {
  middleware: read,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await getWikiTemplate(id)), 200);
  },
});

const createRouteDef = defineContractRoute(wikiTemplateContract.create, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:template:create',
    audit: { description: '创建文档模板', module: '知识中心' },
  })],
  handler: async (c) => c.json(okBody(await createWikiTemplate(c.req.valid('json')), '创建成功'), 200),
});

const updateRouteDef = defineContractRoute(wikiTemplateContract.update, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:template:edit',
    audit: { description: '更新文档模板', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTemplate(await ensureWikiTemplateExists(id)));
    return c.json(okBody(await updateWikiTemplate(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(wikiTemplateContract.remove, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:template:delete',
    audit: { description: '删除文档模板', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiTemplate(await ensureWikiTemplateExists(id)));
    await deleteWikiTemplate(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

templatesRouter.openapiRoutes([
  listRoute,
  allRoute,
  getOneRoute,
  createRouteDef,
  updateRouteDef,
  deleteRouteDef,
] as const);

export default templatesRouter;
