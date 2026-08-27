/**
 * IoT 设备管理（iot 域）一期。
 *
 * - iot_products    产品（设备类型）：关键指标声明（图表/列表用），物模型留二期
 * - iot_devices     设备：SN 全局唯一 + 一机一密 secret；在线态在 Redis（TTL 键），不入库
 * - iot_telemetry   遥测明细（自由 jsonb 指标；单表 + 索引，保留策略裁剪，分区留量级需要时）
 * - iot_commands    指令下发记录（pending→delivered→acked/failed，expire_at 惰性超时）
 */
import { pgTable, pgEnum, serial, bigserial, varchar, timestamp, integer, text, jsonb, index } from 'drizzle-orm/pg-core';
import { statusEnum } from './common';
import { auditColumns, tenants } from './core';

export const iotCommandStatusEnum = pgEnum('iot_command_status', ['pending', 'delivered', 'acked', 'failed', 'expired']);

export const iotProducts = pgTable('iot_products', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 128 }).notNull(),
  /** 关键指标 key 列表（设备列表列展示与遥测图表默认选中） */
  keyMetrics:  jsonb('key_metrics').$type<string[]>().notNull().default([]),
  description: text('description'),
  status:      statusEnum('status').notNull().default('enabled'),
  tenantId:    integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_products_tenant').on(t.tenantId),
]);

export type IotProductRow = typeof iotProducts.$inferSelect;

export type NewIotProduct = typeof iotProducts.$inferInsert;

export const iotDevices = pgTable('iot_devices', {
  id:              serial('id').primaryKey(),
  /** 设备序列号，全局唯一（接入寻址标识） */
  sn:              varchar('sn', { length: 64 }).notNull().unique(),
  /** 一机一密：HMAC 签名密钥（管理端可见可重置） */
  secret:          varchar('secret', { length: 64 }).notNull(),
  productId:       integer('product_id').notNull().references(() => iotProducts.id, { onDelete: 'restrict' }),
  name:            varchar('name', { length: 128 }).notNull(),
  status:          statusEnum('status').notNull().default('enabled'),
  firmwareVersion: varchar('firmware_version', { length: 32 }),
  /** 首次上线时间（激活标记） */
  activatedAt:     timestamp('activated_at'),
  /** 最近心跳/上报落库时间（节流更新，实时在线态在 Redis） */
  lastSeenAt:      timestamp('last_seen_at'),
  remark:          varchar('remark', { length: 256 }),
  tenantId:        integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_devices_product').on(t.productId),
  index('idx_iot_devices_tenant').on(t.tenantId),
]);

export type IotDeviceRow = typeof iotDevices.$inferSelect;

export type NewIotDevice = typeof iotDevices.$inferInsert;

export const iotTelemetry = pgTable('iot_telemetry', {
  id:         bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId:   integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
  /** 自由指标袋：{ temperature: 23.5, humidity: 61, door: 'open' } */
  metrics:    jsonb('metrics').$type<Record<string, number | string | boolean>>().notNull(),
  /** 业务发生时间（设备侧可传，缺省取服务器时间） */
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_iot_telemetry_device_time').on(t.deviceId, t.reportedAt),
]);

export type IotTelemetryRow = typeof iotTelemetry.$inferSelect;

export type NewIotTelemetry = typeof iotTelemetry.$inferInsert;

export const iotCommands = pgTable('iot_commands', {
  id:        serial('id').primaryKey(),
  deviceId:  integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
  /** 指令名（如 reboot / set_config / open_door） */
  service:   varchar('service', { length: 64 }).notNull(),
  params:    jsonb('params').$type<Record<string, unknown>>(),
  status:    iotCommandStatusEnum('status').notNull().default('pending'),
  /** 超时期限：pending/delivered 越过此时刻按 expired 处理（查询时惰性刷新） */
  expireAt:  timestamp('expire_at').notNull(),
  sentAt:    timestamp('sent_at'),
  ackedAt:   timestamp('acked_at'),
  response:  jsonb('response').$type<Record<string, unknown>>(),
  errorMsg:  varchar('error_msg', { length: 256 }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_commands_device_time').on(t.deviceId, t.createdAt),
  index('idx_iot_commands_status').on(t.status),
]);

export type IotCommandRow = typeof iotCommands.$inferSelect;

export type NewIotCommand = typeof iotCommands.$inferInsert;
