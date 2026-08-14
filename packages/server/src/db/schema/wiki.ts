import { pgTable, serial, varchar, timestamp, pgEnum, integer, boolean, primaryKey, unique, index, text, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { statusEnum } from './common';
import { auditColumns, tenants, users } from './core';

// ─── 枚举 ─────────────────────────────────────────────────────────────────────

export const wikiSpaceVisibilityEnum = pgEnum('wiki_space_visibility', ['public', 'private']);

export const wikiSpaceMemberRoleEnum = pgEnum('wiki_space_member_role', ['owner', 'admin', 'editor', 'viewer']);

export const wikiDocStatusEnum = pgEnum('wiki_doc_status', ['draft', 'pending', 'published', 'rejected']);

export const wikiCommentStatusEnum = pgEnum('wiki_comment_status', ['visible', 'hidden']);

// ─── 知识空间 ─────────────────────────────────────────────────────────────────

export const wikiSpaces = pgTable('wiki_spaces', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 300 }),
  /** lucide 图标名 */
  icon: varchar('icon', { length: 50 }),
  /** public = 全员可读；private = 仅空间成员可见 */
  visibility: wikiSpaceVisibilityEnum('visibility').notNull().default('public'),
  status: statusEnum('status').notNull().default('enabled'),
  sort: integer('sort').notNull().default(0),
  /** 发布的文档是否同步到 AI 知识库（需全局设置同时开启） */
  aiSyncEnabled: boolean('ai_sync_enabled').notNull().default(false),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type WikiSpaceRow = typeof wikiSpaces.$inferSelect;
export type NewWikiSpace = typeof wikiSpaces.$inferInsert;

/** 空间成员（纯关联表） */
export const wikiSpaceMembers = pgTable('wiki_space_members', {
  spaceId: integer('space_id').notNull().references(() => wikiSpaces.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: wikiSpaceMemberRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.spaceId, t.userId] })]);

export type WikiSpaceMemberRow = typeof wikiSpaceMembers.$inferSelect;

// ─── 文档 ─────────────────────────────────────────────────────────────────────

export const wikiDocs = pgTable('wiki_docs', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => wikiSpaces.id, { onDelete: 'cascade' }),
  /** 目录树父节点；null = 空间根级 */
  parentId: integer('parent_id').references((): AnyPgColumn => wikiDocs.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  summary: varchar('summary', { length: 500 }),
  /** Markdown 正文 */
  content: text('content').notNull().default(''),
  status: wikiDocStatusEnum('status').notNull().default('draft'),
  /** 驳回意见（status = rejected 时展示） */
  rejectReason: varchar('reject_reason', { length: 500 }),
  sort: integer('sort').notNull().default(0),
  isPinned: boolean('is_pinned').notNull().default(false),
  viewCount: integer('view_count').notNull().default(0),
  /** 当前版本号，与 wiki_doc_versions.version 对应 */
  currentVersion: integer('current_version').notNull().default(1),
  publishedAt: timestamp('published_at'),
  /** 软删除时间；非 null 表示在回收站 */
  deletedAt: timestamp('deleted_at'),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('wiki_docs_space_idx').on(t.spaceId),
  index('wiki_docs_parent_idx').on(t.parentId),
  index('wiki_docs_status_idx').on(t.status),
]);

export type WikiDocRow = typeof wikiDocs.$inferSelect;
export type NewWikiDoc = typeof wikiDocs.$inferInsert;

/** 文档版本快照（追加型，作者即当前用户） */
export const wikiDocVersions = pgTable('wiki_doc_versions', {
  id: serial('id').primaryKey(),
  docId: integer('doc_id').notNull().references(() => wikiDocs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull().default(''),
  changeNote: varchar('change_note', { length: 300 }),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('wiki_doc_versions_doc_version_uk').on(t.docId, t.version)]);

export type WikiDocVersionRow = typeof wikiDocVersions.$inferSelect;

// ─── 模板与标签 ───────────────────────────────────────────────────────────────

export const wikiTemplates = pgTable('wiki_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 300 }),
  /** Markdown 模板内容 */
  content: text('content').notNull().default(''),
  status: statusEnum('status').notNull().default('enabled'),
  sort: integer('sort').notNull().default(0),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type WikiTemplateRow = typeof wikiTemplates.$inferSelect;

export const wikiTags = pgTable('wiki_tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  /** 展示色（hex），空则前端取默认色板 */
  color: varchar('color', { length: 20 }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type WikiTagRow = typeof wikiTags.$inferSelect;

/** 文档-标签（纯关联表） */
export const wikiDocTags = pgTable('wiki_doc_tags', {
  docId: integer('doc_id').notNull().references(() => wikiDocs.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => wikiTags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.docId, t.tagId] })]);

// ─── 评论与互动 ───────────────────────────────────────────────────────────────

/** 文档评论（作者即当前用户） */
export const wikiComments = pgTable('wiki_comments', {
  id: serial('id').primaryKey(),
  docId: integer('doc_id').notNull().references(() => wikiDocs.id, { onDelete: 'cascade' }),
  /** 回复的父评论；null = 顶层评论 */
  parentId: integer('parent_id').references((): AnyPgColumn => wikiComments.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 1000 }).notNull(),
  status: wikiCommentStatusEnum('status').notNull().default('visible'),
  authorId: integer('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('wiki_comments_doc_idx').on(t.docId)]);

export type WikiCommentRow = typeof wikiComments.$inferSelect;

/** 收藏（纯关联表） */
export const wikiDocFavorites = pgTable('wiki_doc_favorites', {
  docId: integer('doc_id').notNull().references(() => wikiDocs.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.docId, t.userId] })]);

/** 浏览记录（追加型日志，统计用） */
export const wikiDocViews = pgTable('wiki_doc_views', {
  id: serial('id').primaryKey(),
  docId: integer('doc_id').notNull().references(() => wikiDocs.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('wiki_doc_views_doc_idx').on(t.docId),
  index('wiki_doc_views_created_idx').on(t.createdAt),
]);

export type WikiDocViewRow = typeof wikiDocViews.$inferSelect;
