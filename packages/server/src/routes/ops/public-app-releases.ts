/**
 * 应用版本管理（公开侧 API，免登录）。
 *
 * 客户端在线升级的机器接口：check 检查更新、latest 最新版查询、按文件名分发制品
 * （兼容 electron-updater generic provider 的 latest.yml / blockmap / 安装包固定布局）、
 * 安装回执上报。只暴露 status = published 的版本，可见性过滤在 service 层强制执行。
 *
 * 设备标识：query `deviceId` 或请求头 `x-device-id`（electron-updater 走 requestHeaders），
 * 用于灰度命中判定与设备数统计；不携带时灰度中的版本对其不可见（fail-closed）。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import {
  APP_PLATFORMS,
  APP_RELEASE_CHANNELS,
  checkAppUpdateQuerySchema,
  reportAppReleaseEventSchema,
} from '@zenith/shared/ops';
import {
  ErrorResponse,
  commonErrorResponses,
  jsonContent,
  ok,
  okMsg,
  okBody,
  validationHook,
} from '../../lib/openapi-schemas';
import { AppPublicReleaseInfoDTO, AppUpdateCheckResultDTO } from '../../lib/openapi-dtos';
import { getStoredFileForRead } from '../../services/files/files.service';
import { readStoredFile } from '../../lib/file-storage';
import { parseRangeHeader, rangeContentHeaders, rangeNotSatisfiable, supportsRange } from '../../lib/http-range';
import {
  checkAppUpdate,
  getLatestPublicRelease,
  registerArtifactDownload,
  reportAppReleaseEvent,
  resolvePublicArtifact,
} from '../../services/ops/app-releases.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

/** 提取设备标识：query 优先，其次自定义请求头 */
function resolveDeviceId(c: { req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined } }) {
  return c.req.query('deviceId') ?? c.req.header('x-device-id') ?? undefined;
}

// ─── GET /check — 检查更新 ───────────────────────────────────────────────────

const checkRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/check',
    tags: ['应用版本公开接口'], summary: '检查更新（免登录）',
    security: [],
    request: { query: checkAppUpdateQuerySchema },
    responses: {
      ...commonErrorResponses,
      ...ok(AppUpdateCheckResultDTO, '检查结果'),
      404: { content: jsonContent(ErrorResponse), description: '应用不存在' },
    },
  }),
  handler: async (c) => {
    const query = c.req.valid('query');
    const result = await checkAppUpdate({ ...query, deviceId: query.deviceId ?? c.req.header('x-device-id') });
    return c.json(okBody(result), 200);
  },
});

// ─── GET /latest — 最新已发布版本（官网下载页）──────────────────────────────

const latestRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/latest',
    tags: ['应用版本公开接口'], summary: '最新已发布版本（免登录）',
    security: [],
    request: {
      query: z.object({
        app: z.string().min(1).max(64),
        channel: z.enum(APP_RELEASE_CHANNELS).default('stable'),
        platform: z.enum(APP_PLATFORMS).optional(),
      }),
    },
    responses: {
      ...commonErrorResponses,
      ...ok(AppPublicReleaseInfoDTO, '最新版本'),
      404: { content: jsonContent(ErrorResponse), description: '应用不存在或暂无已发布版本' },
    },
  }),
  handler: async (c) => {
    const { app, channel, platform } = c.req.valid('query');
    return c.json(okBody(await getLatestPublicRelease(app, channel, platform)), 200);
  },
});

// ─── POST /events — 安装回执上报 ─────────────────────────────────────────────

const reportEventRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/events',
    tags: ['应用版本公开接口'], summary: '安装回执上报（免登录）',
    security: [],
    request: { body: { content: jsonContent(reportAppReleaseEventSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      ...okMsg('已上报'),
      404: { content: jsonContent(ErrorResponse), description: '应用不存在' },
    },
  }),
  handler: async (c) => {
    await reportAppReleaseEvent(c.req.valid('json'));
    return c.json(okBody(null, '已上报'), 200);
  },
});

// ─── GET /{app}/{channel}/{platform}/{filename} — 制品分发 ─────────────────
// electron-updater generic provider 以 feed 基地址 + 固定文件名请求：
//   {base}/latest.yml → 版本元数据；{base}/Xxx-Setup-1.2.3.exe(.blockmap) → 安装包与差量块图。
// 同一路由同时服务人肉下载（check 响应中的 downloadUrl 也指向这里）。

const downloadParams = z.object({
  app: z.string().min(1).max(64).openapi({ param: { name: 'app', in: 'path' }, example: 'zenith-desktop' }),
  channel: z.enum(APP_RELEASE_CHANNELS).openapi({ param: { name: 'channel', in: 'path' }, example: 'stable' }),
  platform: z.enum(APP_PLATFORMS).openapi({ param: { name: 'platform', in: 'path' }, example: 'windows' }),
  filename: z.string().min(1).max(255).openapi({ param: { name: 'filename', in: 'path' }, example: 'latest.yml' }),
});

const downloadRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{app}/{channel}/{platform}/{filename}',
    tags: ['应用版本公开接口'], summary: '制品分发（免登录，兼容 electron-updater）',
    security: [],
    request: { params: downloadParams },
    responses: {
      ...commonErrorResponses,
      200: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容' },
      206: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容分片' },
      302: { description: '外链制品跳转' },
      416: { content: jsonContent(ErrorResponse), description: 'Range 不合法' },
      404: { content: jsonContent(ErrorResponse), description: '文件不存在' },
    },
  }),
  handler: async (c) => {
    const { app, channel, platform, filename } = c.req.valid('param');
    const deviceId = resolveDeviceId(c);
    const resolved = await resolvePublicArtifact({ appKey: app, channel, platform, fileName: filename, deviceId });
    const { artifact } = resolved;

    if (artifact.kind === 'external' && artifact.externalUrl) {
      return c.redirect(artifact.externalUrl, 302);
    }
    if (!artifact.fileId) throw new HTTPException(404, { message: '文件不存在' });

    const { file, storageConfig } = await getStoredFileForRead(artifact.fileId);
    // metadata（latest.yml）必须实时反映最新发布，禁止缓存；二进制制品内容不可变，可放心缓存
    const cacheControl = artifact.kind === 'metadata' ? 'no-store' : 'public, max-age=3600';
    const baseHeaders: Record<string, string> = {
      'Cache-Control': cacheControl,
      'Accept-Ranges': supportsRange(file.provider) ? 'bytes' : 'none',
      'X-Content-Type-Options': 'nosniff',
    };

    const range = supportsRange(file.provider) ? parseRangeHeader(c.req.header('range'), file.size) : null;
    if (range === 'invalid') return rangeNotSatisfiable(file.size, baseHeaders);

    // 差量下载会对同一文件发出多个 Range 请求，只在整文件或首个分片计一次下载
    if (!range || range.start === 0) {
      await registerArtifactDownload(resolved, deviceId);
    }

    const storedFile = await readStoredFile(file, storageConfig, range ?? undefined);
    return new Response(storedFile.stream, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': storedFile.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`,
        ...rangeContentHeaders(range, file.size),
        ...baseHeaders,
      },
    });
  },
});

router.openapiRoutes([
  checkRoute,
  latestRoute,
  reportEventRoute,
  downloadRoute,
] as const);

export default router;
