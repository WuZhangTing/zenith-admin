import { pgTable, serial, varchar, timestamp, pgEnum, integer, boolean, unique, text, index, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { auditColumns, tenants, users } from './core';
import { statusEnum } from './common';
import { workflowCategories, workflowDefinitionStatusEnum } from './workflow';

// ─── 规则中心：决策表 ────────────────────────────────────────────────────────────
// 命中策略：first=首行命中即返回；unique=必须唯一命中；priority=按优先级取最高；
// collect=收集全部命中；any=允许多命中但输出需一致
export const ruleHitPolicyEnum = pgEnum('rule_hit_policy', ['first', 'unique', 'priority', 'collect', 'any']);

// 决策表定义：独立规则中心实体，工作流网关/会员等级/优惠券等可调用求值
export const ruleDecisionTables = pgTable('rule_decision_tables', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  categoryId: integer('category_id').references(() => workflowCategories.id, { onDelete: 'set null' }),
  status: workflowDefinitionStatusEnum('status').default('draft').notNull(),
  hitPolicy: ruleHitPolicyEnum('hit_policy').default('first').notNull(),
  inputs: jsonb('inputs').notNull().default(sql`'[]'::jsonb`),   // RuleDecisionInput[]
  outputs: jsonb('outputs').notNull().default(sql`'[]'::jsonb`), // RuleDecisionOutput[]
  rules: jsonb('rules').notNull().default(sql`'[]'::jsonb`),     // RuleDecisionRow[]
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`), // RuleDecisionTableSettings
  version: integer('version').default(1).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  // 灰度发布：grayPercent 非空即灰度中——新版本(grayVersion)按主体哈希分桶生效，其余流量走上一版本
  grayPercent: integer('gray_percent'),
  grayDimension: varchar('gray_dimension', { length: 200 }),
  grayVersion: integer('gray_version'),
  // 发布审批（四眼）：pending=待审批；批准/驳回后清空
  reviewStatus: varchar('review_status', { length: 16 }),
  reviewRequestedBy: integer('review_requested_by').references(() => users.id, { onDelete: 'set null' }),
  reviewRequestedAt: timestamp('review_requested_at', { withTimezone: true }),
  reviewComment: varchar('review_comment', { length: 255 }),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('rule_decision_tables_key_uniq').on(t.tenantId, t.key)]);

export type RuleDecisionTableRow = typeof ruleDecisionTables.$inferSelect;

export type NewRuleDecisionTable = typeof ruleDecisionTables.$inferInsert;

// 决策表版本快照（发布时写入一行，调用方按版本绑定，防运行中漂移）
export const ruleDecisionTableVersions = pgTable('rule_decision_table_versions', {
  id: serial('id').primaryKey(),
  tableId: integer('table_id').notNull().references(() => ruleDecisionTables.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  hitPolicy: ruleHitPolicyEnum('hit_policy').default('first').notNull(),
  inputs: jsonb('inputs').notNull().default(sql`'[]'::jsonb`),
  outputs: jsonb('outputs').notNull().default(sql`'[]'::jsonb`),
  rules: jsonb('rules').notNull().default(sql`'[]'::jsonb`),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  publishedBy: integer('published_by').references(() => users.id, { onDelete: 'set null' }),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
}, (t) => [index('rule_decision_table_versions_tenant_idx').on(t.tenantId), unique('rule_decision_table_versions_uniq').on(t.tableId, t.version)]);

export type RuleDecisionTableVersionRow = typeof ruleDecisionTableVersions.$inferSelect;

export type NewRuleDecisionTableVersion = typeof ruleDecisionTableVersions.$inferInsert;

// 决策表测试用例（输入快照→期望输出），用于回归测试矩阵与发布门禁
export const ruleTestCases = pgTable('rule_test_cases', {
  id: serial('id').primaryKey(),
  tableId: integer('table_id').notNull().references(() => ruleDecisionTables.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  input: jsonb('input').notNull().default(sql`'{}'::jsonb`),
  expected: jsonb('expected').notNull().default(sql`'{}'::jsonb`),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [index('rule_test_cases_tenant_idx').on(t.tenantId), unique('rule_test_cases_name_uniq').on(t.tableId, t.name)]);

export type RuleTestCaseRow = typeof ruleTestCases.$inferSelect;

export type NewRuleTestCase = typeof ruleTestCases.$inferInsert;

// 规则执行记录（全资产通用，append-only）：决策表 / 决策流 / 评分卡 / 名单命中统一留痕，
// 供 trace、审计与「谁在调哪条规则」的消费方分析
export const ruleExecutions = pgTable('rule_executions', {
  id: serial('id').primaryKey(),
  refKind: varchar('ref_kind', { length: 16 }).notNull(), // RuleRefKind: table | flow | scorecard | list
  refId: integer('ref_id'),
  ruleKey: varchar('rule_key', { length: 64 }).notNull(),
  version: integer('version'),                             // 求值所用发布版本（名单为 null）
  caller: varchar('caller', { length: 64 }),               // 调用方标识（如 workflow.gateway）
  instanceId: integer('instance_id'),
  nodeKey: varchar('node_key', { length: 64 }),
  source: varchar('source', { length: 16 }).notNull().default('runtime'), // RuleExecutionSource
  matched: boolean('matched').notNull().default(false),
  hitPolicy: ruleHitPolicyEnum('hit_policy'),              // 仅决策表类记录有值
  input: jsonb('input').notNull().default(sql`'{}'::jsonb`),
  outputs: jsonb('outputs').notNull().default(sql`'{}'::jsonb`),
  matchedRowIds: jsonb('matched_row_ids').notNull().default(sql`'[]'::jsonb`),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('rule_executions_tenant_idx').on(t.tenantId),
  index('rule_executions_instance_idx').on(t.instanceId),
  index('rule_executions_ref_idx').on(t.refKind, t.refId),
  index('rule_executions_caller_idx').on(t.caller),
]);

export type RuleExecutionRow = typeof ruleExecutions.$inferSelect;

export type NewRuleExecution = typeof ruleExecutions.$inferInsert;

// ─── 决策流：多决策表顺序编排（DRD 简化版），步骤输出并入 scope 供后续步骤引用 ────
export const ruleDecisionFlows = pgTable('rule_decision_flows', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  status: workflowDefinitionStatusEnum('status').default('draft').notNull(),
  steps: jsonb('steps').notNull().default(sql`'[]'::jsonb`),          // RuleFlowStep[]（编辑态）
  publishedSteps: jsonb('published_steps'),                            // RuleFlowStep[]（发布快照，运行时执行）
  version: integer('version').default(1).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('rule_decision_flows_key_uniq').on(t.tenantId, t.key)]);

export type RuleDecisionFlowRow = typeof ruleDecisionFlows.$inferSelect;

export type NewRuleDecisionFlow = typeof ruleDecisionFlows.$inferInsert;

// ─── 名单库：黑/白/灰名单 + 条目（支持过期时间），供风控/资格判定使用 ─────────────
export const ruleLists = pgTable('rule_lists', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  type: varchar('type', { length: 8 }).notNull().default('black'), // black | white | grey
  description: text('description'),
  status: statusEnum('status').notNull().default('enabled'),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('rule_lists_key_uniq').on(t.tenantId, t.key)]);

export type RuleListRow = typeof ruleLists.$inferSelect;

export type NewRuleList = typeof ruleLists.$inferInsert;

export const ruleListItems = pgTable('rule_list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => ruleLists.id, { onDelete: 'cascade' }),
  value: varchar('value', { length: 128 }).notNull(),
  label: varchar('label', { length: 64 }),
  matchMode: varchar('match_mode', { length: 8 }).notNull().default('exact'), // exact | prefix | regex
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  remark: varchar('remark', { length: 255 }),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [unique('rule_list_items_value_uniq').on(t.listId, t.value), index('rule_list_items_list_idx').on(t.listId)]);

export type RuleListItemRow = typeof ruleListItems.$inferSelect;

export type NewRuleListItem = typeof ruleListItems.$inferInsert;

// ─── 评分卡：变量分段打分 × 权重 + 基础分 → 总分 → 等级/决策映射 ─────────────────
// 发布采用单快照（publishedSnapshot）：运行时按快照执行，编辑态不影响线上；
// 结构较决策表简单，不建独立版本表，version 号随每次发布 +1。
export const ruleScorecards = pgTable('rule_scorecards', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 64 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  status: workflowDefinitionStatusEnum('status').default('draft').notNull(),
  baseScore: integer('base_score').default(0).notNull(),
  variables: jsonb('variables').notNull().default(sql`'[]'::jsonb`), // RuleScorecardVariable[]
  grades: jsonb('grades').notNull().default(sql`'[]'::jsonb`),       // RuleScorecardGrade[]
  publishedSnapshot: jsonb('published_snapshot'),                    // { baseScore, variables, grades }
  version: integer('version').default(1).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  tenantId: integer('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  ...auditColumns(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [unique('rule_scorecards_key_uniq').on(t.tenantId, t.key)]);

export type RuleScorecardRow = typeof ruleScorecards.$inferSelect;

export type NewRuleScorecard = typeof ruleScorecards.$inferInsert;
