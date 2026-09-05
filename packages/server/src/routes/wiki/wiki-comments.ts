import { OpenAPIHono } from '@hono/zod-openapi';
import { wikiCommentContract } from '@zenith/shared/wiki';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { defineContractRoute } from '../../lib/contract-route';
import { validationHook, okBody } from '../../lib/openapi-schemas';
import {
  createWikiComment, deleteMyWikiComment, ensureWikiCommentExists, listWikiComments,
  listWikiDocComments, mapWikiComment, removeWikiComment, resolveWikiComment, updateWikiCommentStatus,
} from '../../services/wiki/comments.service';

const commentsRouter = new OpenAPIHono({ defaultHook: validationHook });

const reader = [authMiddleware, guard({ permission: 'wiki:doc:list' })] as const;

// ─── 用户端 ───────────────────────────────────────────────────────────────────

const docCommentsRoute = defineContractRoute(wikiCommentContract.docComments, {
  middleware: reader,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await listWikiDocComments(id)), 200);
  },
});

const createRouteDef = defineContractRoute(wikiCommentContract.create, {
  middleware: reader,
  handler: async (c) => c.json(okBody(await createWikiComment(c.req.valid('json')), '评论成功'), 200),
});

const resolveRoute = defineContractRoute(wikiCommentContract.resolve, {
  middleware: reader,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await resolveWikiComment(id), '已标记解决'), 200);
  },
});

const deleteMineRoute = defineContractRoute(wikiCommentContract.deleteMine, {
  middleware: reader,
  handler: async (c) => {
    const { id } = c.req.valid('param');
    await deleteMyWikiComment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 管理端 ───────────────────────────────────────────────────────────────────

const listRoute = defineContractRoute(wikiCommentContract.list, {
  middleware: [authMiddleware, guard({ permission: 'wiki:comment:list' })],
  handler: async (c) => c.json(okBody(await listWikiComments(c.req.valid('query'))), 200),
});

const statusRoute = defineContractRoute(wikiCommentContract.updateStatus, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:comment:audit',
    audit: { description: '审核评论', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { status } = c.req.valid('json');
    setAuditBeforeData(c, mapWikiComment(await ensureWikiCommentExists(id)));
    return c.json(okBody(await updateWikiCommentStatus(id, status), '操作成功'), 200);
  },
});

const deleteRouteDef = defineContractRoute(wikiCommentContract.remove, {
  middleware: [authMiddleware, guard({
    permission: 'wiki:comment:delete',
    audit: { description: '删除评论', module: '知识中心' },
  })],
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, mapWikiComment(await ensureWikiCommentExists(id)));
    await removeWikiComment(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

commentsRouter.openapiRoutes([
  docCommentsRoute,
  deleteMineRoute,
  listRoute,
  createRouteDef,
  resolveRoute,
  statusRoute,
  deleteRouteDef,
] as const);

export default commentsRouter;
