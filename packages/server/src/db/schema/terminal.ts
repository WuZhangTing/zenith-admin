import { pgTable, serial, varchar, timestamp, pgEnum, integer, text, jsonb, real, uuid as pgUuid, index } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { TERMINAL_SESSION_KINDS, TERMINAL_SESSION_STATES } from '@zenith/shared/ops';
import { tenants, users } from './core';

// ─── 终端会话表 ─────────────────────────────────────────────────────────
/**
 * 活动与历史终端会话。
 *
 * 会话进程只存活在创建它的 Node 进程内存中，本表是它的权威元数据：
 * 提供事后追溯（谁、何时、连到哪、怎么结束的），并让进程重启后能结算残留记录。
 * `node_id` 标识承载进程的实例，跨实例连接会被拒绝而不是静默连到别处。
 */
export const terminalSessionStateEnum = pgEnum('terminal_session_state', TERMINAL_SESSION_STATES);

export const terminalSessionKindEnum = pgEnum('terminal_session_kind', TERMINAL_SESSION_KINDS);

export const terminalSessions = pgTable('terminal_sessions', {
  /** 服务端生成的 UUIDv7；客户端无法指定，杜绝按 ID 抢占他人会话 */
  id: pgUuid('id').primaryKey().$defaultFn(() => uuidv7()),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  kind: terminalSessionKindEnum('kind').notNull(),
  /** 连接目标：本地 shell id / ssh:<profileId> / docker-exec:<container>:<shell> */
  target: varchar('target', { length: 255 }).notNull().default(''),
  /** 展示标签：本地为 shell 名，SSH 为 user@host:port，Docker 为容器名 */
  label: varchar('label', { length: 255 }).notNull().default(''),
  clientIp: varchar('client_ip', { length: 64 }).notNull().default(''),
  /** 承载该会话进程的服务实例标识（hostname:port） */
  nodeId: varchar('node_id', { length: 128 }).notNull(),
  state: terminalSessionStateEnum('state').notNull().default('active'),
  cols: integer('cols').notNull().default(80),
  rows: integer('rows').notNull().default(24),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  /** 结束原因，取值见 @zenith/shared/ops 的 TERMINAL_END_REASONS */
  endReason: varchar('end_reason', { length: 32 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  // 「我的会话」与配额统计：按用户过滤活动会话
  index('terminal_sessions_user_state_idx').on(t.userId, t.state),
  // 管理端会话列表：租户内按开始时间倒序
  index('terminal_sessions_tenant_started_idx').on(t.tenantId, t.startedAt),
  // 启动结算：找出本实例遗留的未终结会话
  index('terminal_sessions_node_state_idx').on(t.nodeId, t.state),
]);

export type TerminalSessionRow = typeof terminalSessions.$inferSelect;

export type NewTerminalSession = typeof terminalSessions.$inferInsert;

// ─── 终端录屏表 ─────────────────────────────────────────────────────────
/** 终端 session 录屏事件：[timeOffset(秒), type('o'|’i'), data] */
export type RecordingEvent = [number, 'o' | 'i', string];

export const terminalRecordings = pgTable('terminal_recordings', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 256 }).notNull().default(''),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  shell: varchar('shell', { length: 64 }),
  cols: integer('cols').notNull().default(80),
  rows: integer('rows').notNull().default(24),
  duration: real('duration').notNull().default(0), // 秒
  events: jsonb('events').$type<RecordingEvent[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type TerminalRecordingRow = typeof terminalRecordings.$inferSelect;

export type NewTerminalRecording = typeof terminalRecordings.$inferInsert;

// ─── SSH 连接配置表 ────────────────────────────────────────────────────────────

export const sshAuthTypeEnum = pgEnum('ssh_auth_type', ['password', 'key_path', 'key_content', 'agent']);

export const sshProfiles = pgTable('ssh_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').notNull().default(22),
  username: varchar('username', { length: 128 }).notNull(),
  authType: sshAuthTypeEnum('auth_type').notNull().default('password'),
  /** 加密存储的密码（authType=password 时使用） */
  passwordEncrypted: text('password_encrypted'),
  /** 服务端私钥文件路径（authType=key_path 时使用，如 ~/.ssh/id_rsa） */
  keyPath: text('key_path'),
  /** 加密存储的私钥内容（authType=key_content 时使用） */
  keyContentEncrypted: text('key_content_encrypted'),
  /** 加密存储的私钥口令（authType=key_path|key_content 时可选） */
  keyPassphraseEncrypted: text('key_passphrase_encrypted'),
  /** 连接后自动设置的环境变量 */
  envVars: jsonb('env_vars').$type<Record<string, string>>().notNull().default({}),
  /** 所属分组名称（用于在 SSH 连接面板中按分组折叠展示，null 表示未分组） */
  groupName: varchar('group_name', { length: 128 }),
  /** 标签数组（用于筛选与标注，如 prod / staging / db） */
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  /** 列表排序权重（数字越小越靠前） */
  orderNum: integer('order_num').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type SshProfileRow = typeof sshProfiles.$inferSelect;

export type NewSshProfile = typeof sshProfiles.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// 会员中心（Member Center）—— 面向 C 端的前台用户体系，与后台管理员 users 完全隔离
// ═══════════════════════════════════════════════════════════════════════════
