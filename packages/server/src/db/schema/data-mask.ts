import { pgTable, varchar, timestamp, pgEnum, boolean, unique, jsonb, integer } from 'drizzle-orm/pg-core';
import { auditColumns } from './core';

export const maskTypeEnum = pgEnum('mask_type', ['phone', 'email', 'id_card', 'name', 'bank_card', 'custom']);

export const dataMaskConfigs = pgTable('data_mask_configs', {
  id:              integer().primaryKey().generatedAlwaysAsIdentity(),
  /** 实体名称，如 user / tenant */
  entity:          varchar({ length: 64 }).notNull(),
  /** 字段名称，如 phone / email */
  field:           varchar({ length: 64 }).notNull(),
  /** 字段中文标签，供前端展示 */
  label:           varchar({ length: 64 }).notNull(),
  maskType:        maskTypeEnum().notNull(),
  /**
   * 自定义规则（maskType='custom' 时使用）
   * 格式：{ prefixKeep: number; suffixKeep: number; maskChar?: string }
   */
  customRule:      jsonb(),
  /**
   * 豁免角色 code 列表（这些角色可看原始值）
   * 格式：string[]，如 ["super_admin", "hr_admin"]
   */
  exemptRoleCodes: jsonb().notNull().default([]),
  enabled:         boolean().notNull().default(true),
  remark:          varchar({ length: 256 }),
  ...auditColumns(),
  createdAt:       timestamp().defaultNow().notNull(),
  updatedAt:       timestamp().defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('data_mask_entity_field_unique').on(t.entity, t.field)]);

export type DataMaskConfigRow = typeof dataMaskConfigs.$inferSelect;

export type NewDataMaskConfig = typeof dataMaskConfigs.$inferInsert;

// ─── OAuth2 服务端 ─────────────────────────────────────────────────────────
