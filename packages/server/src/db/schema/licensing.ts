import { pgTable, serial, varchar, timestamp, integer, text, jsonb, index } from 'drizzle-orm/pg-core';
import type { LicenseFeatureKey, LicensePayload } from '@zenith/shared/licensing';

// ─── 部署安装身份 ─────────────────────────────────────────────────────────────
// 单行表：首次启动时生成 installationId（License 绑定目标）。
// seed 绝不清理本表；licenseEpoch 是单调递增的失效版本号——激活/停用 License 时 +1，
// 各节点的进程内快照发现 epoch 变化即强制重载，实现跨节点秒级收敛。
export const systemInstallations = pgTable('system_installations', {
  id: serial('id').primaryKey(),
  installationId: varchar('installation_id', { length: 64 }).notNull().unique(),
  licenseEpoch: integer('license_epoch').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type SystemInstallationRow = typeof systemInstallations.$inferSelect;

// ─── License（离线签名文件的落库副本）─────────────────────────────────────────
// envelope 保留原始 .zenlic 内容：每次启动/巡检都对原始字节重新验签，
// 数据库仅是缓存介质而非信任来源（改库无法伪造授权）。
export const licenses = pgTable('licenses', {
  id: serial('id').primaryKey(),
  /** payload.licenseId（签发方生成的业务标识） */
  licenseId: varchar('license_id', { length: 64 }).notNull().unique(),
  /** 原始 .zenlic 文件内容（JSON envelope） */
  envelope: text('envelope').notNull(),
  /** 解析后的 payload（展示与查询用；验签始终以 envelope 原始字节为准） */
  payload: jsonb('payload').$type<LicensePayload>().notNull(),
  /** active/grace/expired/revoked/invalid/replaced */
  status: varchar('status', { length: 20 }).notNull().default('active'),
  keyId: varchar('key_id', { length: 32 }).notNull(),
  edition: varchar('edition', { length: 20 }).notNull(),
  customerName: varchar('customer_name', { length: 200 }).notNull(),
  features: jsonb('features').$type<LicenseFeatureKey[]>().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  graceUntil: timestamp('grace_until').notNull(),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
  activatedBy: integer('activated_by'),
  lastVerifiedAt: timestamp('last_verified_at'),
  invalidReason: text('invalid_reason'),
  /** 被新 License 替换时指向新记录 */
  replacedById: integer('replaced_by_id'),
});

export type LicenseRow = typeof licenses.$inferSelect;

// ─── License 事件（追加型审计日志）────────────────────────────────────────────
export const licenseEvents = pgTable('license_events', {
  id: serial('id').primaryKey(),
  licenseId: integer('license_id'),
  type: varchar('type', { length: 40 }).notNull(),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('license_events_created_idx').on(t.createdAt)]);

export type LicenseEventRow = typeof licenseEvents.$inferSelect;
