/**
 * 应用版本管理（客户端在线升级）
 *
 * 模型分层：应用（client_apps）→ 版本（app_releases，按渠道）→ 制品（app_artifacts，平台×架构×类型）。
 * 桌面 / 移动 / Web 只是不同的平台与制品类型，共用同一套发布与灰度模型。
 * app_release_events 是追加型日志（检查 / 下载 / 安装回执），供升级看板统计。
 */
import { pgTable, pgEnum, serial, varchar, text, integer, smallint, bigint, boolean, timestamp, unique, index, uuid } from 'drizzle-orm/pg-core';
import { statusEnum } from './common';
import { auditColumns } from './core';
import { managedFiles } from './files';

// ─── 枚举（三端同步：pgEnum / shared constants / Zod enum）──────────────────
export const appReleaseChannelEnum = pgEnum('app_release_channel', ['stable', 'beta', 'internal']);
export const appReleaseStatusEnum = pgEnum('app_release_status', ['draft', 'published', 'revoked']);
export const appPlatformEnum = pgEnum('app_platform', ['windows', 'macos', 'linux', 'android', 'ios', 'web']);
export const appArchEnum = pgEnum('app_arch', ['x64', 'arm64', 'universal']);
export const appArtifactKindEnum = pgEnum('app_artifact_kind', ['installer', 'hotupdate', 'metadata', 'external']);
export const appReleaseEventTypeEnum = pgEnum('app_release_event_type', ['check', 'download', 'install_success', 'install_fail']);

// ─── 应用 ────────────────────────────────────────────────────────────────────
export const clientApps = pgTable('client_apps', {
  id: serial('id').primaryKey(),
  /** 客户端侧标识（如 zenith-desktop），公开 check API 用它定位应用 */
  appKey: varchar('app_key', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: statusEnum('status').notNull().default('enabled'),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ClientAppRow = typeof clientApps.$inferSelect;
export type NewClientApp = typeof clientApps.$inferInsert;

// ─── 版本 ────────────────────────────────────────────────────────────────────
export const appReleases = pgTable('app_releases', {
  id: serial('id').primaryKey(),
  appId: integer('app_id').notNull().references(() => clientApps.id, { onDelete: 'cascade' }),
  channel: appReleaseChannelEnum('channel').notNull().default('stable'),
  /** semver，如 1.86.0 */
  version: varchar('version', { length: 32 }).notNull(),
  /** 更新日志（Markdown） */
  notes: text('notes'),
  status: appReleaseStatusEnum('status').notNull().default('draft'),
  /** 强制更新：客户端收到后不允许跳过 */
  mandatory: boolean('mandatory').notNull().default(false),
  /** 最低可用版本：低于该版本的客户端按强制更新处理 */
  minVersion: varchar('min_version', { length: 32 }),
  /** 灰度比例 0-100，按 deviceId 哈希放量；100 = 全量 */
  rolloutPercent: smallint('rollout_percent').notNull().default(100),
  publishedAt: timestamp('published_at'),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('app_releases_app_channel_version_unique').on(t.appId, t.channel, t.version)]);

export type AppReleaseRow = typeof appReleases.$inferSelect;
export type NewAppRelease = typeof appReleases.$inferInsert;

// ─── 制品 ────────────────────────────────────────────────────────────────────
export const appArtifacts = pgTable('app_artifacts', {
  id: serial('id').primaryKey(),
  releaseId: integer('release_id').notNull().references(() => appReleases.id, { onDelete: 'cascade' }),
  platform: appPlatformEnum('platform').notNull(),
  arch: appArchEnum('arch').notNull().default('x64'),
  /** installer=安装包 hotupdate=热更包 metadata=latest.yml/blockmap external=外链（App Store 等） */
  kind: appArtifactKindEnum('kind').notNull().default('installer'),
  /** 托管文件（external 制品为空）；文件删除时置空以保留发布记录 */
  fileId: uuid('file_id').references(() => managedFiles.id, { onDelete: 'set null' }),
  /** 外链制品（iOS App Store / TestFlight 等）的跳转地址 */
  externalUrl: varchar('external_url', { length: 500 }),
  /** 分发匹配名：electron-updater 按固定文件名（latest.yml / Setup.exe / .blockmap）请求 */
  fileName: varchar('file_name', { length: 255 }).notNull(),
  size: bigint('size', { mode: 'number' }).notNull().default(0),
  sha256: varchar('sha256', { length: 64 }),
  downloadCount: integer('download_count').notNull().default(0),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  unique('app_artifacts_release_filename_unique').on(t.releaseId, t.fileName),
  index('app_artifacts_release_idx').on(t.releaseId),
]);

export type AppArtifactRow = typeof appArtifacts.$inferSelect;
export type NewAppArtifact = typeof appArtifacts.$inferInsert;

// ─── 升级事件（追加型日志，无审计列）────────────────────────────────────────
export const appReleaseEvents = pgTable('app_release_events', {
  id: serial('id').primaryKey(),
  appId: integer('app_id').notNull().references(() => clientApps.id, { onDelete: 'cascade' }),
  releaseId: integer('release_id').references(() => appReleases.id, { onDelete: 'set null' }),
  artifactId: integer('artifact_id').references(() => appArtifacts.id, { onDelete: 'set null' }),
  eventType: appReleaseEventTypeEnum('event_type').notNull(),
  channel: appReleaseChannelEnum('channel').notNull().default('stable'),
  platform: appPlatformEnum('platform'),
  arch: appArchEnum('arch'),
  /** check = 客户端当前版本；download / install_* = 目标版本 */
  version: varchar('version', { length: 32 }),
  /** 客户端自生成的匿名设备标识，用于灰度命中与设备数统计 */
  deviceId: varchar('device_id', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('app_release_events_app_time_idx').on(t.appId, t.createdAt)]);

export type AppReleaseEventRow = typeof appReleaseEvents.$inferSelect;
export type NewAppReleaseEvent = typeof appReleaseEvents.$inferInsert;
