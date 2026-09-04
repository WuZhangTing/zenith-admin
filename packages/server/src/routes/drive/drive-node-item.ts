import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  createDriveNodeCommentSchema,
  createDriveShareLinkSchema,
  lockDriveNodeSchema,
  renameDriveNodeSchema,
  saveDriveNodePermissionsSchema,
  setDriveNodeInheritSchema,
  setDriveNodeTagsSchema,
} from '@zenith/shared/drive';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditAfterData, setAuditBeforeData } from '../../middleware/guard';
import { ErrorResponse, IdParam, PaginationQuery, commonErrorResponses, errBody, jsonContent, ok, okBody, okMsg, okPaginated, queryBool, validationHook } from '../../lib/openapi-schemas';
import {
  DriveAccessUrlDTO,
  DriveActivityDTO,
  DriveFileVersionDTO,
  DriveNodeCommentDTO,
  DriveNodeDTO,
  DriveNodeDetailDTO,
  DriveNodePermissionsResultDTO,
  DriveShareLinkDTO,
} from '../../lib/openapi-dtos';
import { parseRangeHeader, rangeNotSatisfiable, supportsRange } from '../../lib/http-range';
import { ensureNodeRole } from '../../services/drive/drive-access.service';
import { getDriveNodeAccessUrl, openDriveNodeContent, prepareDriveNodeContent, readDriveNodeThumbnail } from '../../services/drive/drive-content.service';
import { listNodeActivities } from '../../services/drive/drive-activity.service';
import { ensureDriveNodeExists, getDriveNodeDetail, renameDriveNode } from '../../services/drive/drive-nodes.service';
import { getDriveNodePermissions, getDriveNodePermissionsBeforeAudit, saveDriveNodePermissions, setDriveNodeInherit } from '../../services/drive/drive-permissions.service';
import { deleteDriveNodeVersion, listDriveNodeVersions, restoreDriveNodeVersion, uploadDriveNodeVersion } from '../../services/drive/drive-upload.service';
import { setDriveNodeStar } from '../../services/drive/drive-views.service';
import { createDriveNodeComment, deleteDriveNodeComment, listDriveNodeComments, lockDriveNode, setDriveNodeTags, unlockDriveNode } from '../../services/drive/drive-extras.service';
import { createDriveShareLink, listNodeShareLinks } from '../../services/drive/drive-share.service';
import { binaryResponses, streamStoredContent } from './drive-nodes';

/**
 * /api/drive/nodes/{id}/... 单节点路由。
 * 与 drive-nodes.ts（静态路径）拆成两个路由器顺序挂载在同一路径：静态路径先于 /{id}，
 * 同时避免单个 openapiRoutes 元组过大触发 TS2589。
 */
const router = new OpenAPIHono({ defaultHook: validationHook });
const TAG = '企业网盘-文件';
const AUDIT = { module: '企业网盘' } as const;

const NodeIdParam = IdParam;
const VersionParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' }, example: 1 }),
  version: z.coerce.number().int().positive().openapi({ param: { name: 'version', in: 'path' }, example: 2 }),
});
// ─── 单节点 ───────────────────────────────────────────────────────────────────

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: [TAG], summary: '节点详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDetailDTO, '详情') },
  }),
  handler: async (c) => c.json(okBody(await getDriveNodeDetail(c.req.valid('param').id)), 200),
});

const renameRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/rename', tags: [TAG], summary: '重命名',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '重命名网盘文件', ...AUDIT } })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(renameDriveNodeSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '已重命名') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const before = await ensureDriveNodeExists(id);
    setAuditBeforeData(c, { id, name: before.name });
    return c.json(okBody(await renameDriveNode(id, c.req.valid('json').name), '已重命名'), 200);
  },
});

const contentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/content', tags: [TAG], summary: '文件内容（预览需 viewer；?download=1 需 downloader）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam, query: z.object({ download: queryBool('以附件方式下载'), version: z.coerce.number().int().positive().optional() }) },
    responses: binaryResponses,
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { download, version } = c.req.valid('query');
    const prepared = await prepareDriveNodeContent(id, !!download, version);
    const { file, node } = prepared;
    const range = supportsRange(file.provider) ? parseRangeHeader(c.req.header('range'), file.size) : null;
    if (range === 'invalid') return rangeNotSatisfiable(file.size, { 'Cache-Control': 'private, no-store' });
    const stored = await openDriveNodeContent(prepared, range);
    return streamStoredContent({
      stream: stored.stream, contentType: stored.contentType, fileName: node.name, size: file.size,
      provider: file.provider, range, download: !!download, etag: `"d${file.id}-${file.size}"`,
    });
  },
});

const thumbnailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/thumbnail', tags: [TAG], summary: '缩略图',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: binaryResponses,
  }),
  handler: async (c) => {
    const { stored, file } = await readDriveNodeThumbnail(c.req.valid('param').id);
    return new Response(stored.stream, {
      status: 200,
      headers: {
        'Content-Type': stored.contentType,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=86400',
        ETag: `"t${file.id}"`,
      },
    });
  },
});

const accessUrlRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/access-url', tags: [TAG], summary: '解析访问直链（presigned / public；proxy 回落到鉴权地址）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:download' })] as const,
    request: { params: NodeIdParam, query: z.object({ purpose: z.enum(['preview', 'download']).default('download') }) },
    responses: { ...commonErrorResponses, ...ok(DriveAccessUrlDTO, '访问地址') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const { purpose } = c.req.valid('query');
    return c.json(okBody(await getDriveNodeAccessUrl(id, purpose)), 200, { 'Cache-Control': 'private, no-store' });
  },
});

// ─── 版本 ─────────────────────────────────────────────────────────────────────

const versionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/versions', tags: [TAG], summary: '版本列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(DriveFileVersionDTO), '版本列表') },
  }),
  handler: async (c) => c.json(okBody(await listDriveNodeVersions(c.req.valid('param').id)), 200),
});

const uploadVersionRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/versions', tags: [TAG], summary: '上传新版本（≤ 5MB 单请求；大文件用分片 init 传 nodeId）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:upload', audit: { description: '上传网盘文件新版本', recordBody: false, ...AUDIT } })] as const,
    request: {
      params: NodeIdParam,
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({ file: z.any().openapi({ type: 'string', format: 'binary' }), comment: z.string().optional() }),
          },
        },
        required: true,
      },
    },
    responses: {
      ...commonErrorResponses,
      ...ok(DriveNodeDTO, '已上传新版本'),
      400: { content: jsonContent(ErrorResponse), description: '未选择文件或超过阈值' },
    },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const body = await c.req.parseBody();
    const file = body.file;
    if (typeof (file as File)?.arrayBuffer !== 'function') return c.json(errBody('请选择要上传的文件', 400), 400);
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 500) : undefined;
    return c.json(okBody(await uploadDriveNodeVersion(id, file as File, comment), '已上传新版本'), 200);
  },
});

const versionContentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/versions/{version}/content', tags: [TAG], summary: '历史版本内容',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:download' })] as const,
    request: { params: VersionParam },
    responses: binaryResponses,
  }),
  handler: async (c) => {
    const { id, version } = c.req.valid('param');
    const prepared = await prepareDriveNodeContent(id, true, version);
    const stored = await openDriveNodeContent(prepared, null);
    return streamStoredContent({
      stream: stored.stream, contentType: stored.contentType, fileName: `v${version}-${prepared.node.name}`, size: prepared.file.size,
      provider: prepared.file.provider, range: null, download: true, etag: `"d${prepared.file.id}-${prepared.file.size}"`,
    });
  },
});

const versionRestoreRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/versions/{version}/restore', tags: [TAG], summary: '回滚到历史版本（生成新版本）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '回滚网盘文件版本', ...AUDIT } })] as const,
    request: { params: VersionParam },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '已回滚') },
  }),
  handler: async (c) => {
    const { id, version } = c.req.valid('param');
    return c.json(okBody(await restoreDriveNodeVersion(id, version), '已回滚'), 200);
  },
});

const versionDeleteRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/versions/{version}', tags: [TAG], summary: '删除历史版本',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:delete', audit: { description: '删除网盘文件历史版本', ...AUDIT } })] as const,
    request: { params: VersionParam },
    responses: { ...commonErrorResponses, ...okMsg('已删除') },
  }),
  handler: async (c) => {
    const { id, version } = c.req.valid('param');
    await deleteDriveNodeVersion(id, version);
    return c.json(okBody(null, '已删除'), 200);
  },
});

// ─── 授权 ─────────────────────────────────────────────────────────────────────

const permissionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/permissions', tags: [TAG], summary: '节点授权（直接 + 继承）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(DriveNodePermissionsResultDTO, '授权信息') },
  }),
  handler: async (c) => c.json(okBody(await getDriveNodePermissions(c.req.valid('param').id)), 200),
});

const savePermissionsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/permissions', tags: [TAG], summary: '全量保存节点直接授权（需 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:grant', audit: { description: '保存网盘节点授权', ...AUDIT } })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(saveDriveNodePermissionsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodePermissionsResultDTO, '保存成功') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getDriveNodePermissionsBeforeAudit(id));
    const result = await saveDriveNodePermissions(id, c.req.valid('json'));
    setAuditAfterData(c, await getDriveNodePermissionsBeforeAudit(id));
    return c.json(okBody(result, '保存成功'), 200);
  },
});

const inheritRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/inherit', tags: [TAG], summary: '断开 / 恢复继承（需 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:grant', audit: { description: '变更网盘节点继承', ...AUDIT } })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(setDriveNodeInheritSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodePermissionsResultDTO, '已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await setDriveNodeInherit(id, c.req.valid('json')), '已更新'), 200);
  },
});

// ─── 动态 / 评论 / 收藏 / 标签 / 锁 / 外链 ─────────────────────────────────────

const activitiesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/activities', tags: [TAG], summary: '节点动态',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam, query: PaginationQuery },
    responses: { ...commonErrorResponses, ...okPaginated(DriveActivityDTO, '动态') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    const node = await ensureDriveNodeExists(id, { allowDeleted: true });
    await ensureNodeRole(node, 'viewer', '没有该文件的访问权限');
    return c.json(okBody(await listNodeActivities(id, c.req.valid('query'))), 200);
  },
});

const commentsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/comments', tags: [TAG], summary: '评论列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(DriveNodeCommentDTO), '评论') },
  }),
  handler: async (c) => c.json(okBody(await listDriveNodeComments(c.req.valid('param').id)), 200),
});

const createCommentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/comments', tags: [TAG], summary: '发表评论',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(createDriveNodeCommentSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeCommentDTO, '已评论') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await createDriveNodeComment(id, c.req.valid('json')), '已评论'), 200);
  },
});

const CommentParam = z.object({
  id: z.coerce.number().int().positive().openapi({ param: { name: 'id', in: 'path' }, example: 1 }),
  commentId: z.coerce.number().int().positive().openapi({ param: { name: 'commentId', in: 'path' }, example: 1 }),
});

const deleteCommentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/comments/{commentId}', tags: [TAG], summary: '删除评论（作者或 manager）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: CommentParam },
    responses: { ...commonErrorResponses, ...okMsg('已删除') },
  }),
  handler: async (c) => {
    const { id, commentId } = c.req.valid('param');
    await deleteDriveNodeComment(id, commentId);
    return c.json(okBody(null, '已删除'), 200);
  },
});

const starRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/star', tags: [TAG], summary: '收藏',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...okMsg('已收藏') },
  }),
  handler: async (c) => {
    await setDriveNodeStar(c.req.valid('param').id, true);
    return c.json(okBody(null, '已收藏'), 200);
  },
});

const unstarRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/star', tags: [TAG], summary: '取消收藏',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...okMsg('已取消收藏') },
  }),
  handler: async (c) => {
    await setDriveNodeStar(c.req.valid('param').id, false);
    return c.json(okBody(null, '已取消收藏'), 200);
  },
});

const tagsRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/{id}/tags', tags: [TAG], summary: '设置节点标签',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit' })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(setDriveNodeTagsSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '已更新') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await setDriveNodeTags(id, c.req.valid('json').tagIds), '已更新'), 200);
  },
});

const lockRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/lock', tags: [TAG], summary: '签出锁定',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '锁定网盘文件', ...AUDIT } })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(lockDriveNodeSchema), required: false } },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '已锁定'), 423: { content: jsonContent(ErrorResponse), description: '已被他人锁定' } },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await lockDriveNode(id, c.req.valid('json') ?? {}), '已锁定'), 200);
  },
});

const unlockRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/{id}/lock', tags: [TAG], summary: '解除锁定',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:edit', audit: { description: '解锁网盘文件', ...AUDIT } })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(DriveNodeDTO, '已解锁') },
  }),
  handler: async (c) => c.json(okBody(await unlockDriveNode(c.req.valid('param').id), '已解锁'), 200),
});

const nodeShareLinksRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}/share-links', tags: [TAG], summary: '节点外链（manager 见全部，其他人见自己创建的）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:node:list' })] as const,
    request: { params: NodeIdParam },
    responses: { ...commonErrorResponses, ...ok(z.array(DriveShareLinkDTO), '外链') },
  }),
  handler: async (c) => c.json(okBody(await listNodeShareLinks(c.req.valid('param').id)), 200),
});

const createShareLinkRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/share-links', tags: [TAG], summary: '创建外链（需 editor + drive:link:create）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'drive:link:create', audit: { description: '创建网盘外链', recordBody: false, ...AUDIT } })] as const,
    request: { params: NodeIdParam, body: { content: jsonContent(createDriveShareLinkSchema), required: true } },
    responses: { ...commonErrorResponses, ...ok(DriveShareLinkDTO, '已创建') },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await createDriveShareLink(id, c.req.valid('json')), '已创建'), 200);
  },
});

router.openapiRoutes([
  detailRoute, renameRoute, contentRoute, thumbnailRoute, accessUrlRoute,
  versionsRoute, uploadVersionRoute, versionContentRoute, versionRestoreRoute, versionDeleteRoute,
  permissionsRoute, savePermissionsRoute, inheritRoute,
  activitiesRoute, commentsRoute, createCommentRoute, deleteCommentRoute,
  starRoute, unstarRoute, tagsRoute, lockRoute, unlockRoute,
  nodeShareLinksRoute, createShareLinkRoute,
] as const);

export default router;
