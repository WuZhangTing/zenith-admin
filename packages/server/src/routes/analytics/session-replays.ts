import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { ANALYTICS_SITE_KEY_HEADER, replaySegmentMetaSchema } from '@zenith/shared/analytics';
import { authMiddleware } from '../../middleware/auth';
import { optionalAuthMiddleware } from '../../middleware/optional-auth';
import { guard } from '../../middleware/guard';
import { namedRateLimit } from '../../middleware/rate-limit';
import {
  validationHook, commonErrorResponses, ok, okMsg, okBody, okPaginated, PaginationQuery, jsonContent, ErrorResponse, queryBool,
} from '../../lib/openapi-schemas';
import { ReplaySessionDTO, ReplaySessionDetailDTO } from '../../lib/openapi-dtos';
import {
  ingestReplaySegment, listReplaySessions, getReplaySessionDetail, getReplaySegmentData, deleteReplaySessions,
  getReplayStorageStats, listHeatmapPages, getClickHeatmap, listReplayAccessLogs, REPLAY_SEGMENT_MAX_BYTES,
} from '../../services/analytics/session-replays.service';
import { getClientIp } from '../../lib/request-helpers';

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
        hasError: queryBool(),
        source: z.enum(['web_admin', 'web_member']).or(z.literal('')).optional(),
        pagePath: z.string().max(256).optional(),
        clickLabel: z.string().max(64).optional(),
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
      pagePath: q.pagePath || undefined, clickLabel: q.clickLabel || undefined,
    })), 200);
  },
});

const IdParamStr = z.object({ id: z.uuid() });

const ReplayStorageStatsDTO = z
  .object({
    totalBytes: z.number(),
    totalCount: z.number().int(),
    todayBytes: z.number(),
    todayCount: z.number().int(),
    quotaMb: z.number().int(),
    usagePercent: z.number(),
  })
  .openapi('ReplayStorageStats');

const statsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/stats', tags: ['SessionReplays'], summary: '回放存储统计（容量看板）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    responses: { ...ok(ReplayStorageStatsDTO, '存储统计'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getReplayStorageStats()), 200),
});

const HeatmapPointDTO = z.object({ x: z.number().int(), y: z.number().int(), count: z.number().int() });

const heatmapPagesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/heatmap/pages', tags: ['SessionReplays'], summary: '有点击热力数据的页面清单', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: { query: z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }) },
    responses: { ...ok(z.array(z.string()), '页面清单'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listHeatmapPages(c.req.valid('query').days)), 200),
});

const heatmapRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/heatmap', tags: ['SessionReplays'], summary: '页面点击热力聚合（2% 网格）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: { query: z.object({ pagePath: z.string().min(1).max(256), days: z.coerce.number().int().min(1).max(90).default(30) }) },
    responses: { ...ok(z.object({ points: z.array(HeatmapPointDTO), total: z.number().int() }), '热力数据'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const q = c.req.valid('query');
    return c.json(okBody(await getClickHeatmap(q.pagePath, q.days)), 200);
  },
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['SessionReplays'], summary: '回放会话详情（含分片清单与关联错误）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:list' })] as const,
    request: { params: IdParamStr },
    responses: { ...ok(ReplaySessionDetailDTO, '回放详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getReplaySessionDetail(c.req.valid('param').id, getClientIp(c))), 200),
});

const AccessLogDTO = z
  .object({
    id: z.number().int(),
    replayId: z.string(),
    replayOwner: z.string().nullable(),
    userId: z.number().int(),
    username: z.string().nullable(),
    action: z.string(),
    ip: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('ReplayAccessLog');

const accessLogsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/access-logs', tags: ['SessionReplays'], summary: '回放访问审计（谁查看了谁的录像）', security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'monitor:replay:manage' })] as const,
    request: {
      query: PaginationQuery.extend({
        replayId: z.uuid().optional(),
        keyword: z.string().optional(),
      }),
    },
    responses: { ...okPaginated(AccessLogDTO, '审计列表'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const q = c.req.valid('query');
    return c.json(okBody(await listReplayAccessLogs({
      page: q.page, pageSize: q.pageSize,
      replayId: q.replayId, keyword: q.keyword || undefined,
    })), 200);
  },
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
    request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.uuid()).min(1).max(100) }) } }, required: true } },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const n = await deleteReplaySessions(c.req.valid('json').ids);
    return c.json(okBody(null, `已删除 ${n} 条回放`), 200);
  },
});

r.openapiRoutes([ingestRoute, listRoute, statsRoute, heatmapPagesRoute, heatmapRoute, accessLogsRoute, batchDeleteRoute, detailRoute, segmentDataRoute] as const);

export default r;
