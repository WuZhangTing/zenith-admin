// ─── 规则中心：决策表 ────────────────────────────────────────────────────────────
export type RuleHitPolicy = 'first' | 'unique' | 'priority' | 'collect' | 'any';

export type RuleDecisionStatus = 'draft' | 'published' | 'disabled';

export type RuleFieldType = 'string' | 'number' | 'boolean' | 'date';

/** collect 策略聚合方式：list=输出数组（默认）；sum/min/max 数值聚合；count=命中行数；distinct=去重数组 */
export type RuleCollectAggregate = 'list' | 'sum' | 'min' | 'max' | 'count' | 'distinct';

/** 决策表行为设置（发布时随快照固化） */
export interface RuleDecisionTableSettings {
  /** collect 策略下的聚合方式，缺省 list */
  collectAggregate?: RuleCollectAggregate;
  /** 未命中时回退输出列默认值（matched 仍为 false，供调用方兜底） */
  fallbackToDefaults?: boolean;
}

/** 输入列：expr 为取值表达式（复用安全表达式引擎，从 scope 取值，如 form.amount） */
export interface RuleDecisionInput {
  key: string;
  label: string;
  expr: string;
  type: RuleFieldType;
  /** string 类型可绑定字典编码，编辑器条件/测试表单渲染为字典下拉 */
  dictCode?: string | null;
}

/** 输出列：default 为无命中时回填默认值；isExpr 标记该列输出为表达式（'= form.x * 0.8'，编辑器渲染文本框） */
export interface RuleDecisionOutput {
  key: string;
  label: string;
  type: RuleFieldType;
  default?: string | number | boolean | null;
  isExpr?: boolean;
}

/** 规则行：when 与 inputs 一一对应，'-' 或空为通配；then 为各 output 字面量 */
export interface RuleDecisionRow {
  id: string;
  when: string[];
  then: Record<string, string | number | boolean | null>;
  priority?: number;
  label?: string;
}

export interface RuleDecisionTable {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  categoryId?: number | null;
  status: RuleDecisionStatus;
  hitPolicy: RuleHitPolicy;
  inputs: RuleDecisionInput[];
  outputs: RuleDecisionOutput[];
  rules: RuleDecisionRow[];
  version: number;
  publishedAt?: string | null;
  /** 当前编辑态与最新发布快照不一致（有未发布修改） */
  dirty?: boolean;
  settings?: RuleDecisionTableSettings;
  /** 发布审批（四眼）：pending=待审批 */
  reviewStatus?: 'pending' | null;
  reviewRequestedBy?: number | null;
  reviewRequestedAt?: string | null;
  /** 最近一次审批驳回意见 */
  reviewComment?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: number | null;
  createdByName?: string | null;
}

export interface RuleDecisionTableVersion {
  id: number;
  tableId: number;
  version: number;
  name: string;
  hitPolicy: RuleHitPolicy;
  inputs: RuleDecisionInput[];
  outputs: RuleDecisionOutput[];
  rules: RuleDecisionRow[];
  settings?: RuleDecisionTableSettings;
  publishedAt: string;
  publishedBy?: number | null;
  publishedByName?: string | null;
}

/** 求值未命中/冲突原因：no_match=无行命中；unique_conflict=唯一命中策略下命中多行；any_conflict=any 策略下多行输出不一致 */
export type RuleEvaluateReason = 'no_match' | 'unique_conflict' | 'any_conflict';

export interface RuleEvaluateResult {
  matched: boolean;
  outputs: Record<string, unknown>;
  matchedRowIds: string[];
  hitPolicy: RuleHitPolicy;
  collected?: Array<Record<string, unknown>>;
  /** matched 为 false 时的原因 */
  reason?: RuleEvaluateReason;
  /** 未命中但启用了回退默认值：outputs 为各输出列默认值 */
  usedFallback?: boolean;
}

/** 决策表引用方（where-used 分析） */
export interface RuleUsageItem {
  type: 'workflow' | 'coupon';
  id: number | null;
  name: string;
  status?: string | null;
}

// ─── 规则中心：决策流（表间编排，DRD 简化版） ─────────────────────────────────────
/** 决策流步骤：顺序执行，前序输出并入 scope 供后续步骤条件/输入引用 */
export interface RuleFlowStep {
  id: string;
  /** 引用的决策表 key */
  tableKey: string;
  label?: string;
  /** 前置条件表达式（安全表达式，求值为假时跳过该步骤）；留空恒执行 */
  condition?: string;
  /** 输出合并命名空间：留空平铺合并进 scope；非空挂在 scope[命名空间] 下，防键冲突 */
  outputNamespace?: string;
}

export interface RuleDecisionFlow {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  status: RuleDecisionStatus;
  steps: RuleFlowStep[];
  /** 最近一次发布的步骤快照（运行时按此执行，编辑态不影响线上） */
  publishedSteps?: RuleFlowStep[] | null;
  version: number;
  publishedAt?: string | null;
  /** 编辑态与已发布快照不一致 */
  dirty?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleFlowStepTrace {
  stepId: string;
  tableKey: string;
  label?: string;
  skipped: boolean;
  /** 跳过原因：condition=条件不满足；unavailable=决策表不可用；error=执行异常 */
  skipReason?: 'condition' | 'unavailable' | 'error';
  matched: boolean;
  outputs: Record<string, unknown>;
  matchedRowIds: string[];
  /** 该步骤引用决策表的实际命中策略（skipped 时缺省） */
  hitPolicy?: RuleHitPolicy;
  reason?: RuleEvaluateReason;
  error?: string;
}

export interface RuleFlowEvaluateResult {
  outputs: Record<string, unknown>;
  steps: RuleFlowStepTrace[];
}

// ─── 规则中心：名单库（黑/白/灰名单） ────────────────────────────────────────────
export type RuleListType = 'black' | 'white' | 'grey';

export interface RuleList {
  id: number;
  key: string;
  name: string;
  type: RuleListType;
  description?: string | null;
  status: 'enabled' | 'disabled';
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RuleListItem {
  id: number;
  listId: number;
  value: string;
  label?: string | null;
  /** 过期时间；到期后自动不再命中 */
  expiresAt?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface RuleListCheckResult {
  hit: boolean;
  listType?: RuleListType;
  item?: { value: string; label?: string | null; expiresAt?: string | null };
}

// ─── 规则中心：命中分析 / 影子对比 ───────────────────────────────────────────────
export interface RuleTableStats {
  days: number;
  total: number;
  matched: number;
  unmatched: number;
  byDay: Array<{ date: string; total: number; matched: number }>;
  rowHits: Array<{ rowId: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

export interface RuleShadowDiffSample {
  executionId: number;
  input: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  beforeMatched: boolean;
  afterMatched: boolean;
}

/** 影子对比：以最近执行记录的输入重放当前编辑态，评估「若现在发布」的行为差异 */
export interface RuleShadowRunResult {
  total: number;
  same: number;
  changed: number;
  samples: RuleShadowDiffSample[];
}

// ─── 规则中心：版本 diff ─────────────────────────────────────────────────────────
export interface RuleVersionChange {
  kind: 'input' | 'output' | 'rule' | 'meta';
  op: 'added' | 'removed' | 'changed';
  ref: string;
  detail: string;
}

export interface RuleVersionDiff {
  from: number;
  to: number;
  changes: RuleVersionChange[];
}

// ─── 规则中心：测试矩阵 ──────────────────────────────────────────────────────────
export interface RuleTestCase {
  id: number;
  tableId: number;
  name: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCaseResult {
  id: number;
  name: string;
  pass: boolean;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
}

export interface RuleTestRunResult {
  total: number;
  passed: number;
  failed: number;
  coverage: number;
  uncoveredRowIds: string[];
  cases: RuleCaseResult[];
}

// ─── 规则中心：执行记录 ──────────────────────────────────────────────────────────
export interface RuleDecisionExecution {
  id: number;
  ruleKey: string;
  tableId: number | null;
  instanceId: number | null;
  nodeKey: string | null;
  source: 'runtime' | 'manual' | 'test';
  matched: boolean;
  hitPolicy: RuleHitPolicy;
  input: Record<string, unknown>;
  outputs: Record<string, unknown>;
  matchedRowIds: string[];
  createdAt: string;
}
