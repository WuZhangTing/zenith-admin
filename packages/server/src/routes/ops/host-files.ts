import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { Readable } from 'node:stream';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { assertRemoteHostAccess } from '../../lib/host-access';
import {
  validationHook, commonErrorResponses, ok, okMsg, okBody, jsonContent, ErrorResponse,
} from '../../lib/openapi-schemas';
import { SftpDirListingDTO, SftpFileEntryDTO, SftpFileContentDTO, SftpHomeDTO } from '../../lib/openapi-dtos';
import {
  hostFileChmod,
  hostFileCreate,
  hostFileDelete,
  hostFileDownload,
  hostFileHome,
  hostFileList,
  hostFileReadText,
  hostFileRename,
  hostFileUpload,
  hostFileWriteText,
} from '../../services/ops/host-files.service';
import { assertContentLengthWithinLimit } from '../../services/ops/terminal-files.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const FILE_PERM = 'system:file:use';
const HostIdParam = z.object({
  hostId: z.coerce.number().int().positive().openapi({
    param: { name: 'hostId', in: 'path' },
    example: 1,
  }),
});

async function allowed(c: Parameters<typeof assertRemoteHostAccess>[0], hostId: number): Promise<void> {
  await assertRemoteHostAccess(c, hostId);
}

const homeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:hostId/home', tags: ['HostFiles'], summary: '远程主机 home 目录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: FILE_PERM })] as const,
    request: { params: HostIdParam },
    responses: { ...commonErrorResponses, ...ok(SftpHomeDTO, 'home 目录') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    return c.json(okBody(await hostFileHome(hostId)), 200);
  },
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:hostId/list', tags: ['HostFiles'], summary: '远程主机目录列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: FILE_PERM })] as const,
    request: { params: HostIdParam, query: z.object({ path: z.string().optional() }) },
    responses: { ...commonErrorResponses, ...ok(SftpDirListingDTO, '目录列表') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    return c.json(okBody(await hostFileList(hostId, c.req.valid('query').path)), 200);
  },
});

const readRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:hostId/content', tags: ['HostFiles'], summary: '读取远程主机文本文件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: FILE_PERM })] as const,
    request: { params: HostIdParam, query: z.object({ path: z.string().min(1) }) },
    responses: { ...commonErrorResponses, ...ok(SftpFileContentDTO, '文件内容') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    return c.json(okBody(await hostFileReadText(hostId, c.req.valid('query').path)), 200);
  },
});

const writeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/:hostId/content', tags: ['HostFiles'], summary: '保存远程主机文本文件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '保存远程主机文件', module: '文件管理器', recordBody: false },
    })] as const,
    request: {
      params: HostIdParam,
      body: {
        content: jsonContent(z.object({
          path: z.string().min(1),
          content: z.string(),
          baseEtag: z.string().optional(),
        })),
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(SftpFileEntryDTO, '保存成功'),
      409: { content: jsonContent(ErrorResponse), description: '文件已被修改' },
    },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    const body = c.req.valid('json');
    return c.json(okBody(await hostFileWriteText(hostId, body.path, body.content, body.baseEtag), '保存成功'), 200);
  },
});

const createEntryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/:hostId/create', tags: ['HostFiles'], summary: '新建远程主机文件或目录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '新建远程主机文件/目录', module: '文件管理器' },
    })] as const,
    request: {
      params: HostIdParam,
      body: { content: jsonContent(z.object({ path: z.string().min(1), type: z.enum(['file', 'dir']) })), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(SftpFileEntryDTO, '创建成功') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    const body = c.req.valid('json');
    return c.json(okBody(await hostFileCreate(hostId, body.path, body.type), '创建成功'), 200);
  },
});

const renameRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/:hostId/rename', tags: ['HostFiles'], summary: '重命名/移动远程主机文件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '重命名/移动远程主机文件', module: '文件管理器' },
    })] as const,
    request: {
      params: HostIdParam,
      body: { content: jsonContent(z.object({ from: z.string().min(1), to: z.string().min(1) })), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(SftpFileEntryDTO, '操作成功') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    const body = c.req.valid('json');
    return c.json(okBody(await hostFileRename(hostId, body.from, body.to), '操作成功'), 200);
  },
});

const deleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/:hostId/entry', tags: ['HostFiles'], summary: '删除远程主机文件或目录',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '删除远程主机文件/目录', module: '文件管理器' },
    })] as const,
    request: { params: HostIdParam, query: z.object({ path: z.string().min(1) }) },
    responses: { ...commonErrorResponses, ...okMsg('删除成功') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    await hostFileDelete(hostId, c.req.valid('query').path);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

const chmodRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/:hostId/chmod', tags: ['HostFiles'], summary: '修改远程主机文件权限',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '修改远程主机文件权限', module: '文件管理器' },
    })] as const,
    request: {
      params: HostIdParam,
      body: { content: jsonContent(z.object({ path: z.string().min(1), mode: z.number().int().min(0).max(0o7777) })), required: true },
    },
    responses: { ...commonErrorResponses, ...okMsg('权限已修改') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    const body = c.req.valid('json');
    await hostFileChmod(hostId, body.path, body.mode);
    return c.json(okBody(null, '权限已修改'), 200);
  },
});

const downloadRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/:hostId/download', tags: ['HostFiles'], summary: '下载远程主机文件',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: FILE_PERM })] as const,
    request: { params: HostIdParam, query: z.object({ path: z.string().min(1) }) },
    responses: {
      ...commonErrorResponses,
      200: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容' },
    },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    const file = await hostFileDownload(hostId, c.req.valid('query').path);
    return new Response(Readable.toWeb(file.stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
});

const uploadRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/:hostId/upload', tags: ['HostFiles'], summary: '上传文件到远程主机',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({
      permission: FILE_PERM,
      audit: { description: '上传远程主机文件', module: '文件管理器', recordBody: false },
    })] as const,
    request: {
      params: HostIdParam,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              path: z.string(),
              file: z.any().openapi({ type: 'string', format: 'binary' }),
            }),
          },
        },
        required: true,
      },
    },
    responses: { ...commonErrorResponses, ...ok(SftpFileEntryDTO, '上传成功') },
  }),
  handler: async (c) => {
    const { hostId } = c.req.valid('param');
    await allowed(c, hostId);
    await assertContentLengthWithinLimit(c.req.header('content-length'));
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) throw new HTTPException(400, { message: '未选择文件' });
    return c.json(okBody(await hostFileUpload(hostId, typeof body.path === 'string' ? body.path : '/', file), '上传成功'), 200);
  },
});

router.openapiRoutes([
  homeRoute, listRoute, readRoute, writeRoute, createEntryRoute,
  renameRoute, deleteRoute, chmodRoute, downloadRoute, uploadRoute,
] as const);

export default router;
