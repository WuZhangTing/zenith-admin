import { pgTable, serial, varchar, timestamp, pgEnum, integer, boolean, text, index, jsonb, real, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { MONITOR_ALERT_HANDLE_STATUSES, MONITOR_ALERT_NOTIFY_STATUSES, MONITOR_METRICS } from '@zenith/shared/platform';
import { auditColumns, tenants, users } from './core';

// ─── 系统监控指标采样（时序持久化，追加型）──────────────────────────────────────
// 由 pg-boss 定时任务（默认每分钟）将 metricsSampler 最新快照落库，用于历史趋势与容量规划。
// 各百分比字段范围 0-100；*Bps 字段为字节/秒。
export const systemMetricSamples = pgTable('system_metric_samples', {
  id: serial('id').primaryKey(),
  sampledAt: timestamp('sampled_at', { withTimezone: true }).notNull().defaultNow(),
  cpu: real('cpu').notNull().default(0),
  memory: real('memory').notNull().default(0),
  disk: real('disk').notNull().default(0),
  swap: real('swap').notNull().default(0),
  load1: real('load1').notNull().default(0),
  procCpu: real('proc_cpu').notNull().default(0),
  heap: real('heap').notNull().default(0),
  loopLag: real('loop_lag').notNull().default(0),
  qps: real('qps').notNull().default(0),
  errorRate: real('error_rate').notNull().default(0),
  netRxBps: real('net_rx_bps').notNull().default(0),
  netTxBps: real('net_tx_bps').notNull().default(0),
  diskReadBps: real('disk_read_bps').notNull().default(0),
  diskWriteBps: real('disk_write_bps').notNull().default(0),
}, (t) => [
  index('system_metric_samples_at_idx').on(t.sampledAt),
]);

export type SystemMetricSampleRow = typeof systemMetricSamples.$inferSelect;

export type NewSystemMetricSample = typeof systemMetricSamples.$inferInsert;

// ─── 监控告警规则 ──────────────────────────────────────────────────────────────
// 指标维度直接取 shared 的 MONITOR_METRICS（枚举 SSOT），保证 pgEnum / Zod / TS union 三端不会漂移。
// infra 指标对应 system_metric_samples 字段；workflow* / payment* / open* 为业务派生指标，
// 由各域的告警指标源函数在评估时实时计算，不落 system_metric_samples。
export const monitorMetricEnum = pgEnum('monitor_metric', MONITOR_METRICS);

export const monitorAlertOperatorEnum = pgEnum('monitor_alert_operator', ['gt', 'gte', 'lt', 'lte']);

export const monitorAlertLevelEnum = pgEnum('monitor_alert_level', ['info', 'warning', 'critical']);

export const monitorAlertStateEnum = pgEnum('monitor_alert_state', ['ok', 'firing']);

export const monitorAlertEventStatusEnum = pgEnum('monitor_alert_event_status', ['firing', 'resolved']);

export const monitorAlertNotifyStatusEnum = pgEnum(
  'monitor_alert_notify_status',
  MONITOR_ALERT_NOTIFY_STATUSES,
);

/**
 * 人工处理状态，与系统判定的 `status`（firing / resolved）正交。
 * 指标自动恢复不等于有人看过并处理过，两者混用会让「没人管」的告警被自动恢复掩盖。
 */
export const monitorAlertHandleStatusEnum = pgEnum(
  'monitor_alert_handle_status',
  MONITOR_ALERT_HANDLE_STATUSES,
);

export const monitorAlertRules = pgTable('monitor_alert_rules', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 128 }).notNull(),
  metric: monitorMetricEnum('metric').notNull(),
  operator: monitorAlertOperatorEnum('operator').notNull().default('gt'),
  threshold: real('threshold').notNull(),
  /** 持续达标分钟数（0=瞬时触发，>0=持续超阈才触发，抑制毛刺）*/
  durationMinutes: integer('duration_minutes').notNull().default(0),
  level: monitorAlertLevelEnum('level').notNull().default('warning'),
  channels: jsonb('channels').$type<string[]>().notNull().default([]),
  webhookUrl: varchar('webhook_url', { length: 512 }),
  /** 系统内接收用户；站内信直接投递，邮件渠道实时读取用户当前邮箱 */
  recipientUserIds: jsonb('recipient_user_ids').$type<number[]>().notNull().default([]),
  /** 不绑定系统用户的额外邮箱（群组邮箱、外部联系人等） */
  recipientEmails: jsonb('recipient_emails').$type<string[]>().notNull().default([]),
  /** 静默期分钟数：触发后该时间内不重复通知 */
  silenceMinutes: integer('silence_minutes').notNull().default(30),
  enabled: boolean('enabled').notNull().default(true),
  /** 运行态：ok / firing */
  state: monitorAlertStateEnum('state').notNull().default('ok'),
  breachingSince: timestamp('breaching_since', { withTimezone: true }),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  lastValue: real('last_value'),
  ...auditColumns(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index('monitor_alert_rules_tenant_idx').on(t.tenantId),
  index('monitor_alert_rules_enabled_idx').on(t.enabled),
]);

export type MonitorAlertRuleRow = typeof monitorAlertRules.$inferSelect;

export type NewMonitorAlertRule = typeof monitorAlertRules.$inferInsert;

// ─── 监控告警记录（追加型日志）────────────────────────────────────────────────
export const monitorAlertEvents = pgTable('monitor_alert_events', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ruleId: integer('rule_id').references((): AnyPgColumn => monitorAlertRules.id, { onDelete: 'set null' }),
  ruleName: varchar('rule_name', { length: 128 }).notNull(),
  metric: monitorMetricEnum('metric').notNull(),
  level: monitorAlertLevelEnum('level').notNull().default('warning'),
  operator: monitorAlertOperatorEnum('operator').notNull(),
  threshold: real('threshold').notNull(),
  value: real('value').notNull(),
  status: monitorAlertEventStatusEnum('status').notNull().default('firing'),
  message: text('message').notNull(),
  /** 最近一次通知派发的真实结果；由评估器在派发完成后回写 */
  notifyStatus: monitorAlertNotifyStatusEnum('notify_status').notNull().default('skipped'),
  /** 本次实际尝试的渠道快照：规则事后改渠道不会污染历史事件 */
  notifyChannels: jsonb('notify_channels').$type<string[]>().notNull().default([]),
  /** 失败渠道的原因摘要，全部成功时为空 */
  notifyError: text('notify_error'),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  /** 人工处理状态；与 status 正交，系统自动恢复不代表有人处理过 */
  handleStatus: monitorAlertHandleStatusEnum('handle_status').notNull().default('pending'),
  /** 首次认领时间，用于 MTTA 与「最久未确认」统计；撤销认领会清空 */
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  handledBy: integer('handled_by').references(() => users.id, { onDelete: 'set null' }),
  handledAt: timestamp('handled_at', { withTimezone: true }),
  handleNote: varchar('handle_note', { length: 500 }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  index('monitor_alert_events_rule_idx').on(t.ruleId),
  index('monitor_alert_events_status_idx').on(t.status),
  index('monitor_alert_events_notify_status_idx').on(t.notifyStatus),
  index('monitor_alert_events_handle_status_idx').on(t.handleStatus),
  index('monitor_alert_events_triggered_idx').on(t.triggeredAt),
  index('monitor_alert_events_tenant_idx').on(t.tenantId),
]);

export type MonitorAlertEventRow = typeof monitorAlertEvents.$inferSelect;

export type NewMonitorAlertEvent = typeof monitorAlertEvents.$inferInsert;

// ─── SSL 证书 ──────────────────────────────────────────────────────────────
export const sslCertTypeEnum = pgEnum('ssl_cert_type', ['self_signed', 'uploaded', 'letsencrypt']);

export const sslCertStatusEnum = pgEnum('ssl_cert_status', ['valid', 'expiring', 'expired', 'invalid']);

export const sslCertificates = pgTable('ssl_certificates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  domain: varchar('domain', { length: 256 }).notNull(),
  type: sslCertTypeEnum('type').notNull().default('self_signed'),
  certPath: varchar('cert_path', { length: 512 }),
  keyPath: varchar('key_path', { length: 512 }),
  certContent: text('cert_content'),
  keyContent: text('key_content'),
  issuer: varchar('issuer', { length: 256 }),
  subject: varchar('subject', { length: 256 }),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  fingerprint: varchar('fingerprint', { length: 128 }),
  serialNumber: varchar('serial_number', { length: 128 }),
  status: sslCertStatusEnum('status').notNull().default('valid'),
  autoRenew: boolean('auto_renew').notNull().default(false),
  ...auditColumns(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SslCertificateRow = typeof sslCertificates.$inferSelect;

export type NewSslCertificate = typeof sslCertificates.$inferInsert;
