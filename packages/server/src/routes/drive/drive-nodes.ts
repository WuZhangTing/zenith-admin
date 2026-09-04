import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  DRIVE_NODE_TYPES,
  DRIVE_UPLOAD_CONFLICT_POLICIES,
  copyDriveNodesSchema,
  createDriveFolderSchema,
  driveNodeIdsSchema,
  driveUploadCompleteSchema,
  driveUploadInitSchema,
  driveUploadPrecheckSchema,
  moveDriveNodesSchema,
} from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import {
  ErrorResponse, PaginationQuery, commonErrorResponses, dateRangeBound, errBody, jsonContent, ok, okBody, okMsg, okPaginated, queryBool, validationHook,
} from '../../lib/openapi-schemas';
import {
  DriveBatchDownloadResultDTO,
  DriveCopyResultDTO,
  DriveNodeDTO,
  DriveNodeListResultDTO,
  DriveRecentItemDTO,
  DriveRecycleItemDTO,
  DriveSearchItemDTO,
  DriveSharedItemDTO,
  DriveStarredItemDTO,
  DriveUploadChunkResultDTO,
  DriveUploadInitDTO,
  DriveUploadPrecheckDTO,
  DriveUploadStatusDTO,
} from '../../lib/openapi-dtos';
import { rangeContentHeaders, supportsRange } from '../../lib/http-range';
import {
  copyDriveNodes,
  createDriveFolder,
  deleteDriveNodes,
  emptyRecycle,
  listDriveNodes,
  listRecycleNodes,
  moveDriveNodes,
  purgeDriveNodes,
  restoreDriveNodes,
} from '../../services/drive/drive-nodes.service';
import {
  abortDriveUpload,
  completeDriveUpload,
  getDriveUploadStatus,
  initDriveUpload,
  precheckDriveUpload,
  simpleDriveUpload,
  uploadDriveChunk,
} from '../../services/drive/drive-upload.service';
import { listRecentNodes, listSharedWithMe, listStarredNodes, searchDriveNodes } from '../../services/drive/drive-views.service';
import { batchDownloadDriveNodes } from '../../services/drive/drive-tasks.service';

/**
 * /api/drive/nodes 静态路径路由（列表 / 个人视图 / 回收站 / 批量操作 / 上传）。
 * 单节点 /{id}/... 路由在 drive-node-item.ts，两者按顺序挂载在同一路径。
 */
const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-文件';
const AUDIT = { module: '企业网盘' } as const;

/** 可内联渲染的 MIME 白名单（与 /api/files/{id}/content 一致：可能含脚本的类型强制附件下载） */
const SAFE_INLINE_MIME_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/ico', 'image/x-icon', 'image/avif',
  'video/mp4', 'video/webm', 'video/ogg',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'application/pdf',
]);

export function driveContentDisposition(mimeType: string, fileName: string, forceAttachment: boolean): string {
  const normalized = mimeType.split(';')[0].trim().toLowerCase();
  const disposition = !forceAttachment && SAFE_INLINE_MIME_TYPES.has(normalized) ? 'inline' : 'attachment';
  return `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/** 受控内容流式响应（登录接口与外链接口共用） */
export function streamStoredContent(input: {
  stream: ReadableStream;
  contentType: string;
  fileName: string;
  size: number;
  provider: string;
  range: { start: number; end: number } | null;
  download: boolean;
  etag: string;
}) {
  return new Response(input.stream, {
    status: input.range ? 206 : 200,
    headers: {
      'Content-Type': input.contentType,
      'Content-Disposition': driveContentDisposition(input.contentType, input.fileName, input.download),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
      ETag: input.etag,
      'Accept-Ranges': supportsRange(input.provider) ? 'bytes' : 'none',
      ...rangeContentHeaders(input.range, input.size),
    },
  });
}

export const binaryResponses = {
  ...commonErrorResponses,
  200: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容' },
  206: { content: { 'application/octet-stream': { schema: z.string() } }, description: '文件内容分片' },
  416: { content: jsonContent(ErrorResponse), description: 'Range 不合法' },
} as const;

const UploadIdParam = z.object({ uploadId: z.string().min(8).openapi({ param: { name: 'uploadId', in: 'path' }, example: 'c2a8…' }) });

// ─── 列表 / 个人视图 ─────────────────────────────────────────────────────────

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: [TAG], summary: '目录内容（parentId 缺省 = 空间根级）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        spaceId: z.coerce.number().int().positive().optional(),
        parentId: z.coerce.number().int().positive().optional(),
        keyword: z.string().optional(),
        type: z.enum(DRIVE_NODE_TYPES).optional(),
        sortBy: z.enum(['name', 'size', 'updatedAt', 'createdAt']).optional(),
        order: z.enum(['asc', 'desc']).optional(),
      }),
    },
    responses: { ...commonErrorResponses, ...ok(DriveNodeListResultDTO, '目录内容') },
  }),
  handler: async (c) => c.json(okBody(await listDriveNodes(c.req.valid('query'))), 200),
});

const searchRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/search', tags: [TAG], summary: '搜索（名称，可选正文全文）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().min(1),
        spaceId: z.coerce.number().int().positive().optional(),
        type: z.enum(DRIVE_NODE_TYPES).optional(),
        extension: z.string().max(32).optional(),
        fullText: queryBool('是否同时检索文本正文'),
        startTime: dateRangeBound('更新时间起'),
        endTime: dateRangeBound('更新时间止'),
      }),
    },
    responses: { ...commonErrorResponses, ...okPaginated(DriveSearchItemDTO, '搜索结果') },
  }),
  handler: async (c) => c.json(okBody(await searchDriveNodes(c.req.valid('query'))), 200),
});

const pagedViewQuery = PaginationQuery.extend({ keyword: z.string().optional(), type: z.enum(DRIVE_NODE_TYPES).optional() });

const sharedRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/shared-with-me', tags: [TAG], summary: '与我共享',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { query: pagedViewQuery },
    responses: { ...commonErrorResponses, ...okPaginated(DriveSharedItemDTO, '与我共享') },
  }),
  handler: async (c) => c.json(okBody(await listSharedWithMe(c.req.valid('query'))), 200),
});

const starredRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/starred', tags: [TAG], summary: '我的收藏',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { query: pagedViewQuery },
    responses: { ...commonErrorResponses, ...okPaginated(DriveStarredItemDTO, '收藏') },
  }),
  handler: async (c) => c.json(okBody(await listStarredNodes(c.req.valid('query'))), 200),
});

const recentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/recent', tags: [TAG], summary: '最近访问',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { query: pagedViewQuery },
    responses: { ...commonErrorResponses, ...okPaginated(DriveRecentItemDTO, '最近访问') },
  }),
  handler: async (c) => c.json(okBody(await listRecentNodes(c.req.valid('query'))), 200),
});

// ─── 回收站 ───────────────────────────────────────────────────────────────────

const recycleListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/recycle', tags: [TAG], summary: '回收站',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:recycle:list' })] as const,
    request: { query: pagedViewQuery.extend({ spaceId: z.coerce.number().int().positive().optional() }) },
    responses: { ...commonErrorResponses, ...okPaginated(DriveRecycleItemDTO, '回收站') },
  }),
  handler: async (c) => c.json(okBody(await listRecycleNodes(c.req.valid('query'))), 200),
});

const recycleRestoreRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/recycle/restore', tags: [TAG], summary: '从回收站还原',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:recycle:restore', audit: { description: '还原网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveNodeIdsSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已还原') },
  }),
  handler: async (c) => {
    const count = await restoreDriveNodes(c.req.valid('json').ids);
    return c.json(okBody(null, `已还原 ${count} 个项目`), 200);
  },
});

const recyclePurgeRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/recycle/purge', tags: [TAG], summary: '彻底删除',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:recycle:purge', audit: { description: '彻底删除网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveNodeIdsSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已彻底删除') },
  }),
  handler: async (c) => {
    const count = await purgeDriveNodes(c.req.valid('json').ids);
    return c.json(okBody(null, `已彻底删除 ${count} 个节点`), 200);
  },
});

const recycleEmptyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/recycle', tags: [TAG], summary: '清空回收站（可按空间）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:recycle:purge', audit: { description: '清空网盘回收站', ...AUDIT } })] as const,
    request: { query: z.object({ spaceId: z.coerce.number().int().positive().optional() }) },
    responses: { ...commonErrorResponses, ...okMsg('已清空') },
  }),
  handler: async (c) => {
    const count = await emptyRecycle(c.req.valid('query').spaceId);
    return c.json(okBody(null, `已彻底删除 ${count} 个节点`), 200);
  },
});

// ─── 新建 / 重命名 / 移动 / 复制 / 删除 ─────────────────────────────────────────

const createFolderRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/folder', tags: [TAG], summary: '新建文件夹',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '新建网盘文件夹', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(createDriveFolderSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '创建成功') },
  }),
  handler: async (c) => c.json(okBody(await createDriveFolder(c.req.valid('json')), '创建成功'), 200),
});

const moveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/move', tags: [TAG], summary: '移动到目标目录（同空间）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '移动网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(moveDriveNodesSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已移动') },
  }),
  handler: async (c) => {
    const count = await moveDriveNodes(c.req.valid('json'));
    return c.json(okBody(null, `已移动 ${count} 个项目`), 200);
  },
});

const copyRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/copy', tags: [TAG], summary: '复制到目标目录（大目录树转任务中心）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '复制网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(copyDriveNodesSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveCopyResultDTO, '复制结果') },
  }),
  handler: async (c) => c.json(okBody(await copyDriveNodes(c.req.valid('json'))), 200),
});

const batchDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/batch', tags: [TAG], summary: '删除到回收站',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:delete', audit: { description: '删除网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveNodeIdsSchema), required: true } },
    responses: { ...commonErrorResponses, ...okMsg('已删除') },
  }),
  handler: async (c) => {
    const count = await deleteDriveNodes(c.req.valid('json').ids);
    return c.json(okBody(null, `已删除 ${count} 个项目到回收站`), 200);
  },
});

const batchDownloadRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/batch-download', tags: [TAG], summary: '打包下载（小批量同步 zip，大批量返回任务）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:download', audit: { description: '打包下载网盘文件', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveNodeIdsSchema), required: true } },
    responses: {
      ...commonErrorResponses,
      200: {
        content: {
          'application/json': { schema: DriveBatchDownloadResultDTO },
          'application/zip': { schema: z.string().openapi({ format: 'binary' }) },
        },
        description: '同步打包返回 zip 流；超过阈值返回任务信息',
      },
    },
  }),
  handler: async (c) => {
    const result = await batchDownloadDriveNodes(c.req.valid('json').ids);
    if (result.mode === 'task') return c.json(okBody(result.result, '文件较多，已转为后台打包，完成后通知'), 200);
    return new Response(result.stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
});

// ─── 上传 ─────────────────────────────────────────────────────────────────────

const precheckRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/precheck', tags: [TAG], summary: '上传预检（冲突 / 配额 / 秒传）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload' })] as const,
    request: { body: { content: jsonContent(driveUploadPrecheckSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveUploadPrecheckDTO, '预检结果') },
  }),
  handler: async (c) => c.json(okBody(await precheckDriveUpload(c.req.valid('json'))), 200),
});

const uploadRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/upload', tags: [TAG], summary: '简单上传（≤ 5MB 单请求）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload', audit: { description: '上传网盘文件', recordBody: false, ...AUDIT } })] as const,
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().openapi({ type: 'string', format: 'binary' }),
              spaceId: z.string(),
              parentId: z.string().optional(),
              conflictPolicy: z.enum(DRIVE_UPLOAD_CONFLICT_POLICIES).optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(DriveNodeDTO, '上传成功'),
      400: { content: jsonContent(ErrorResponse), description: '未选择文件 / 参数缺失 / 超过阈值' },
      409: { content: jsonContent(ErrorResponse), description: '同名文件已存在' },
    },
  }),
  handler: async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (typeof (file as File)?.arrayBuffer !== 'function') return c.json(errBody('请选择要上传的文件', 400), 400);
    const spaceId = Number(body.spaceId);
    if (!Number.isInteger(spaceId) || spaceId <= 0) return c.json(errBody('缺少 spaceId', 400), 400);
    const parentRaw = body.parentId ? Number(body.parentId) : null;
    const parentId = parentRaw && Number.isInteger(parentRaw) && parentRaw > 0 ? parentRaw : null;
    const policyRaw = String(body.conflictPolicy ?? 'rename');
    const conflictPolicy = (DRIVE_UPLOAD_CONFLICT_POLICIES as readonly string[]).includes(policyRaw) ? policyRaw as typeof DRIVE_UPLOAD_CONFLICT_POLICIES[number] : 'rename';
    const node = await simpleDriveUpload(file as File, { spaceId, parentId, conflictPolicy });
    return c.json(okBody(node, '上传成功'), 200);
  },
});

const uploadInitRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/upload/init', tags: [TAG], summary: '初始化分片上传',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload', audit: { description: '初始化网盘分片上传', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveUploadInitSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveUploadInitDTO, '初始化成功') },
  }),
  handler: async (c) => c.json(okBody(await initDriveUpload(c.req.valid('json'))), 200),
});

const uploadChunkRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/upload/chunk', tags: [TAG], summary: '上传单个分片',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload' })] as const,
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              uploadId: z.string(),
              index: z.string(),
              chunk: z.any().openapi({ type: 'string', format: 'binary' }),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(DriveUploadChunkResultDTO, '分片已接收'),
      400: { content: jsonContent(ErrorResponse), description: '分片参数不完整' },
    },
  }),
  handler: async (c) => {
    const body = await c.req.parseBody();
    const uploadId = String(body.uploadId ?? '');
    const index = Number(body.index);
    const chunk = body.chunk;
    if (!uploadId || !Number.isFinite(index) || typeof (chunk as File)?.arrayBuffer !== 'function') {
      return c.json(errBody('分片参数不完整', 400), 400);
    }
    return c.json(okBody(await uploadDriveChunk(uploadId, index, chunk as File)), 200);
  },
});

const uploadCompleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/upload/complete', tags: [TAG], summary: '完成分片上传并落地为节点',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload', audit: { description: '完成网盘分片上传', ...AUDIT } })] as const,
    request: { body: { content: jsonContent(driveUploadCompleteSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '上传完成'), 409: { content: jsonContent(ErrorResponse), description: '同名文件已存在' } },
  }),
  handler: async (c) => c.json(okBody(await completeDriveUpload(c.req.valid('json')), '上传成功'), 200),
});

const uploadStatusRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/upload/{uploadId}/status', tags: [TAG], summary: '分片上传进度',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload' })] as const,
    request: { params: UploadIdParam },
    responses: { ...commonErrorResponses, ...ok(DriveUploadStatusDTO, '上传进度') },
  }),
  handler: async (c) => c.json(okBody(await getDriveUploadStatus(c.req.valid('param').uploadId)), 200),
});

const uploadAbortRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/upload/{uploadId}', tags: [TAG], summary: '中止分片上传',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload' })] as const,
    request: { params: UploadIdParam },
    responses: { ...commonErrorResponses, ...okMsg('已中止') },
  }),
  handler: async (c) => {
    await abortDriveUpload(c.req.valid('param').uploadId);
    return c.json(okBody(null, '已中止'), 200);
  },
});

router.openapiRoutes([
  listRoute, searchRoute, sharedRoute, starredRoute, recentRoute,
  recycleListRoute, recycleRestoreRoute, recyclePurgeRoute, recycleEmptyRoute,
  createFolderRoute, moveRoute, copyRoute, batchDeleteRoute, batchDownloadRoute,
  precheckRoute, uploadRoute, uploadInitRoute, uploadChunkRoute, uploadCompleteRoute, uploadStatusRoute, uploadAbortRoute,
] as const);

export default router;
