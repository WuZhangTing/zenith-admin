import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  validationHook, ok, commonErrorResponses, okBody,
} from '../../lib/openapi-schemas';
import { readLastLines, spawnTailFollow, validateLogPath, openLogForDownload } from '../../services/ops/log-viewer.service';
import { assertRemoteHostAccess } from '../../lib/host-access';

const router = new OpenAPIHono({ defaultHook: validationHook });
const LOG_PERM = 'system:log:view';

// ─── 流式路由：tail -f ───────────────────────────────────────────────────────
router.get('/stream', authMiddleware, guard({ permission: LOG_PERM }), async (c) => {
  const filePath = c.req.query('path') ?? '';
  if (!filePath) {
    throw new HTTPException(400, { message: '参数 path 不能为空' });
  }
  const rawHostId = c.req.query('hostId');
  const hostId = rawHostId ? Number(rawHostId) : undefined;
  if (rawHostId && (!Number.isInteger(hostId) || (hostId ?? 0) <= 0)) {
    throw new HTTPException(400, { message: '无效的 hostId' });
  }
  await assertRemoteHostAccess(c, hostId);
  try {
    validateLogPath(filePath);
  } catch (e) {
    throw new HTTPException(400, { message: (e as Error).message });
  }

  return stream(c, async (s) => {
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    let aborted = false;
    let handle: { kill: () => void } | null = null;
    let writes = Promise.resolve();
    s.onAbort(() => {
      aborted = true;
      handle?.kill();
      finish();
    });
    handle = await spawnTailFollow(
      filePath,
      (chunk) => {
        writes = writes
          .then(async () => { await s.write(chunk); })
          .catch(() => { handle?.kill(); finish(); });
      },
      () => { void writes.finally(finish); },
      hostId,
    );
    if (aborted) handle.kill();
    try {
      await done;
      await writes;
    } finally {
      handle.kill();
    }
  });
});

// ─── 下载日志文件 ────────────────────────────────────────────────────────────
router.get('/download', authMiddleware, guard({ permission: LOG_PERM }), async (c) => {
  const filePath = c.req.query('path') ?? '';
  if (!filePath) {
    throw new HTTPException(400, { message: '参数 path 不能为空' });
  }
  const rawHostId = c.req.query('hostId');
  const hostId = rawHostId ? Number(rawHostId) : undefined;
  if (rawHostId && (!Number.isInteger(hostId) || (hostId ?? 0) <= 0)) {
    throw new HTTPException(400, { message: '无效的 hostId' });
  }
  await assertRemoteHostAccess(c, hostId);
  let file: Awaited<ReturnType<typeof openLogForDownload>>;
  try {
    validateLogPath(filePath);
    file = await openLogForDownload(filePath, 100 * 1024 * 1024, hostId);
  } catch (e) {
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
      query: z.object({
        path: z.string().min(1),
        lines: z.string().optional(),
        hostId: z.coerce.number().int().positive().optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(z.object({ content: z.string() }), '日志内容') },
  }),
  handler: async (c) => {
    const { path: filePath, lines, hostId } = c.req.valid('query');
    await assertRemoteHostAccess(c, hostId);
    try { validateLogPath(filePath); } catch (e) {
      throw new HTTPException(400, { message: (e as Error).message });
    }
    const lineCount = Math.min(Number.parseInt(lines ?? '500', 10) || 500, 5000);
    const content = await readLastLines(filePath, lineCount, hostId);
    return c.json(okBody({ content }), 200);
  },
});

router.openapiRoutes([contentRoute] as const);

export default router;
