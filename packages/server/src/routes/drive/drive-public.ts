import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { drivePublicAccessSchema, saveFromDriveShareSchema } from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { ErrorResponse, commonErrorResponses, jsonContent, ok, okBody, okMsg, queryBool, validationHook } from '../../lib/openapi-schemas';
import { DrivePublicNodeDTO, DrivePublicShareMetaDTO, DrivePublicShareSessionDTO } from '../../lib/openapi-dtos';
import { parseRangeHeader, rangeNotSatisfiable, supportsRange } from '../../lib/http-range';
import {
  createDriveShareSession,
  getDrivePublicShareMeta,
  listDrivePublicChildren,
  readDrivePublicContent,
  saveFromDriveShare,
} from '../../services/drive/drive-share.service';
import { streamStoredContent } from './drive-nodes';

const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-公开外链';

const TokenParam = z.object({
  token: z.string().min(16).max(64).openapi({ param: { name: 'token', in: 'path' }, example: '9f3c…' }),
});

const TokenNodeParam = TokenParam.extend({
  nodeId: z.coerce.number().int().positive().openapi({ param: { name: 'nodeId', in: 'path' }, example: 1 }),
});

/** 会话可经 header `session` 或查询串 `session`（<a download> 无法带自定义头） */
function readSession(headerValue: string | undefined, queryValue: string | undefined): string {
  const session = headerValue ?? queryValue;
  if (!session) throw new HTTPException(401, { message: '缺少外链访问会话' });
  return session;
}

const accessRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/shares/{token}/access', tags: [TAG], summary: '校验密码并签发访问会话',
    // 防密码枚举：由路径绑定限流规则 drive_public_share（/api/drive/public/*）按 IP 限速
    security: [],
    request: { params: TokenParam, body: { content: jsonContent(drivePublicAccessSchema), required: false } },
    responses: { ...commonErrorResponses, ...ok(DrivePublicShareSessionDTO, '访问会话') },
  }),
  handler: async (c) => {
    const { token } = c.req.valid('param');
    const body = c.req.valid('json');
    return c.json(okBody(await createDriveShareSession(token, body?.password)), 200, { 'Cache-Control': 'private, no-store' });
  },
});

const metaRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/shares/{token}', tags: [TAG], summary: '外链元信息（无会话只返回是否需密码）',
    security: [],
    request: { params: TokenParam },
    responses: { ...commonErrorResponses, ...ok(DrivePublicShareMetaDTO, '元信息') },
  }),
  handler: async (c) => {
    const { token } = c.req.valid('param');
    const session = c.req.header('session') ?? c.req.query('session');
    return c.json(okBody(await getDrivePublicShareMeta(token, session)), 200, { 'Cache-Control': 'private, no-store' });
  },
});

const childrenRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/shares/{token}/nodes', tags: [TAG], summary: '浏览外链子目录（需会话）',
    security: [],
    request: { params: TokenParam, query: z.object({ parentId: z.coerce.number().int().positive().optional(), session: z.string().optional() }) },
    responses: { ...commonErrorResponses, ...ok(z.array(DrivePublicNodeDTO), '子节点') },
  }),
  handler: async (c) => {
    const { token } = c.req.valid('param');
    const { parentId, session: querySession } = c.req.valid('query');
    const session = readSession(c.req.header('session'), querySession);
    return c.json(okBody(await listDrivePublicChildren(token, session, parentId)), 200, { 'Cache-Control': 'private, no-store' });
  },
});

const contentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/shares/{token}/nodes/{nodeId}/content', tags: [TAG], summary: '外链文件内容（需会话；?download=true 需 download 权限）',
    security: [],
    request: { params: TokenNodeParam, query: z.object({ download: queryBool('以附件方式下载'), session: z.string().optional() }) },
    responses: {
      ...commonErrorResponses,
      200: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容' },
      206: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容分片' },
      416: { content: jsonContent(ErrorResponse), description: 'Range 不合法' },
    },
  }),
  handler: async (c) => {
    const { token, nodeId } = c.req.valid('param');
    const { download, session: querySession } = c.req.valid('query');
    const session = readSession(c.req.header('session'), querySession);
    // 先不带 Range 解析出对象元数据再决定分片（外链多为整文件预览 / 下载）
    const first = await readDrivePublicContent(token, session, nodeId, !!download, null);
    const range = supportsRange(first.file.provider) ? parseRangeHeader(c.req.header('range'), first.file.size) : null;
    if (range === 'invalid') {
      await first.stored.stream.cancel().catch(() => undefined);
      return rangeNotSatisfiable(first.file.size, { 'Cache-Control': 'private, no-store' });
    }
    if (range) {
      await first.stored.stream.cancel().catch(() => undefined);
      const ranged = await readDrivePublicContent(token, session, nodeId, !!download, range);
      return streamStoredContent({
        stream: ranged.stored.stream, contentType: ranged.stored.contentType, fileName: ranged.node.name, size: ranged.file.size,
        provider: ranged.file.provider, range, download: !!download, etag: `"s${ranged.file.id}-${ranged.file.size}"`,
      });
    }
    return streamStoredContent({
      stream: first.stored.stream, contentType: first.stored.contentType, fileName: first.node.name, size: first.file.size,
      provider: first.file.provider, range: null, download: !!download, etag: `"s${first.file.id}-${first.file.size}"`,
    });
  },
});

const saveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/shares/{token}/save', tags: [TAG], summary: '转存到我的网盘（登录用户）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload', audit: { description: '外链转存到网盘', module: '企业网盘' } })] as const,
    request: { params: TokenParam, body: { content: jsonContent(saveFromDriveShareSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已转存') },
  }),
  handler: async (c) => {
    const { token } = c.req.valid('param');
    const session = readSession(c.req.header('session'), c.req.query('session'));
    const copied = await saveFromDriveShare(token, session, c.req.valid('json'));
    return c.json(okBody(null, `已转存 ${copied} 个节点`), 200);
  },
});

router.openapiRoutes([accessRoute, metaRoute, childrenRoute, contentRoute, saveRoute] as const);

export default router;
