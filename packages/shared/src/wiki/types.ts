import type { WikiCommentStatus, WikiDocStatus, WikiReviewAction, WikiSpaceMemberRole, WikiSpaceVisibility } from './constants';

// ─── 知识空间 ─────────────────────────────────────────────────────────────────

export interface WikiSpace {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  visibility: WikiSpaceVisibility;
  status: 'enabled' | 'disabled';
  sort: number;
  aiSyncEnabled: boolean;
  tenantId?: number | null;
  /** 关联统计（列表 JOIN 附加） */
  memberCount?: number;
  docCount?: number;
  /** 当前用户在该空间的角色；null = 非成员（公开空间只读） */
  myRole?: WikiSpaceMemberRole | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiSpaceMember {
  spaceId: number;
  userId: number;
  role: WikiSpaceMemberRole;
  username?: string;
  nickname?: string | null;
  createdAt: string;
}

// ─── 文档 ─────────────────────────────────────────────────────────────────────

/** 文档附件（business_files 多态关联） */
export interface WikiDocAttachment {
  id: number;
  fileId: string;
  file: {
    id: string;
    originalName: string;
    size: number;
    mimeType: string | null;
    extension: string | null;
    url: string;
    directUrl?: string | null;
  };
  sortOrder: number;
  createdAt: string;
}

export interface WikiDoc {
  id: number;
  spaceId: number;
  spaceName?: string;
  parentId?: number | null;
  title: string;
  summary?: string | null;
  /** 列表接口省略正文，详情接口返回 */
  content?: string;
  status: WikiDocStatus;
  rejectReason?: string | null;
  sort: number;
  isPinned: boolean;
  viewCount: number;
  currentVersion: number;
  /** 乐观锁版本：保存时回传，服务端不一致返回 409 */
  revision: number;
  publishedAt?: string | null;
  deletedAt?: string | null;
  tags?: WikiTag[];
  tagIds?: number[];
  /** 附件（详情接口返回，复用 business_files） */
  attachments?: WikiDocAttachment[];
  /** 搜索接口返回：正文命中片段 */
  snippet?: string;
  /** 当前用户是否已收藏（详情接口附加） */
  favorited?: boolean;
  favoriteCount?: number;
  commentCount?: number;
  /** 当前是否允许发表评论（详情接口附加） */
  commentsEnabled?: boolean;
  /** 当前用户是否已订阅（详情接口附加） */
  subscribed?: boolean;
  /** 发布后要求读者确认已读 */
  requireReadReceipt: boolean;
  /** 当前用户是否已确认已读（详情接口附加） */
  readConfirmed?: boolean;
  /** 已确认人数（详情接口附加） */
  readReceiptCount?: number;
  /** 内容负责人（治理） */
  ownerId?: number | null;
  ownerName?: string | null;
  /** 有效期（治理） */
  expireAt?: string | null;
  /** 复审周期天数（治理） */
  reviewCycleDays?: number | null;
  /** 下次复审时间（治理） */
  nextReviewAt?: string | null;
  /** 归档状态：默认从树/列表/搜索隐藏 */
  isArchived: boolean;
  authorName?: string | null;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 目录树节点（不含正文） */
export interface WikiDocTreeNode {
  id: number;
  parentId: number | null;
  title: string;
  status: WikiDocStatus;
  isPinned: boolean;
  sort: number;
  children?: WikiDocTreeNode[];
}

export interface WikiDocVersion {
  id: number;
  docId: number;
  version: number;
  title: string;
  /** 版本列表省略，详情 / 对比接口返回 */
  content?: string;
  changeNote?: string | null;
  authorId?: number | null;
  authorName?: string | null;
  createdAt: string;
}

// ─── 模板与标签 ───────────────────────────────────────────────────────────────

export interface WikiTemplate {
  id: number;
  name: string;
  description?: string | null;
  content: string;
  status: 'enabled' | 'disabled';
  sort: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiTag {
  id: number;
  name: string;
  color?: string | null;
  docCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── 评论 ─────────────────────────────────────────────────────────────────────

export interface WikiComment {
  id: number;
  docId: number;
  docTitle?: string;
  parentId?: number | null;
  content: string;
  status: WikiCommentStatus;
  mentionedUserIds: number[];
  isQuestion: boolean;
  resolvedAt?: string | null;
  authorId?: number | null;
  authorName?: string | null;
  replies?: WikiComment[];
  createdAt: string;
}

// ─── 审核 ─────────────────────────────────────────────────────────────────────

export interface WikiReviewRecord {
  id: number;
  docId: number;
  docTitle?: string;
  version: number;
  action: WikiReviewAction;
  actorId?: number | null;
  actorName?: string | null;
  reason?: string | null;
  createdAt: string;
}

/** 阅读确认名单（作者 / 空间管理员可见） */
export interface WikiDocReadReceipts {
  confirmed: Array<{ userId: number; nickname: string; confirmedAt: string }>;
  unconfirmed: Array<{ userId: number; nickname: string }>;
}

// ─── 统计 ─────────────────────────────────────────────────────────────────────

export interface WikiStatsOverview {
  spaceCount: number;
  docCount: number;
  publishedCount: number;
  pendingCount: number;
  commentCount: number;
  weekNewDocs: number;
  weekViews: number;
}

export interface WikiHotDoc {
  id: number;
  title: string;
  spaceName: string;
  viewCount: number;
}

export interface WikiContributor {
  userId: number;
  nickname: string;
  docCount: number;
}

/** 长期未更新的沉睡文档 */
export interface WikiStaleDoc {
  id: number;
  title: string;
  spaceName: string;
  updatedAt: string;
}

// ─── 全局设置 ─────────────────────────────────────────────────────────────────

export interface WikiSettings {
  requireApproval: boolean;
  defaultVisibility: WikiSpaceVisibility;
  aiSyncEnabled: boolean;
  aiSyncKbId: number | null;
  /** 是否允许评论 */
  commentsEnabled: boolean;
  /** 回收站保留天数；0 = 永久保留 */
  recycleRetentionDays: number;
  /** 审核积压提醒时限（小时） */
  pendingRemindHours: number;
}

// ─── 治理与运营统计 ───────────────────────────────────────────────────────────

/** 无结果搜索关键词（知识缺口） */
export interface WikiNoResultKeyword {
  keyword: string;
  searchCount: number;
  lastSearchedAt: string;
}

/** 运营统计扩展 */
export interface WikiOpsStats {
  /** 近 30 天新建文档趋势 */
  createdTrend: Array<{ date: string; count: number }>;
  /** 空间文档分布 */
  spaceDistribution: Array<{ spaceName: string; count: number }>;
  /** 近 30 天搜索次数 */
  searchCount30d: number;
  /** 近 30 天无结果搜索次数 */
  noResultCount30d: number;
  /** 近 30 天审核通过 / 驳回数与当前积压 */
  approvedCount30d: number;
  rejectedCount30d: number;
  pendingBacklog: number;
  /** 治理清单计数 */
  expiredCount: number;
  reviewDueCount: number;
  noOwnerCount: number;
  archivedCount: number;
}
