/**
 * IoT 设备管理（iot 域）二期：物模型驱动。
 *
 * - iot_products                产品（设备类型），物模型三元组挂在产品下
 * - iot_product_properties     物模型·属性（遥测校验 / 图表单位 / 影子键的唯一定义源）
 * - iot_product_services       物模型·服务（指令模板：参数 schema 驱动表单化下发）
 * - iot_product_events         物模型·事件（设备事件的级别与参数声明）
 * - iot_devices                 设备：SN 全局唯一 + 一机一密；实时在线态在 Redis TTL 键
 * - iot_device_state            设备影子：reported（最新上报快照）/ desired（期望值待确认）
 * - iot_device_events           统一事件流：生命周期（上下线/激活/重置密钥）+ 物模型事件
 * - iot_telemetry               遥测明细（jsonb 指标袋；保留策略裁剪）
 * - iot_commands                指令下发记录（pending→delivered→acked/failed，惰性超时）
 * - iot_alarm_rules / iot_alarms 告警规则（阈值/离线/事件）与告警记录（firing→resolved）
 * - iot_device_groups (+members) 设备静态分组（批量操作圈选目标）
 */
import {
  pgTable, pgEnum, serial, bigserial, varchar, timestamp, integer, text, jsonb, boolean,
  doublePrecision, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { statusEnum } from './common';
import { auditColumns, tenants } from './core';

// ─── 枚举 ─────────────────────────────────────────────────────────────────────
export const iotCommandStatusEnum = pgEnum('iot_command_status', ['pending', 'delivered', 'acked', 'failed', 'expired']);

export const iotPropertyTypeEnum = pgEnum('iot_property_type', ['number', 'string', 'boolean', 'enum']);

export const iotAccessModeEnum = pgEnum('iot_access_mode', ['r', 'rw']);

export const iotEventLevelEnum = pgEnum('iot_event_level', ['info', 'warn', 'fault']);

export const iotValidationModeEnum = pgEnum('iot_validation_mode', ['loose', 'strict']);

export const iotDeviceEventKindEnum = pgEnum('iot_device_event_kind', ['lifecycle', 'model']);

export const iotAlarmRuleTypeEnum = pgEnum('iot_alarm_rule_type', ['threshold', 'offline', 'event']);

export const iotCompareOpEnum = pgEnum('iot_compare_op', ['gt', 'gte', 'lt', 'lte', 'eq', 'neq']);

export const iotAlarmLevelEnum = pgEnum('iot_alarm_level', ['warning', 'critical']);

export const iotAlarmStatusEnum = pgEnum('iot_alarm_status', ['firing', 'resolved']);

// ─── 产品与物模型 ─────────────────────────────────────────────────────────────
export const iotProducts = pgTable('iot_products', {
  id:             serial('id').primaryKey(),
  name:           varchar('name', { length: 128 }).notNull(),
  description:    text('description'),
  /** 遥测校验模式：loose = 已声明属性校验类型/量程（不符丢弃该键）、未声明键放行；strict = 仅接受已声明属性 */
  validationMode: iotValidationModeEnum('validation_mode').notNull().default('loose'),
  status:         statusEnum('status').notNull().default('enabled'),
  tenantId:       integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_products_tenant').on(t.tenantId),
]);

export type IotProductRow = typeof iotProducts.$inferSelect;

export type NewIotProduct = typeof iotProducts.$inferInsert;

/** 服务/事件的参数定义（jsonb 内嵌，随宿主整体编辑，无独立查询诉求） */
export interface IotParamDef {
  identifier: string;
  name: string;
  dataType: 'number' | 'string' | 'boolean' | 'enum';
  required?: boolean;
  unit?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  /** enum 类型的取值映射：{ 值: 显示名 } */
  enumOptions?: Record<string, string> | null;
}

export const iotProductProperties = pgTable('iot_product_properties', {
  id:          serial('id').primaryKey(),
  productId:   integer('product_id').notNull().references(() => iotProducts.id, { onDelete: 'cascade' }),
  /** 属性标识符（遥测/影子的键名） */
  identifier:  varchar('identifier', { length: 64 }).notNull(),
  name:        varchar('name', { length: 64 }).notNull(),
  dataType:    iotPropertyTypeEnum('data_type').notNull(),
  /** r = 只读（设备上报），rw = 可写（管理端可下发期望值） */
  accessMode:  iotAccessModeEnum('access_mode').notNull().default('r'),
  unit:        varchar('unit', { length: 16 }),
  minValue:    doublePrecision('min_value'),
  maxValue:    doublePrecision('max_value'),
  /** enum 类型的取值映射：{ 值: 显示名 } */
  enumOptions: jsonb('enum_options').$type<Record<string, string>>(),
  /** 关键属性：设备列表快照列与遥测图表默认展示 */
  featured:    boolean('featured').notNull().default(false),
  sort:        integer('sort').notNull().default(0),
  description: varchar('description', { length: 256 }),
  ...auditColumns(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex('uq_iot_product_properties_ident').on(t.productId, t.identifier),
]);

export type IotProductPropertyRow = typeof iotProductProperties.$inferSelect;

export type NewIotProductProperty = typeof iotProductProperties.$inferInsert;

export const iotProductServices = pgTable('iot_product_services', {
  id:          serial('id').primaryKey(),
  productId:   integer('product_id').notNull().references(() => iotProducts.id, { onDelete: 'cascade' }),
  identifier:  varchar('identifier', { length: 64 }).notNull(),
  name:        varchar('name', { length: 64 }).notNull(),
  /** 参数定义列表（下发时按此校验并渲染表单） */
  params:      jsonb('params').$type<IotParamDef[]>().notNull().default([]),
  /** 高危服务：前端下发前二次确认 */
  danger:      boolean('danger').notNull().default(false),
  sort:        integer('sort').notNull().default(0),
  description: varchar('description', { length: 256 }),
  ...auditColumns(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex('uq_iot_product_services_ident').on(t.productId, t.identifier),
]);

export type IotProductServiceRow = typeof iotProductServices.$inferSelect;

export type NewIotProductService = typeof iotProductServices.$inferInsert;

export const iotProductEvents = pgTable('iot_product_events', {
  id:          serial('id').primaryKey(),
  productId:   integer('product_id').notNull().references(() => iotProducts.id, { onDelete: 'cascade' }),
  identifier:  varchar('identifier', { length: 64 }).notNull(),
  name:        varchar('name', { length: 64 }).notNull(),
  level:       iotEventLevelEnum('level').notNull().default('info'),
  /** 事件携带参数定义 */
  params:      jsonb('params').$type<IotParamDef[]>().notNull().default([]),
  sort:        integer('sort').notNull().default(0),
  description: varchar('description', { length: 256 }),
  ...auditColumns(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  uniqueIndex('uq_iot_product_events_ident').on(t.productId, t.identifier),
]);

export type IotProductEventRow = typeof iotProductEvents.$inferSelect;

export type NewIotProductEvent = typeof iotProductEvents.$inferInsert;

// ─── 设备 ─────────────────────────────────────────────────────────────────────
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

export type IotMetricValue = number | string | boolean;

/**
 * 设备影子：每设备一行。
 * reported = 遥测合并出的最新属性快照（设备列表/详情 O(1) 读，替代扫遥测表）；
 * desired  = 期望值增量（管理端下发、设备回报一致后按键清除）；
 * online   = 持久化在线标记（仅在上下线转变时更新，供事件打点与离线告警判定；实时态仍以 Redis 为准）。
 */
export const iotDeviceState = pgTable('iot_device_state', {
  deviceId:       integer('device_id').primaryKey().references(() => iotDevices.id, { onDelete: 'cascade' }),
  reported:       jsonb('reported').$type<Record<string, IotMetricValue>>().notNull().default({}),
  reportedAt:     timestamp('reported_at'),
  desired:        jsonb('desired').$type<Record<string, IotMetricValue>>().notNull().default({}),
  /** desired 每次变更 +1，随 WS 帧/心跳响应下发，设备侧幂等 */
  desiredVersion: integer('desired_version').notNull().default(0),
  desiredAt:      timestamp('desired_at'),
  online:         boolean('online').notNull().default(false),
  updatedAt:      timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type IotDeviceStateRow = typeof iotDeviceState.$inferSelect;

export type NewIotDeviceState = typeof iotDeviceState.$inferInsert;

/** 统一事件流：追加型日志（生命周期 + 物模型事件），不加审计列 */
export const iotDeviceEvents = pgTable('iot_device_events', {
  id:         bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId:   integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
  /** lifecycle = 系统生命周期事件；model = 设备按物模型上报的事件 */
  kind:       iotDeviceEventKindEnum('kind').notNull(),
  /** lifecycle: online/offline/activated/secret_reset；model: 物模型事件 identifier */
  identifier: varchar('identifier', { length: 64 }).notNull(),
  /** 展示名（写入时冗余，避免模型改名后历史错位） */
  name:       varchar('name', { length: 64 }).notNull(),
  level:      iotEventLevelEnum('level').notNull().default('info'),
  payload:    jsonb('payload').$type<Record<string, unknown>>(),
  reportedAt: timestamp('reported_at').defaultNow().notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('idx_iot_device_events_device_time').on(t.deviceId, t.reportedAt),
]);

export type IotDeviceEventRow = typeof iotDeviceEvents.$inferSelect;

export type NewIotDeviceEvent = typeof iotDeviceEvents.$inferInsert;

// ─── 遥测与指令 ───────────────────────────────────────────────────────────────
export const iotTelemetry = pgTable('iot_telemetry', {
  id:         bigserial('id', { mode: 'number' }).primaryKey(),
  deviceId:   integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
  /** 属性值袋：{ temperature: 23.5, humidity: 61, door: 'open' }（按产品物模型校验） */
  metrics:    jsonb('metrics').$type<Record<string, IotMetricValue>>().notNull(),
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
  /** 服务标识符（物模型 services.identifier） */
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

// ─── 告警 ─────────────────────────────────────────────────────────────────────
export const iotAlarmRules = pgTable('iot_alarm_rules', {
  id:                 serial('id').primaryKey(),
  name:               varchar('name', { length: 128 }).notNull(),
  productId:          integer('product_id').notNull().references(() => iotProducts.id, { onDelete: 'cascade' }),
  /** 空 = 产品下全部设备；指定则仅对该设备生效 */
  deviceId:           integer('device_id').references(() => iotDevices.id, { onDelete: 'cascade' }),
  ruleType:           iotAlarmRuleTypeEnum('rule_type').notNull(),
  /** threshold：监控的属性 identifier */
  propertyIdentifier: varchar('property_identifier', { length: 64 }),
  operator:           iotCompareOpEnum('operator'),
  threshold:          doublePrecision('threshold'),
  /** threshold：连续 N 个点满足才触发（抖动抑制） */
  consecutiveCount:   integer('consecutive_count').notNull().default(1),
  /** offline：离线超过 N 分钟触发 */
  offlineMinutes:     integer('offline_minutes'),
  /** event：匹配的物模型事件 identifier */
  eventIdentifier:    varchar('event_identifier', { length: 64 }),
  level:              iotAlarmLevelEnum('level').notNull().default('warning'),
  /** 告警通知接收人（管理端用户 id） */
  notifyUserIds:      jsonb('notify_user_ids').$type<number[]>().notNull().default([]),
  status:             statusEnum('status').notNull().default('enabled'),
  tenantId:           integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_alarm_rules_product').on(t.productId),
]);

export type IotAlarmRuleRow = typeof iotAlarmRules.$inferSelect;

export type NewIotAlarmRule = typeof iotAlarmRules.$inferInsert;

export const iotAlarms = pgTable('iot_alarms', {
  id:         serial('id').primaryKey(),
  /** 规则删除后记录保留（ruleName 冗余展示） */
  ruleId:     integer('rule_id').references(() => iotAlarmRules.id, { onDelete: 'set null' }),
  ruleName:   varchar('rule_name', { length: 128 }).notNull(),
  deviceId:   integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
  ruleType:   iotAlarmRuleTypeEnum('rule_type').notNull(),
  level:      iotAlarmLevelEnum('level').notNull(),
  status:     iotAlarmStatusEnum('status').notNull().default('firing'),
  message:    varchar('message', { length: 512 }).notNull(),
  /** 触发上下文：{ value, threshold, offlineMinutes, eventPayload… } */
  context:    jsonb('context').$type<Record<string, unknown>>(),
  firedAt:    timestamp('fired_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  /** resolved 来源：auto = 恢复判定，manual = 管理员处理 */
  resolvedBy: integer('resolved_by'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_alarms_device_time').on(t.deviceId, t.firedAt),
  index('idx_iot_alarms_status').on(t.status),
  /** 同规则同设备仅一条活跃告警（去重防风暴） */
  uniqueIndex('uq_iot_alarms_active').on(t.ruleId, t.deviceId).where(sql`status = 'firing'`),
]);

export type IotAlarmRow = typeof iotAlarms.$inferSelect;

export type NewIotAlarm = typeof iotAlarms.$inferInsert;

// ─── 设备分组 ─────────────────────────────────────────────────────────────────
export const iotDeviceGroups = pgTable('iot_device_groups', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 256 }),
  tenantId:    integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('idx_iot_device_groups_tenant').on(t.tenantId),
]);

export type IotDeviceGroupRow = typeof iotDeviceGroups.$inferSelect;

export type NewIotDeviceGroup = typeof iotDeviceGroups.$inferInsert;

export const iotDeviceGroupMembers = pgTable('iot_device_group_members', {
  groupId:  integer('group_id').notNull().references(() => iotDeviceGroups.id, { onDelete: 'cascade' }),
  deviceId: integer('device_id').notNull().references(() => iotDevices.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.groupId, t.deviceId] })]);

export type IotDeviceGroupMemberRow = typeof iotDeviceGroupMembers.$inferSelect;
