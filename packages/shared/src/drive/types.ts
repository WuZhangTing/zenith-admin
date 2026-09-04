import type { EntityStatus } from '../core/types';
import type {
  DriveActivityAction,
  DriveNodeType,
  DriveRole,
  DriveSharePermission,
  DriveSpaceType,
  DriveSubjectType,
} from './constants';

// ─── 空间 ─────────────────────────────────────────────────────────────────────

export interface DriveSpace {
  id: number;
  type: DriveSpaceType;
  name: string;
  description: string | null;
  icon: string | null;
  ownerId: number | null;
  ownerName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  defaultMemberRole: DriveRole | null;
  /** 生效配额（字节）；0 = 不限 */
  quotaBytes: number;
  /** 空间行上显式设置的配额；null = 跟随系统默认 */
  customQuotaBytes: number | null;
  usedBytes: number;
  maxVersions: number | null;
  allowExternalShare: boolean;
  status: EntityStatus;
  sort: number;
  tenantId: number | null;
  /** 当前用户在该空间的有效角色（列表 / 详情附带） */
  myRole?: DriveRole | null;
  memberCount?: number;
  nodeCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveSpaceMember {
  spaceId: number;
  subjectType: DriveSubjectType;
  subjectId: number;
  subjectName: string | null;
  role: DriveRole;
  createdAt: string;
}

// ─── 节点 ─────────────────────────────────────────────────────────────────────

export interface DriveTag {
  id: number;
  spaceId: number;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveNode {
  id: number;
  spaceId: number;
  parentId: number | null;
  ancestorIds: number[];
  depth: number;
  type: DriveNodeType;
  name: string;
  extension: string | null;
  mimeType: string | null;
  fileId: string | null;
  size: number;
  contentHash: string | null;
  currentVersion: number;
  inheritPermissions: boolean;
  lockedBy: number | null;
  lockedByName: string | null;
  lockedAt: string | null;
  lockExpiresAt: string | null;
  /** 缩略图访问地址（鉴权代理）；无缩略图为 null */
  thumbnailUrl: string | null;
  /** 文件内容鉴权地址：/api/drive/nodes/{id}/content；folder 为 null */
  url: string | null;
  deletedAt: string | null;
  deletedBy: number | null;
  deletedByName: string | null;
  isStarred?: boolean;
  /** 当前用户对该节点的有效角色 */
  myRole?: DriveRole | null;
  tags?: DriveTag[];
  createdBy: number | null;
  createdByName: string | null;
  updatedBy: number | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriveBreadcrumb {
  id: number;
  name: string;
}

export interface DriveNodeListResult {
  list: DriveNode[];
  total: number;
  page: number;
  pageSize: number;
  space: Pick<DriveSpace, 'id' | 'name' | 'type' | 'quotaBytes' | 'usedBytes' | 'allowExternalShare'>;
  /** 当前目录；根级为 null */
  parent: DriveNode | null;
  breadcrumbs: DriveBreadcrumb[];
  /** 当前用户在当前目录的有效角色 */
  myRole: DriveRole | null;
}

export interface DriveNodeDetail extends DriveNode {
  spaceName: string;
  spaceType: DriveSpaceType;
  breadcrumbs: DriveBreadcrumb[];
  versionCount: number;
  shareLinkCount: number;
  /** 文件夹：直接子项数；文件：0 */
  childCount: number;
}

export interface DriveRecentItem extends DriveNode {
  spaceName: string;
  lastAccessAt: string;
  lastAction: DriveActivityAction;
}

export interface DriveSharedItem extends DriveNode {
  spaceName: string;
  /** 授权来源：直接授权给我 / 我所在部门 / 角色 / 用户组 */
  grantedVia: DriveSubjectType;
  grantedRole: DriveRole;
}

export interface DriveSearchItem extends DriveNode {
  spaceName: string;
  /** 全文命中片段（仅正文命中时） */
  snippet: string | null;
}

// ─── 授权 ─────────────────────────────────────────────────────────────────────

export interface DriveNodePermission {
  id: number;
  nodeId: number;
  subjectType: DriveSubjectType;
  subjectId: number;
  subjectName: string | null;
  role: DriveRole;
  expireAt: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  /** 继承来源节点（直接授权为 null） */
  inheritedFrom: DriveBreadcrumb | null;
}

export interface DriveNodePermissionsResult {
  nodeId: number;
  inheritPermissions: boolean;
  /** 空间层给当前用户的角色 */
  spaceRole: DriveRole | null;
  /** 当前用户的有效角色 */
  effectiveRole: DriveRole | null;
  direct: DriveNodePermission[];
  inherited: DriveNodePermission[];
}

// ─── 版本 ─────────────────────────────────────────────────────────────────────

export interface DriveFileVersion {
  id: number;
  nodeId: number;
  version: number;
  fileId: string;
  size: number;
  contentHash: string | null;
  comment: string | null;
  authorId: number | null;
  authorName: string | null;
  isCurrent: boolean;
  /** 该版本内容的鉴权地址 */
  url: string;
  createdAt: string;
}

// ─── 上传 ─────────────────────────────────────────────────────────────────────

export interface DriveUploadPrecheck {
  /** 同目录是否存在同名未删除节点 */
  conflict: boolean;
  existingNodeId: number | null;
  quotaOk: boolean;
  /** 剩余配额（字节）；不限为 null */
  quotaRemaining: number | null;
  /** 是否可秒传（内容哈希已存在） */
  instant: boolean;
  /** 已按秒传直接创建的节点（instant 且 conflictPolicy 可解决时） */
  node: DriveNode | null;
}

export interface DriveUploadInit {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  received: number[];
}

export interface DriveUploadChunkResult {
  index: number;
  received: number[];
}

// ─── 外链 ─────────────────────────────────────────────────────────────────────

export interface DriveShareLink {
  id: number;
  nodeId: number;
  nodeName: string;
  nodeType: DriveNodeType;
  spaceId: number;
  token: string;
  /** 前端公开页相对地址 /public/drive/{token} */
  url: string;
  hasPassword: boolean;
  permission: DriveSharePermission;
  enabled: boolean;
  expireAt: string | null;
  maxAccessCount: number | null;
  accessCount: number;
  downloadCount: number;
  revokedAt: string | null;
  remark: string | null;
  /** 派生状态：active / expired / exhausted / disabled / revoked */
  state: DriveShareLinkState;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DriveShareLinkState = 'active' | 'expired' | 'exhausted' | 'disabled' | 'revoked';

export interface DrivePublicShareMeta {
  token: string;
  permission: DriveSharePermission;
  requirePassword: boolean;
  /** 已通过密码校验（或无需密码）时返回节点信息，否则为 null */
  node: DrivePublicNode | null;
  expireAt: string | null;
  sharerName: string | null;
}

export interface DrivePublicNode {
  id: number;
  parentId: number | null;
  type: DriveNodeType;
  name: string;
  extension: string | null;
  mimeType: string | null;
  size: number;
  /** 公开内容地址（需附带 session 头）：/api/drive/public/shares/{token}/nodes/{id}/content */
  url: string | null;
  updatedAt: string;
}

export interface DrivePublicShareSession {
  session: string;
  expiresAt: string;
}

export interface DriveShareAccessLog {
  id: number;
  shareId: number;
  nodeId: number;
  action: string;
  clientIp: string | null;
  ok: boolean;
  createdAt: string;
}

// ─── 动态 ─────────────────────────────────────────────────────────────────────

export interface DriveActivity {
  id: number;
  spaceId: number;
  spaceName?: string | null;
  nodeId: number | null;
  nodeName: string;
  nodeType: DriveNodeType;
  action: DriveActivityAction;
  actorId: number | null;
  actorName: string | null;
  shareId: number | null;
  detail: Record<string, unknown> | null;
  clientIp: string | null;
  createdAt: string;
}

// ─── 评论 ─────────────────────────────────────────────────────────────────────

export interface DriveNodeComment {
  id: number;
  nodeId: number;
  parentId: number | null;
  content: string;
  authorId: number | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── 统计 / 设置 ──────────────────────────────────────────────────────────────

export interface DriveAdminStats {
  spaceCount: number;
  spaceCountByType: Record<DriveSpaceType, number>;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  recycleBytes: number;
  versionBytes: number;
  activeShareLinks: number;
  todayUploads: number;
  todayDownloads: number;
  topSpaces: Array<{ id: number; name: string; type: DriveSpaceType; usedBytes: number; quotaBytes: number }>;
  typeDistribution: Array<{ category: string; count: number; bytes: number }>;
  dailyTrend: Array<{ date: string; uploads: number; downloads: number }>;
}

export interface DriveSettings {
  personalQuotaGb: number;
  departmentQuotaGb: number;
  teamQuotaGb: number;
  departmentSpaceAutoCreate: boolean;
  recycleRetentionDays: number;
  maxVersions: number;
  quotaWarningPercent: number;
  externalShareEnabled: boolean;
  externalShareMaxDays: number;
  externalShareRequirePassword: boolean;
  blockedExtensions: string;
  thumbnailEnabled: boolean;
  textIndexEnabled: boolean;
}

/** 批量打包：小于阈值同步返回 zip；否则返回任务 */
export interface DriveBatchDownloadResult {
  mode: 'sync' | 'task';
  taskId: number | null;
}

/** 复制：小于阈值同步完成；否则返回任务 */
export interface DriveCopyResult {
  mode: 'sync' | 'task';
  taskId: number | null;
  copied: number;
}
