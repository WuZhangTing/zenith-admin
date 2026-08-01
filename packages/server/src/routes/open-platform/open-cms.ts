/**
 * CMS Headless 开放 API（`/api/open/v1/cms/*`）。
 *
 * 与其余业务路由采用同一套 `defineOpenAPIRoute` + Zod 约定，因此端点会进入 Swagger，
 * 客户端可直接由 openapi.json 生成 SDK —— 这是从原先「裸 Hono 内联端点」迁移过来的主因。
 *
 * 鉴权链：网关中间件（签名 → 计量 → 限流）已在 open-gateway 上挂载，
 * 本模块只负责 scope 校验、站点解析与业务编排。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { CMS_OPEN_INCLUDES, CMS_OPEN_PAGE_SIZE_MAX, CMS_OPEN_SORT_FIELDS, CMS_OPEN_SYNC_PAGE_SIZE_MAX } from '@zenith/shared/cms';
import { ErrorResponse, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okMsg, okPaginated, validationHook } from '../../lib/openapi-schemas';
import {
  CmsChannelDTO, CmsContentDTO, CmsOpenContentCursorPageDTO, CmsOpenContentDTO, CmsOpenSyncResultDTO,
} from '../../lib/openapi-dtos';
import { decodeCmsOpenCursor, OpenQueryError, parseCmsOpenIncludes, parseCmsOpenQuery } from '../../lib/open-query';
import { idempotencyGuard } from '../../middleware/idempotency';
import { listCmsChannelTree } from '../../services/cms/cms-channels.service';
import { resolveSiteByCode } from '../../services/cms/cms-sites.service';
import { getOpenCmsContent, listOpenCmsContents, listOpenCmsContentsByCursor, syncOpenCmsContents } from '../../services/cms/cms-open.service';
import {
  createOpenCmsContent, publishOpenCmsContent, recycleOpenCmsContent,
  submitOpenCmsContent, updateOpenCmsContent,
} from '../../services/cms/cms-open-write.service';
import type { CmsSiteRow } from '../../db/schema';

const router = new OpenAPIHono({ defaultHook: validationHook });

// ─── scope 与站点解析 ────────────────────────────────────────────────────────

/** 声明本次调用所需 scope（供计量记录），未授权直接 403 */
function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    c.set('openScope', scope);
    const app = c.get('openApp');
    if (!app?.allowedScopes?.includes(scope)) {
      throw new HTTPException(403, { message: `应用未授权 scope：${scope}` });
    }
    await next();
  };
}

function hasScope(c: Context, scope: string): boolean {
  return c.get('openApp')?.allowedScopes?.includes(scope) ?? false;
}

function clientIdOf(c: Context): string {
  const clientId = c.get('openApp')?.clientId;
  if (!clientId) throw new HTTPException(401, { message: 'AppKey 无效' });
  return clientId;
}

async function requireSite(siteCode: string): Promise<CmsSiteRow> {
  const site = await resolveSiteByCode(siteCode);
  if (!site) throw new HTTPException(404, { message: `站点标识「${siteCode}」不存在` });
  if (site.status !== 'enabled') throw new HTTPException(404, { message: '站点已停用' });
  return site;
}

/** DSL 解析失败按 400 返回，而不是 500 */
function parseQuery(raw: Record<string, string>) {
  try {
    return parseCmsOpenQuery(raw);
  } catch (err) {
    if (err instanceof OpenQueryError) throw new HTTPException(400, { message: err.message });
    throw err;
  }
}

function rawQuery(c: Context): Record<string, string> {
  return Object.fromEntries(new URL(c.req.url).searchParams.entries());
}

// ─── 公共 schema ─────────────────────────────────────────────────────────────

const SiteCodeQuery = z.object({
  siteCode: z.string().min(1).max(50).openapi({ example: 'main', description: '站点标识' }),
});

const ContentListQuery = SiteCodeQuery.extend({
  channel: z.string().max(500).optional().openapi({ example: 'news,notice', description: '栏目标识，逗号分隔多选（聚合主栏目与副栏目）' }),
  channelPath: z.string().max(255).optional().openapi({ example: 'news', description: '栏目路径前缀，含全部子栏目' }),
  tag: z.string().max(500).optional().openapi({ description: '标签 slug，逗号分隔多选' }),
  contentType: z.string().max(100).optional().openapi({ example: 'article,album' }),
  keyword: z.string().max(64).optional().openapi({ description: '全文检索（与站内搜索同一分词管线）' }),
  author: z.string().max(50).optional(),
  model: z.string().max(50).optional().openapi({ description: '内容模型标识' }),
  isTop: z.string().optional(), isRecommend: z.string().optional(),
  isHot: z.string().optional(), isOriginal: z.string().optional(),
  publishedFrom: dateRangeBound('发布时间起'),
  publishedTo: dateRangeBound('发布时间止'),
  sort: z.string().max(200).optional().openapi({ example: '-publishedAt', description: `可用字段：${CMS_OPEN_SORT_FIELDS.join(', ')}；前缀 - 为倒序` }),
  fields: z.string().max(500).optional().openapi({ description: '字段裁剪，逗号分隔；id 始终返回' }),
  include: z.string().max(200).optional().openapi({ description: `关联展开：${CMS_OPEN_INCLUDES.join(', ')}` }),
  page: z.string().optional(),
  pageSize: z.string().optional().openapi({ description: `每页条数，上限 ${CMS_OPEN_PAGE_SIZE_MAX}` }),
  cursor: z.string().max(200).optional().openapi({ description: '游标翻页；传入后忽略 page' }),
}).openapi('CmsOpenContentListQuery');

const badRequest = { 400: { content: jsonContent(ErrorResponse), description: '查询参数不合法' } };
const forbidden = { 403: { content: jsonContent(ErrorResponse), description: '应用未授权 scope 或站点' } };

// ─── 只读端点 ────────────────────────────────────────────────────────────────

const channelsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/cms/channels',
    tags: ['开放API-CMS'], summary: '站点栏目树（启用中）',
    middleware: [requireScope('cms:read')] as const,
    request: { query: SiteCodeQuery },
    responses: { ...commonErrorResponses, ...forbidden, ...ok(z.array(CmsChannelDTO), '栏目树') },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    const tree = await listCmsChannelTree({ siteId: site.id, status: 'enabled' }, { skipAccessCheck: true });
    return c.json(okBody(tree), 200);
  },
});

const contentsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/cms/contents',
    tags: ['开放API-CMS'], summary: '已发布内容查询（过滤 / 排序 / 字段裁剪 / 游标翻页）',
    middleware: [requireScope('cms:read')] as const,
    request: { query: ContentListQuery },
    responses: {
      ...commonErrorResponses, ...badRequest, ...forbidden,
      ...okPaginated(CmsOpenContentDTO, '内容列表（page 模式）'),
    },
  }),
  handler: async (c) => {
    const raw = rawQuery(c);
    const site = await requireSite(c.req.valid('query').siteCode);
    return c.json(okBody(await listOpenCmsContents(site, parseQuery(raw))), 200);
  },
});

/** 游标模式返回结构与 page 模式不同，单列一个端点让 Swagger 能准确描述 */
const contentsCursorRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/cms/contents/cursor',
    tags: ['开放API-CMS'], summary: '已发布内容游标翻页（深翻不退化，适合全量拉取）',
    middleware: [requireScope('cms:read')] as const,
    request: { query: ContentListQuery },
    responses: {
      ...commonErrorResponses, ...badRequest, ...forbidden,
      ...ok(CmsOpenContentCursorPageDTO, '内容游标页'),
    },
  }),
  handler: async (c) => {
    const raw = rawQuery(c);
    const site = await requireSite(c.req.valid('query').siteCode);
    return c.json(okBody(await listOpenCmsContentsByCursor(site, parseQuery(raw))), 200);
  },
});

const syncRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/cms/contents/sync',
    tags: ['开放API-CMS'], summary: '内容增量同步（含删除变更）',
    middleware: [requireScope('cms:read')] as const,
    request: {
      query: SiteCodeQuery.extend({
        since: z.string().max(20).optional().openapi({ example: '2026-07-01 00:00:00', description: '起始时间；首次同步可留空取全量' }),
        cursor: z.string().max(200).optional().openapi({ description: '上次返回的 nextCursor，优先于 since' }),
        pageSize: z.string().optional().openapi({ description: `每批条数，上限 ${CMS_OPEN_SYNC_PAGE_SIZE_MAX}` }),
        include: z.string().max(200).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...badRequest, ...forbidden, ...ok(CmsOpenSyncResultDTO, '变更集') },
  }),
  handler: async (c) => {
    const query = c.req.valid('query');
    const site = await requireSite(query.siteCode);
    try {
      return c.json(okBody(await syncOpenCmsContents(site, {
        since: query.since ?? null,
        cursor: decodeCmsOpenCursor(query.cursor),
        pageSize: Number(query.pageSize) || 100,
        includes: parseCmsOpenIncludes(query.include),
      })), 200);
    } catch (err) {
      if (err instanceof OpenQueryError) throw new HTTPException(400, { message: err.message });
      throw err;
    }
  },
});

const contentDetailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/cms/contents/{idOrSlug}',
    tags: ['开放API-CMS'], summary: '已发布内容详情（含正文与扩展字段）',
    middleware: [requireScope('cms:read')] as const,
    request: {
      params: z.object({ idOrSlug: z.string().min(1).max(255).openapi({ description: '内容 id 或 slug' }) }),
      query: SiteCodeQuery.extend({
        fields: z.string().max(500).optional(),
        include: z.string().max(200).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...badRequest, ...forbidden, ...ok(CmsOpenContentDTO, '内容详情') },
  }),
  handler: async (c) => {
    const raw = rawQuery(c);
    const site = await requireSite(c.req.valid('query').siteCode);
    const content = await getOpenCmsContent(site, c.req.valid('param').idOrSlug, parseQuery(raw));
    return c.json(okBody(content), 200);
  },
});

// ─── 写入端点 ────────────────────────────────────────────────────────────────

const ContentWriteBody = z.object({
  channel: z.string().min(1).max(50).openapi({ description: '目标栏目标识（须在应用授权的栏目白名单内）' }),
  title: z.string().min(1).max(255),
  subTitle: z.string().max(255).nullable().optional(),
  shortTitle: z.string().max(100).nullable().optional(),
  slug: z.string().max(255).nullable().optional(),
  summary: z.string().max(2000).nullable().optional(),
  coverImage: z.string().max(500).nullable().optional(),
  author: z.string().max(50).nullable().optional(),
  editor: z.string().max(50).nullable().optional(),
  source: z.string().max(100).nullable().optional(),
  sourceUrl: z.string().max(500).nullable().optional(),
  body: z.string().nullable().optional(),
  extend: z.record(z.string(), z.unknown()).optional(),
  externalLink: z.string().max(500).nullable().optional(),
  seoTitle: z.string().max(255).nullable().optional(),
  seoKeywords: z.string().max(500).nullable().optional(),
  seoDescription: z.string().max(500).nullable().optional(),
  publish: z.boolean().optional().openapi({ description: '直接发布；需 cms:publish scope + 授权行 canPublish + 站点开关三者同时成立' }),
}).openapi('CmsOpenContentWrite');

const createContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/cms/contents',
    tags: ['开放API-CMS'], summary: '创建内容（默认落草稿并提交审核）',
    middleware: [requireScope('cms:write'), idempotencyGuard({ ttlSeconds: 30 })] as const,
    request: {
      query: SiteCodeQuery,
      body: { content: jsonContent(ContentWriteBody), required: true },
    },
    responses: { ...commonErrorResponses, ...badRequest, ...forbidden, ...ok(CmsContentDTO, '创建成功') },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    const content = await createOpenCmsContent(
      site, clientIdOf(c), hasScope(c, 'cms:publish'), c.req.valid('json'),
    );
    return c.json(okBody(content, '创建成功'), 200);
  },
});

const updateContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'patch', path: '/cms/contents/{id}',
    tags: ['开放API-CMS'], summary: '更新内容（支持 expectedVersion 乐观锁）',
    middleware: [requireScope('cms:write')] as const,
    request: {
      params: z.object({ id: z.coerce.number().int().positive() }),
      query: SiteCodeQuery,
      body: {
        content: jsonContent(ContentWriteBody.partial().extend({
          expectedVersion: z.number().int().positive().optional().openapi({ description: '与当前 version 不一致返回 409' }),
        })),
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses, ...badRequest, ...forbidden,
      409: { content: jsonContent(ErrorResponse), description: '版本冲突，请重新读取后再提交' },
      ...ok(CmsContentDTO, '更新成功'),
    },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    const content = await updateOpenCmsContent(site, clientIdOf(c), c.req.valid('param').id, c.req.valid('json'));
    return c.json(okBody(content, '更新成功'), 200);
  },
});

const submitContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/cms/contents/{id}/submit',
    tags: ['开放API-CMS'], summary: '提交审核',
    middleware: [requireScope('cms:write')] as const,
    request: { params: z.object({ id: z.coerce.number().int().positive() }), query: SiteCodeQuery },
    responses: { ...commonErrorResponses, ...forbidden, ...ok(CmsContentDTO, '已提交审核') },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    const content = await submitOpenCmsContent(site, clientIdOf(c), c.req.valid('param').id);
    return c.json(okBody(content, '已提交审核'), 200);
  },
});

const publishContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/cms/contents/{id}/publish',
    tags: ['开放API-CMS'], summary: '直接发布（需 cms:publish + 授权 + 站点开关）',
    middleware: [requireScope('cms:publish')] as const,
    request: { params: z.object({ id: z.coerce.number().int().positive() }), query: SiteCodeQuery },
    responses: { ...commonErrorResponses, ...forbidden, ...ok(CmsContentDTO, '已发布') },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    const content = await publishOpenCmsContent(site, clientIdOf(c), true, c.req.valid('param').id);
    return c.json(okBody(content, '已发布'), 200);
  },
});

const deleteContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/cms/contents/{id}',
    tags: ['开放API-CMS'], summary: '移入回收站（彻底删除仅限后台）',
    middleware: [requireScope('cms:write')] as const,
    request: { params: z.object({ id: z.coerce.number().int().positive() }), query: SiteCodeQuery },
    responses: { ...commonErrorResponses, ...forbidden, ...okMsg('已移入回收站') },
  }),
  handler: async (c) => {
    const site = await requireSite(c.req.valid('query').siteCode);
    await recycleOpenCmsContent(site, clientIdOf(c), c.req.valid('param').id);
    return c.json(okBody(null, '已移入回收站'), 200);
  },
});

// 路径注册顺序有意义：/contents/sync 与 /contents/cursor 必须先于 /contents/{idOrSlug}，
// 否则会被通配参数吞掉
router.openapiRoutes([
  channelsRoute, contentsRoute, contentsCursorRoute, syncRoute, contentDetailRoute,
  createContentRoute, updateContentRoute, submitContentRoute, publishContentRoute, deleteContentRoute,
] as const);

export default router;
