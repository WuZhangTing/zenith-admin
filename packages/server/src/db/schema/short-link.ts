/**
 * 短链服务（short-link 域）
 *
 * - short_links            短链主表（code 全局唯一，跨租户不重复）
 * - short_link_clicks      点击明细（追加型日志，供统计与审计，保留策略管控）
 * - short_link_daily_stats 按日聚合（P2 起由定时任务物化，长周期趋势与明细瘦身后的数据源）
 */
import { pgTable, pgEnum, serial, bigserial, varchar, timestamp, integer, text, boolean, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { statusEnum } from './common';
import { auditColumns, tenants } from './core';

/** 跳转方式：302 临时（默认，可统计可改址）/ 301 永久（浏览器缓存，改址不生效） */
export const shortLinkRedirectTypeEnum = pgEnum('short_link_redirect_type', ['302', '301']);

export const shortLinks = pgTable('short_links', {
  id:           serial('id').primaryKey(),
  /** 短码，全局唯一（多租户下也不重复，跳转按 code 寻址） */
  code:         varchar('code', { length: 32 }).notNull().unique(),
  targetUrl:    text('target_url').notNull(),
  title:        varchar('title', { length: 128 }),
  redirectType: shortLinkRedirectTypeEnum('redirect_type').notNull().default('302'),
  status:       statusEnum('status').notNull().default('enabled'),
  /** 过期时间，null = 永久有效 */
  expiresAt:    timestamp('expires_at'),
  /** 访问次数上限，null = 不限 */
  maxVisits:    integer('max_visits'),
  /** 访问密码（提取码语义，需在管理端可见可复制），null = 无需密码 */
  password:     varchar('password', { length: 32 }),
  utmSource:    varchar('utm_source', { length: 128 }),
  utmMedium:    varchar('utm_medium', { length: 128 }),
  utmCampaign:  varchar('utm_campaign', { length: 128 }),
  utmTerm:      varchar('utm_term', { length: 128 }),
  utmContent:   varchar('utm_content', { length: 128 }),
  /** 来源业务类型（custom = 手工创建；其余由业务域经 ensureShortLink 写入） */
  bizType:      varchar('biz_type', { length: 32 }).notNull().default('custom'),
  /** 来源业务标识（与 bizType 组合定位业务对象，幂等复用） */
  bizRef:       varchar('biz_ref', { length: 64 }),
  remark:       varchar('remark', { length: 256 }),
  /** 累计访问次数（不含爬虫，异步点击落库时递增，maxVisits 判定依据） */
  totalPv:      integer('total_pv').notNull().default(0),
  lastVisitAt:  timestamp('last_visit_at'),
  tenantId:     integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_short_links_biz').on(t.bizType, t.bizRef),
  index('idx_short_links_tenant').on(t.tenantId),
]);

export type ShortLinkRow = typeof shortLinks.$inferSelect;

export type NewShortLink = typeof shortLinks.$inferInsert;

export const shortLinkClicks = pgTable('short_link_clicks', {
  id:         bigserial('id', { mode: 'number' }).primaryKey(),
  linkId:     integer('link_id').notNull().references(() => shortLinks.id, { onDelete: 'cascade' }),
  /** 访客指纹 hash(ip + ua)，无 Cookie 方案，UV 按日去重口径 */
  visitorId:  varchar('visitor_id', { length: 40 }),
  ip:         varchar('ip', { length: 64 }),
  country:    varchar('country', { length: 64 }),
  province:   varchar('province', { length: 64 }),
  city:       varchar('city', { length: 64 }),
  deviceType: varchar('device_type', { length: 16 }),
  os:         varchar('os', { length: 64 }),
  browser:    varchar('browser', { length: 64 }),
  referer:    varchar('referer', { length: 512 }),
  isBot:      boolean('is_bot').notNull().default(false),
  clickedAt:  timestamp('clicked_at').defaultNow().notNull(),
}, (t) => [
  index('idx_short_link_clicks_link_time').on(t.linkId, t.clickedAt),
]);

export type ShortLinkClickRow = typeof shortLinkClicks.$inferSelect;

export type NewShortLinkClick = typeof shortLinkClicks.$inferInsert;

export const shortLinkDailyStats = pgTable('short_link_daily_stats', {
  id:       serial('id').primaryKey(),
  linkId:   integer('link_id').notNull().references(() => shortLinks.id, { onDelete: 'cascade' }),
  statDate: date('stat_date').notNull(),
  pv:       integer('pv').notNull().default(0),
  uv:       integer('uv').notNull().default(0),
}, (t) => [
  uniqueIndex('uq_short_link_daily_stats_link_date').on(t.linkId, t.statDate),
]);

export type ShortLinkDailyStatRow = typeof shortLinkDailyStats.$inferSelect;

export type NewShortLinkDailyStat = typeof shortLinkDailyStats.$inferInsert;
