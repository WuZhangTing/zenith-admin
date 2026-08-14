import type { WikiCommentStatus, WikiDocStatus, WikiSpaceMemberRole, WikiSpaceVisibility } from './constants';

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
  publishedAt?: string | null;
  deletedAt?: string | null;
  tags?: WikiTag[];
  tagIds?: number[];
  /** 当前用户是否已收藏（详情接口附加） */
  favorited?: boolean;
  favoriteCount?: number;
  commentCount?: number;
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
  authorId?: number | null;
  authorName?: string | null;
  replies?: WikiComment[];
  createdAt: string;
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
}
