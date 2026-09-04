import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  validationHook, ok, commonErrorResponses, okBody, HostQuery,
} from '../../lib/openapi-schemas';
import { readLastLines, spawnTailFollow, openLogForDownload, resolveAllowedLogPath, getLocalLogRoots, getRemoteLogRoots } from '../../services/ops/log-viewer.service';
import { assertRemoteHostAccess, resolveHostIdQuery } from '../../lib/host-access';
import { streamProcessOutput } from '../../lib/http-stream';

const router = new OpenAPIHono({ defaultHook: validationHook });
const LOG_PERM = 'system:log:view';

// ─── 流式路由：tail -f ───────────────────────────────────────────────────────
router.get('/stream', authMiddleware, guard({ permission: LOG_PERM }), async (c) => {
  const filePath = c.req.query('path') ?? '';
  if (!filePath) {
    throw new HTTPException(400, { message: '参数 path 不能为空' });
  }
  const hostId = await resolveHostIdQuery(c);
  // 白名单 / 存在性校验放在开流之前，错误以 JSON 状态码返回而不是流式正文
  await resolveAllowedLogPath(filePath, hostId);

  return streamProcessOutput(c, (onData, onExit) => spawnTailFollow(filePath, onData, onExit, hostId));
});

// ─── 下载日志文件 ────────────────────────────────────────────────────────────
router.get('/download', authMiddleware, guard({ permission: LOG_PERM }), async (c) => {
  const filePath = c.req.query('path') ?? '';
  if (!filePath) {
    throw new HTTPException(400, { message: '参数 path 不能为空' });
  }
  const hostId = await resolveHostIdQuery(c);
  let file: Awaited<ReturnType<typeof openLogForDownload>>;
  try {
    file = await openLogForDownload(filePath, 100 * 1024 * 1024, hostId);
  } catch (e) {
    if (e instanceof HTTPException) throw e;
    throw new HTTPException(400, { message: (e as Error).message });
  }
  c.header('Content-Type', 'application/octet-stream');
  c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
  c.header('Content-Length', String(file.size));
  return stream(c, async (s) => {
    s.onAbort(() => { file.stream.destroy(); });
    try {
      for await (const chunk of file.stream) {
        await s.write(chunk as Uint8Array);
      }
    } catch { /* client disconnected */ } finally {
      file.stream.destroy();
    }
  });
});

// ─── OpenAPI 路由 ─────────────────────────────────────────────────────────────

const contentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/content', summary: '读取日志文件末尾内容', tags: ['LogViewer'],
    middleware: [authMiddleware, guard({ permission: LOG_PERM })] as const,
    request: {
      query: HostQuery.extend({
        path: z.string().min(1),
        lines: z.string().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.object({ content: z.string() }), '日志内容') },
  }),
  handler: async (c) => {
    const { path: filePath, lines, hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    const lineCount = Math.min(Number.parseInt(lines ?? '500', 10) || 500, 5000);
    const content = await readLastLines(filePath, lineCount, hostId);
    return c.json(okBody({ content }), 200);
  },
});

const rootsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/roots', summary: '日志查看器允许读取的目录', tags: ['LogViewer'],
    middleware: [authMiddleware, guard({ permission: LOG_PERM })] as const,
    request: { query: HostQuery },
    responses: { ...commonErrorResponses, ...ok(z.object({ roots: z.array(z.string()) }), '允许目录') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    return c.json(okBody({ roots: hostId == null ? getLocalLogRoots() : getRemoteLogRoots() }), 200);
  },
});

router.openapiRoutes([contentRoute, rootsRoute] as const);

export default router;
