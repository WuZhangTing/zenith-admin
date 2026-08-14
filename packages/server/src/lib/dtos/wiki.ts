import { z } from '@hono/zod-openapi';
import {
  WIKI_COMMENT_STATUSES,
  WIKI_DOC_STATUSES,
  WIKI_SPACE_MEMBER_ROLES,
  WIKI_SPACE_VISIBILITIES,
} from '@zenith/shared/wiki';
import { auditFields } from './_audit';
import { BusinessFileDTO } from './business-files';

// ─── 知识空间 ─────────────────────────────────────────────────────────────────

export const WikiSpaceDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    visibility: z.enum(WIKI_SPACE_VISIBILITIES),
    status: z.enum(['enabled', 'disabled']),
    sort: z.number().int(),
    aiSyncEnabled: z.boolean(),
    tenantId: z.number().int().nullable(),
    memberCount: z.number().int().optional(),
    docCount: z.number().int().optional(),
    myRole: z.enum(WIKI_SPACE_MEMBER_ROLES).nullable().optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WikiSpace');

export const WikiSpaceMemberDTO = z
  .object({
    spaceId: z.number().int(),
    userId: z.number().int(),
    role: z.enum(WIKI_SPACE_MEMBER_ROLES),
    username: z.string().optional(),
    nickname: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('WikiSpaceMember');

// ─── 文档 ─────────────────────────────────────────────────────────────────────

export const WikiTagDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    color: z.string().nullable(),
    docCount: z.number().int().optional(),
    ...auditFields,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .openapi('WikiTag');

export const WikiDocDTO = z
  .object({
    id: z.number().int(),
    spaceId: z.number().int(),
    spaceName: z.string().optional(),
    parentId: z.number().int().nullable(),
    title: z.string(),
    summary: z.string().nullable(),
    content: z.string().optional(),
    status: z.enum(WIKI_DOC_STATUSES),
    rejectReason: z.string().nullable(),
    sort: z.number().int(),
    isPinned: z.boolean(),
    viewCount: z.number().int(),
    currentVersion: z.number().int(),
    revision: z.number().int(),
    publishedAt: z.string().nullable(),
    deletedAt: z.string().nullable().optional(),
    tags: z.array(WikiTagDTO).optional(),
    tagIds: z.array(z.number().int()).optional(),
    attachments: z.array(BusinessFileDTO).optional(),
    snippet: z.string().optional(),
    favorited: z.boolean().optional(),
    favoriteCount: z.number().int().optional(),
    commentCount: z.number().int().optional(),
    authorName: z.string().nullable().optional(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WikiDoc');

export interface WikiDocTreeNodeDTOType {
  id: number;
  parentId: number | null;
  title: string;
  status: (typeof WIKI_DOC_STATUSES)[number];
  isPinned: boolean;
  sort: number;
  children?: WikiDocTreeNodeDTOType[];
}

export const WikiDocTreeNodeDTO: z.ZodType<WikiDocTreeNodeDTOType> = z
  .lazy(() =>
    z.object({
      id: z.number().int(),
      parentId: z.number().int().nullable(),
      title: z.string(),
      status: z.enum(WIKI_DOC_STATUSES),
      isPinned: z.boolean(),
      sort: z.number().int(),
      children: z.array(WikiDocTreeNodeDTO).optional(),
    }),
  )
  .openapi('WikiDocTreeNode');

export const WikiDocVersionDTO = z
  .object({
    id: z.number().int(),
    docId: z.number().int(),
    version: z.number().int(),
    title: z.string(),
    content: z.string().optional(),
    changeNote: z.string().nullable(),
    authorId: z.number().int().nullable(),
    authorName: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('WikiDocVersion');

// ─── 模板 ─────────────────────────────────────────────────────────────────────

export const WikiTemplateDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    content: z.string(),
    status: z.enum(['enabled', 'disabled']),
    sort: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WikiTemplate');

// ─── 评论 ─────────────────────────────────────────────────────────────────────

export interface WikiCommentDTOType {
  id: number;
  docId: number;
  docTitle?: string;
  parentId: number | null;
  content: string;
  status: (typeof WIKI_COMMENT_STATUSES)[number];
  authorId: number | null;
  authorName?: string | null;
  replies?: WikiCommentDTOType[];
  createdAt: string;
}

export const WikiCommentDTO: z.ZodType<WikiCommentDTOType> = z
  .lazy(() =>
    z.object({
      id: z.number().int(),
      docId: z.number().int(),
      docTitle: z.string().optional(),
      parentId: z.number().int().nullable(),
      content: z.string(),
      status: z.enum(WIKI_COMMENT_STATUSES),
      authorId: z.number().int().nullable(),
      authorName: z.string().nullable().optional(),
      replies: z.array(WikiCommentDTO).optional(),
      createdAt: z.string(),
    }),
  )
  .openapi('WikiComment');

// ─── 统计与设置 ───────────────────────────────────────────────────────────────

export const WikiStatsOverviewDTO = z
  .object({
    spaceCount: z.number().int(),
    docCount: z.number().int(),
    publishedCount: z.number().int(),
    pendingCount: z.number().int(),
    commentCount: z.number().int(),
    weekNewDocs: z.number().int(),
    weekViews: z.number().int(),
  })
  .openapi('WikiStatsOverview');

export const WikiHotDocDTO = z
  .object({
    id: z.number().int(),
    title: z.string(),
    spaceName: z.string(),
    viewCount: z.number().int(),
  })
  .openapi('WikiHotDoc');

export const WikiContributorDTO = z
  .object({
    userId: z.number().int(),
    nickname: z.string(),
    docCount: z.number().int(),
  })
  .openapi('WikiContributor');

export const WikiStaleDocDTO = z
  .object({
    id: z.number().int(),
    title: z.string(),
    spaceName: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WikiStaleDoc');

export const WikiSettingsDTO = z
  .object({
    requireApproval: z.boolean(),
    defaultVisibility: z.enum(WIKI_SPACE_VISIBILITIES),
    aiSyncEnabled: z.boolean(),
    aiSyncKbId: z.number().int().nullable(),
  })
  .openapi('WikiSettings');
