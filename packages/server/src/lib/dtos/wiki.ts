import { z } from '@hono/zod-openapi';
import {
  WIKI_COMMENT_STATUSES,
  WIKI_DOC_STATUSES,
  WIKI_REVIEW_ACTIONS,
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
    requireReadReceipt: z.boolean(),
    publishedAt: z.string().nullable(),
    deletedAt: z.string().nullable().optional(),
    tags: z.array(WikiTagDTO).optional(),
    tagIds: z.array(z.number().int()).optional(),
    attachments: z.array(BusinessFileDTO).optional(),
    snippet: z.string().optional(),
    favorited: z.boolean().optional(),
    favoriteCount: z.number().int().optional(),
    commentCount: z.number().int().optional(),
    subscribed: z.boolean().optional(),
    readConfirmed: z.boolean().optional(),
    readReceiptCount: z.number().int().optional(),
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
  mentionedUserIds: number[];
  isQuestion: boolean;
  resolvedAt?: string | null;
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
      mentionedUserIds: z.array(z.number().int()),
      isQuestion: z.boolean(),
      resolvedAt: z.string().nullable().optional(),
      authorId: z.number().int().nullable(),
      authorName: z.string().nullable().optional(),
      replies: z.array(WikiCommentDTO).optional(),
      createdAt: z.string(),
    }),
  )
  .openapi('WikiComment');

// ─── 审核时间线与阅读确认 ─────────────────────────────────────────────────────

export const WikiReviewRecordDTO = z
  .object({
    id: z.number().int(),
    docId: z.number().int(),
    docTitle: z.string().optional(),
    version: z.number().int(),
    action: z.enum(WIKI_REVIEW_ACTIONS),
    actorId: z.number().int().nullable().optional(),
    actorName: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    createdAt: z.string(),
  })
  .openapi('WikiReviewRecord');

export const WikiDocReadReceiptsDTO = z
  .object({
    confirmed: z.array(z.object({
      userId: z.number().int(),
      nickname: z.string(),
      confirmedAt: z.string(),
    })),
    unconfirmed: z.array(z.object({
      userId: z.number().int(),
      nickname: z.string(),
    })),
  })
  .openapi('WikiDocReadReceipts');

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
    commentsEnabled: z.boolean(),
    recycleRetentionDays: z.number().int(),
    pendingRemindHours: z.number().int(),
  })
  .openapi('WikiSettings');

// ─── 治理（P2-D）──────────────────────────────────────────────────────────────

export const WikiGovernanceDocDTO = z
  .object({
    id: z.number().int(),
    spaceId: z.number().int(),
    spaceName: z.string(),
    title: z.string(),
    status: z.enum(WIKI_DOC_STATUSES),
    ownerId: z.number().int().nullable(),
    ownerName: z.string().nullable(),
    expireAt: z.string().nullable(),
    reviewCycleDays: z.number().int().nullable(),
    nextReviewAt: z.string().nullable(),
    isArchived: z.boolean(),
    updatedAt: z.string(),
  })
  .openapi('WikiGovernanceDoc');

export const WikiNoResultKeywordDTO = z
  .object({
    keyword: z.string(),
    searchCount: z.number().int(),
    lastSearchedAt: z.string(),
  })
  .openapi('WikiNoResultKeyword');

export const WikiOpsStatsDTO = z
  .object({
    createdTrend: z.array(z.object({ date: z.string(), count: z.number().int() })),
    spaceDistribution: z.array(z.object({ spaceName: z.string(), count: z.number().int() })),
    searchCount30d: z.number().int(),
    noResultCount30d: z.number().int(),
    approvedCount30d: z.number().int(),
    rejectedCount30d: z.number().int(),
    pendingBacklog: z.number().int(),
    expiredCount: z.number().int(),
    reviewDueCount: z.number().int(),
    noOwnerCount: z.number().int(),
    archivedCount: z.number().int(),
  })
  .openapi('WikiOpsStats');

export const WikiImportResultDTO = z
  .object({
    importedCount: z.number().int(),
    docIds: z.array(z.number().int()),
  })
  .openapi('WikiImportResult');
