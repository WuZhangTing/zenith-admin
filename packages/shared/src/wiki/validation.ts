import { z } from 'zod';
import { WIKI_COMMENT_STATUSES, WIKI_SPACE_MEMBER_ROLES, WIKI_SPACE_VISIBILITIES } from './constants';

// ─── 知识空间 ─────────────────────────────────────────────────────────────────

export const createWikiSpaceSchema = z.object({
  name: z.string().min(1, '空间名称不能为空').max(100),
  description: z.string().max(300).optional(),
  icon: z.string().max(50).optional(),
  visibility: z.enum(WIKI_SPACE_VISIBILITIES).default('public'),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  sort: z.number().int().default(0),
  aiSyncEnabled: z.boolean().default(false),
});

export const updateWikiSpaceSchema = createWikiSpaceSchema.partial();

export type CreateWikiSpaceInput = z.infer<typeof createWikiSpaceSchema>;
export type UpdateWikiSpaceInput = z.infer<typeof updateWikiSpaceSchema>;

/** 全量保存空间成员（replace 模式） */
export const saveWikiSpaceMembersSchema = z.object({
  members: z.array(z.object({
    userId: z.number().int().positive(),
    role: z.enum(WIKI_SPACE_MEMBER_ROLES),
  })).default([]),
});

export type SaveWikiSpaceMembersInput = z.infer<typeof saveWikiSpaceMembersSchema>;

// ─── 文档 ─────────────────────────────────────────────────────────────────────

export const createWikiDocSchema = z.object({
  spaceId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1, '标题不能为空').max(200),
  summary: z.string().max(500).optional(),
  content: z.string().default(''),
  tagIds: z.array(z.number().int()).default([]),
  fileIds: z.array(z.string().uuid()).default([]),
});

export const updateWikiDocSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200).optional(),
  summary: z.string().max(500).nullable().optional(),
  content: z.string().optional(),
  tagIds: z.array(z.number().int()).optional(),
  fileIds: z.array(z.string().uuid()).optional(),
  sort: z.number().int().optional(),
  isPinned: z.boolean().optional(),
  /** 版本说明；正文变更时写入版本历史 */
  changeNote: z.string().max(300).optional(),
  /** 乐观锁：加载详情时的 revision，服务端不一致时返回 409 */
  revision: z.number().int().positive().optional(),
});

export type CreateWikiDocInput = z.infer<typeof createWikiDocSchema>;
export type UpdateWikiDocInput = z.infer<typeof updateWikiDocSchema>;

/** 移动文档（改父节点 / 排序） */
export const moveWikiDocSchema = z.object({
  parentId: z.number().int().positive().nullable(),
  sort: z.number().int().optional(),
});

export type MoveWikiDocInput = z.infer<typeof moveWikiDocSchema>;

/** 审核（通过 / 驳回） */
export const reviewWikiDocSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
}).refine((v) => v.action !== 'reject' || !!v.reason?.trim(), { message: '驳回时必须填写驳回意见', path: ['reason'] });

export type ReviewWikiDocInput = z.infer<typeof reviewWikiDocSchema>;

/** 回滚到历史版本 */
export const rollbackWikiDocSchema = z.object({
  version: z.number().int().positive(),
});

export type RollbackWikiDocInput = z.infer<typeof rollbackWikiDocSchema>;

// ─── 模板与标签 ───────────────────────────────────────────────────────────────

export const createWikiTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  description: z.string().max(300).optional(),
  content: z.string().default(''),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  sort: z.number().int().default(0),
});

export const updateWikiTemplateSchema = createWikiTemplateSchema.partial();

export type CreateWikiTemplateInput = z.infer<typeof createWikiTemplateSchema>;
export type UpdateWikiTemplateInput = z.infer<typeof updateWikiTemplateSchema>;

export const createWikiTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(50),
  color: z.string().max(20).optional(),
});

export const updateWikiTagSchema = createWikiTagSchema.partial();

export type CreateWikiTagInput = z.infer<typeof createWikiTagSchema>;
export type UpdateWikiTagInput = z.infer<typeof updateWikiTagSchema>;

// ─── 评论 ─────────────────────────────────────────────────────────────────────

export const createWikiCommentSchema = z.object({
  docId: z.number().int().positive(),
  parentId: z.number().int().positive().nullable().optional(),
  content: z.string().min(1, '评论内容不能为空').max(1000),
});

export type CreateWikiCommentInput = z.infer<typeof createWikiCommentSchema>;

export const updateWikiCommentStatusSchema = z.object({
  status: z.enum(WIKI_COMMENT_STATUSES),
});

export type UpdateWikiCommentStatusInput = z.infer<typeof updateWikiCommentStatusSchema>;

// ─── 全局设置 ─────────────────────────────────────────────────────────────────

export const updateWikiSettingsSchema = z.object({
  requireApproval: z.boolean(),
  defaultVisibility: z.enum(WIKI_SPACE_VISIBILITIES),
  aiSyncEnabled: z.boolean(),
  aiSyncKbId: z.number().int().positive().nullable().optional(),
});

export type UpdateWikiSettingsInput = z.infer<typeof updateWikiSettingsSchema>;
