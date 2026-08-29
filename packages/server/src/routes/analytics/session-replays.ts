import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { ANALYTICS_SITE_KEY_HEADER, replaySegmentMetaSchema } from '@zenith/shared/analytics';
import { authMiddleware } from '../../middleware/auth';
import { optionalAuthMiddleware } from '../../middleware/optional-auth';
import { guard } from '../../middleware/guard';
import { namedRateLimit } from '../../middleware/rate-limit';
import {
  validationHook, commonErrorResponses, ok, okMsg, okBody, okPaginated, PaginationQuery, jsonContent, ErrorResponse,
} from '../../lib/openapi-schemas';
import { ReplaySessionDTO, ReplaySessionDetailDTO } from '../../lib/openapi-dtos';
import {
  ingestReplaySegment, listReplaySessions, getReplaySessionDetail, getReplaySegmentData, deleteReplaySessions,
  REPLAY_SEGMENT_MAX_BYTES,
} from '../../services/analytics/session-replays.service';

const r = new OpenAPIHono({ defaultHook: validationHook });

// ─── 上报（匿名/登录均可）─────────────────────────────────────────────────────
const ingestRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/segments', tags: ['SessionReplays'], summary: '上报回放分片（multipart：meta JSON + gzip 二进制）', security: [],
    middleware: [optionalAuthMiddleware, namedRateLimit('replay-ingest')] as const,
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              meta: z.string().describe('ReplaySegmentMeta JSON'),
              data: z.any().openapi({ type: 'string', format: 'binary' }),
            }),
          },
        },
        required: true,
      },
    },
    responses: { ...okMsg('上报成功'), ...commonErrorResponses, 400: { content: jsonContent(ErrorResponse), description: '参数或分片非法' } },
  }),
  handler: async (c) => {
    const body = await c.req.parseBody();
    let meta: unknown;
    try {
      meta = JSON.parse(String(body.meta ?? ''));
    } catch {
      throw new HTTPException(400, { message: 'meta 不是合法 JSON' });
    }
    const parsed = replaySegmentMetaSchema.safeParse(meta);
    if (!parsed.success) throw new HTTPException(400, { message: `meta 校验失败：${parsed.error.issues[0]?.message ?? '未知错误'}` });
    const file = body.data;
    if (typeof (file as File)?.arrayBuffer !== 'function') throw new HTTPException(400, { message: '缺少分片数据' });
    if ((file as File).size > REPLAY_SEGMENT_MAX_BYTES) throw new HTTPException(400, { message: '分片超出大小上限' });
    const data = Buffer.from(await (file as File).arrayBuffer());
    await ingestReplaySegment(parsed.data, data, {
      ua: c.req.header('user-agent') ?? '',
      siteKey: c.req.header(ANALYTICS_SITE_KEY_HEADER) ?? null,
      origin: c.req.header('origin') ?? null,
    });
    return c.json(okBody(null, '上报成功'), 200);
  },
});

// ─── 查询 ─────────────────────────────────────────────────────────────────────
const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['SessionReplays'], summary: '回放会话列表', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        status: z.enum(['recording', 'completed', 'expired']).or(z.literal('')).optional(),
        mode: z.enum(['buffer', 'stream']).or(z.literal('')).optional(),
        triggerType: z.enum(['error', 'sampled', 'manual', 'rage_click', 'white_screen']).or(z.literal('')).optional(),
        keyword: z.string().optional(),
        hasError: z.coerce.boolean().optional(),
        source: z.enum(['web_admin', 'web_member']).or(z.literal('')).optional(),
      }),
    },
    responses: { ...okPaginated(ReplaySessionDTO, '回放列表'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const q = c.req.valid('query');
    return c.json(okBody(await listReplaySessions({
      page: q.page, pageSize: q.pageSize,
      status: q.status || undefined, mode: q.mode || undefined,
      triggerType: q.triggerType || undefined, keyword: q.keyword || undefined,
      hasError: q.hasError, source: q.source || undefined,
    })), 200);
  },
});

const IdParamStr = z.object({ id: z.string().uuid() });

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['SessionReplays'], summary: '回放会话详情（含分片清单与关联错误）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: { params: IdParamStr },
    responses: { ...ok(ReplaySessionDetailDTO, '回放详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getReplaySessionDetail(c.req.valid('param').id)), 200),
});

const segmentDataRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/segments/{seq}/data', tags: ['SessionReplays'], summary: '拉取回放分片数据（gzip JSON 透传）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: { params: IdParamStr.extend({ seq: z.coerce.number().int().min(0) }) },
    responses: {
      200: { description: '分片数据（Content-Encoding: gzip 的 JSON 数组）' },
      ...commonErrorResponses,
    },
  }),
  handler: async (c) => {
    const { id, seq } = c.req.valid('param');
    const data = await getReplaySegmentData(id, seq);
    // gzip 原样透传：浏览器按 Content-Encoding 自动解压，服务端零解压开销
    return c.body(new Uint8Array(data).buffer as ArrayBuffer, 200, {
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'private, max-age=3600',
    });
  },
});

const batchDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch', tags: ['SessionReplays'], summary: '批量删除回放会话', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:manage' })] as const,
    request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }) } }, required: true } },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const n = await deleteReplaySessions(c.req.valid('json').ids);
    return c.json(okBody(null, `已删除 ${n} 条回放`), 200);
  },
});

r.openapiRoutes([ingestRoute, listRoute, batchDeleteRoute, detailRoute, segmentDataRoute] as const);

export default r;
