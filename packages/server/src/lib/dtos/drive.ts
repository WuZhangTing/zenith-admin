import { z } from '@hono/zod-openapi';
import {
  DRIVE_ACTIVITY_ACTIONS,
  DRIVE_NODE_TYPES,
  DRIVE_ROLES,
  DRIVE_SHARE_PERMISSIONS,
  DRIVE_SPACE_TYPES,
  DRIVE_SUBJECT_TYPES,
} from '@zenith/shared/drive';
import { auditFields } from './_audit';

const roleEnum = z.enum(DRIVE_ROLES);
const nullableRole = roleEnum.nullable();

// ─── 空间 ─────────────────────────────────────────────────────────────────────

export const DriveSpaceDTO = z
  .object({
    id: z.number().int(),
    type: z.enum(DRIVE_SPACE_TYPES),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    ownerId: z.number().int().nullable(),
    ownerName: z.string().nullable(),
    departmentId: z.number().int().nullable(),
    departmentName: z.string().nullable(),
    defaultMemberRole: nullableRole,
    quotaBytes: z.number().int().openapi({ description: '生效配额（字节）；0 = 不限' }),
    customQuotaBytes: z.number().int().nullable(),
    usedBytes: z.number().int(),
    maxVersions: z.number().int().nullable(),
    allowExternalShare: z.boolean(),
    status: z.enum(['enabled', 'disabled']),
    sort: z.number().int(),
    tenantId: z.number().int().nullable(),
    myRole: nullableRole.optional(),
    memberCount: z.number().int().optional(),
    nodeCount: z.number().int().optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DriveSpace');

export const DriveSpaceMemberDTO = z
  .object({
    spaceId: z.number().int(),
    subjectType: z.enum(DRIVE_SUBJECT_TYPES),
    subjectId: z.number().int(),
    subjectName: z.string().nullable(),
    role: roleEnum,
    createdAt: z.string(),
  })
  .openapi('DriveSpaceMember');

// ─── 节点 ─────────────────────────────────────────────────────────────────────

export const DriveTagDTO = z
  .object({
    id: z.number().int(),
    spaceId: z.number().int(),
    name: z.string(),
    color: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DriveTag');

const nodeShape = {
  id: z.number().int(),
  spaceId: z.number().int(),
  parentId: z.number().int().nullable(),
  ancestorIds: z.array(z.number().int()),
  depth: z.number().int(),
  type: z.enum(DRIVE_NODE_TYPES),
  name: z.string(),
  extension: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileId: z.string().nullable(),
  size: z.number().int(),
  contentHash: z.string().nullable(),
  currentVersion: z.number().int(),
  inheritPermissions: z.boolean(),
  lockedBy: z.number().int().nullable(),
  lockedByName: z.string().nullable(),
  lockedAt: z.string().nullable(),
  lockExpiresAt: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  url: z.string().nullable(),
  deletedAt: z.string().nullable(),
  deletedBy: z.number().int().nullable(),
  deletedByName: z.string().nullable(),
  isStarred: z.boolean().optional(),
  myRole: nullableRole.optional(),
  tags: z.array(DriveTagDTO).optional(),
  createdBy: z.number().int().nullable(),
  createdByName: z.string().nullable(),
  updatedBy: z.number().int().nullable(),
  updatedByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const DriveNodeDTO = z.object(nodeShape).openapi('DriveNode');

export const DriveBreadcrumbDTO = z.object({ id: z.number().int(), name: z.string() }).openapi('DriveBreadcrumb');

export const DriveNodeListResultDTO = z
  .object({
    list: z.array(DriveNodeDTO),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    space: z.object({
      id: z.number().int(),
      name: z.string(),
      type: z.enum(DRIVE_SPACE_TYPES),
      quotaBytes: z.number().int(),
      usedBytes: z.number().int(),
      allowExternalShare: z.boolean(),
    }),
    parent: DriveNodeDTO.nullable(),
    breadcrumbs: z.array(DriveBreadcrumbDTO),
    myRole: nullableRole,
  })
  .openapi('DriveNodeListResult');

export const DriveNodeDetailDTO = z
  .object({
    ...nodeShape,
    spaceName: z.string(),
    spaceType: z.enum(DRIVE_SPACE_TYPES),
    breadcrumbs: z.array(DriveBreadcrumbDTO),
    versionCount: z.number().int(),
    shareLinkCount: z.number().int(),
    childCount: z.number().int(),
  })
  .openapi('DriveNodeDetail');

export const DriveRecycleItemDTO = z.object({ ...nodeShape, spaceName: z.string() }).openapi('DriveRecycleItem');

export const DriveRecentItemDTO = z
  .object({ ...nodeShape, spaceName: z.string(), lastAccessAt: z.string(), lastAction: z.enum(DRIVE_ACTIVITY_ACTIONS) })
  .openapi('DriveRecentItem');

export const DriveSharedItemDTO = z
  .object({ ...nodeShape, spaceName: z.string(), grantedVia: z.enum(DRIVE_SUBJECT_TYPES), grantedRole: roleEnum })
  .openapi('DriveSharedItem');

export const DriveSearchItemDTO = z
  .object({ ...nodeShape, spaceName: z.string(), snippet: z.string().nullable() })
  .openapi('DriveSearchItem');

export const DriveStarredItemDTO = z.object({ ...nodeShape, spaceName: z.string() }).openapi('DriveStarredItem');

export const DriveCopyResultDTO = z
  .object({ mode: z.enum(['sync', 'task']), taskId: z.number().int().nullable(), copied: z.number().int() })
  .openapi('DriveCopyResult');

export const DriveBatchDownloadResultDTO = z
  .object({ mode: z.enum(['sync', 'task']), taskId: z.number().int().nullable() })
  .openapi('DriveBatchDownloadResult');

// ─── 授权 ─────────────────────────────────────────────────────────────────────

export const DriveNodePermissionDTO = z
  .object({
    id: z.number().int(),
    nodeId: z.number().int(),
    subjectType: z.enum(DRIVE_SUBJECT_TYPES),
    subjectId: z.number().int(),
    subjectName: z.string().nullable(),
    role: roleEnum,
    expireAt: z.string().nullable(),
    createdBy: z.number().int().nullable(),
    createdByName: z.string().nullable(),
    createdAt: z.string(),
    inheritedFrom: DriveBreadcrumbDTO.nullable(),
  })
  .openapi('DriveNodePermission');

export const DriveNodePermissionsResultDTO = z
  .object({
    nodeId: z.number().int(),
    inheritPermissions: z.boolean(),
    spaceRole: nullableRole,
    effectiveRole: nullableRole,
    direct: z.array(DriveNodePermissionDTO),
    inherited: z.array(DriveNodePermissionDTO),
  })
  .openapi('DriveNodePermissionsResult');

// ─── 版本 / 上传 ──────────────────────────────────────────────────────────────

export const DriveFileVersionDTO = z
  .object({
    id: z.number().int(),
    nodeId: z.number().int(),
    version: z.number().int(),
    fileId: z.string(),
    size: z.number().int(),
    contentHash: z.string().nullable(),
    comment: z.string().nullable(),
    authorId: z.number().int().nullable(),
    authorName: z.string().nullable(),
    isCurrent: z.boolean(),
    url: z.string(),
    createdAt: z.string(),
  })
  .openapi('DriveFileVersion');

export const DriveUploadPrecheckDTO = z
  .object({
    conflict: z.boolean(),
    existingNodeId: z.number().int().nullable(),
    quotaOk: z.boolean(),
    quotaRemaining: z.number().int().nullable(),
    instant: z.boolean(),
    node: DriveNodeDTO.nullable(),
  })
  .openapi('DriveUploadPrecheck');

export const DriveUploadInitDTO = z
  .object({
    uploadId: z.string(),
    chunkSize: z.number().int(),
    totalChunks: z.number().int(),
    received: z.array(z.number().int()),
  })
  .openapi('DriveUploadInit');

export const DriveUploadChunkResultDTO = z
  .object({ index: z.number().int(), received: z.array(z.number().int()) })
  .openapi('DriveUploadChunkResult');

export const DriveUploadStatusDTO = z
  .object({
    uploadId: z.string(),
    status: z.enum(['uploading', 'completed', 'aborted']),
    chunkSize: z.number().int(),
    totalChunks: z.number().int(),
    received: z.array(z.number().int()),
  })
  .openapi('DriveUploadStatus');

export const DriveAccessUrlDTO = z
  .object({
    url: z.string(),
    strategy: z.enum(['proxy', 'public', 'presigned']),
    expiresAt: z.string().nullable(),
  })
  .openapi('DriveAccessUrl');

// ─── 外链 ─────────────────────────────────────────────────────────────────────

const shareStateEnum = z.enum(['active', 'expired', 'exhausted', 'disabled', 'revoked']);

export const DriveShareLinkDTO = z
  .object({
    id: z.number().int(),
    nodeId: z.number().int(),
    nodeName: z.string(),
    nodeType: z.enum(DRIVE_NODE_TYPES),
    spaceId: z.number().int(),
    token: z.string(),
    url: z.string(),
    hasPassword: z.boolean(),
    permission: z.enum(DRIVE_SHARE_PERMISSIONS),
    enabled: z.boolean(),
    expireAt: z.string().nullable(),
    maxAccessCount: z.number().int().nullable(),
    accessCount: z.number().int(),
    downloadCount: z.number().int(),
    revokedAt: z.string().nullable(),
    remark: z.string().nullable(),
    state: shareStateEnum,
    createdBy: z.number().int().nullable(),
    createdByName: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DriveShareLink');

export const DriveShareAccessLogDTO = z
  .object({
    id: z.number().int(),
    shareId: z.number().int(),
    nodeId: z.number().int(),
    action: z.string(),
    clientIp: z.string().nullable(),
    ok: z.boolean(),
    createdAt: z.string(),
  })
  .openapi('DriveShareAccessLog');

export const DrivePublicNodeDTO = z
  .object({
    id: z.number().int(),
    parentId: z.number().int().nullable(),
    type: z.enum(DRIVE_NODE_TYPES),
    name: z.string(),
    extension: z.string().nullable(),
    mimeType: z.string().nullable(),
    size: z.number().int(),
    url: z.string().nullable(),
    updatedAt: z.string(),
  })
  .openapi('DrivePublicNode');

export const DrivePublicShareMetaDTO = z
  .object({
    token: z.string(),
    permission: z.enum(DRIVE_SHARE_PERMISSIONS),
    requirePassword: z.boolean(),
    node: DrivePublicNodeDTO.nullable(),
    expireAt: z.string().nullable(),
    sharerName: z.string().nullable(),
  })
  .openapi('DrivePublicShareMeta');

export const DrivePublicShareSessionDTO = z
  .object({
    session: z.string(),
    expiresAt: z.string(),
    meta: DrivePublicShareMetaDTO,
  })
  .openapi('DrivePublicShareSession');

// ─── 动态 / 评论 / 统计 / 设置 ────────────────────────────────────────────────

export const DriveActivityDTO = z
  .object({
    id: z.number().int(),
    spaceId: z.number().int(),
    spaceName: z.string().nullable().optional(),
    nodeId: z.number().int().nullable(),
    nodeName: z.string(),
    nodeType: z.enum(DRIVE_NODE_TYPES),
    action: z.enum(DRIVE_ACTIVITY_ACTIONS),
    actorId: z.number().int().nullable(),
    actorName: z.string().nullable(),
    shareId: z.number().int().nullable(),
    detail: z.record(z.string(), z.unknown()).nullable(),
    clientIp: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('DriveActivity');

export const DriveNodeCommentDTO = z
  .object({
    id: z.number().int(),
    nodeId: z.number().int(),
    parentId: z.number().int().nullable(),
    content: z.string(),
    authorId: z.number().int().nullable(),
    authorName: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DriveNodeComment');

export const DriveAdminStatsDTO = z
  .object({
    spaceCount: z.number().int(),
    spaceCountByType: z.object({ personal: z.number().int(), department: z.number().int(), team: z.number().int() }),
    fileCount: z.number().int(),
    folderCount: z.number().int(),
    totalBytes: z.number().int(),
    recycleBytes: z.number().int(),
    versionBytes: z.number().int(),
    activeShareLinks: z.number().int(),
    todayUploads: z.number().int(),
    todayDownloads: z.number().int(),
    topSpaces: z.array(z.object({ id: z.number().int(), name: z.string(), type: z.enum(DRIVE_SPACE_TYPES), usedBytes: z.number().int(), quotaBytes: z.number().int() })),
    typeDistribution: z.array(z.object({ category: z.string(), count: z.number().int(), bytes: z.number().int() })),
    dailyTrend: z.array(z.object({ date: z.string(), uploads: z.number().int(), downloads: z.number().int() })),
  })
  .openapi('DriveAdminStats');

export const DriveSettingsDTO = z
  .object({
    personalQuotaGb: z.number(),
    departmentQuotaGb: z.number(),
    teamQuotaGb: z.number(),
    departmentSpaceAutoCreate: z.boolean(),
    recycleRetentionDays: z.number().int(),
    maxVersions: z.number().int(),
    quotaWarningPercent: z.number().int(),
    externalShareEnabled: z.boolean(),
    externalShareMaxDays: z.number().int(),
    externalShareRequirePassword: z.boolean(),
    blockedExtensions: z.string(),
    thumbnailEnabled: z.boolean(),
    textIndexEnabled: z.boolean(),
  })
  .openapi('DriveSettings');
