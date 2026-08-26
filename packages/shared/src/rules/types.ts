import type { RuleExecutionSource, RuleRefKind } from './constants';

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
  /** 灰度发布中：新版本按主体分桶生效，null=非灰度 */
  gray?: RuleGrayConfig | null;
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
  type: 'workflow' | 'coupon' | 'paymentRisk';
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

// ─── 规则中心：资产版本快照（决策流/评分卡通用） ─────────────────────────────────
export interface RuleAssetVersion {
  id: number;
  refKind: 'flow' | 'scorecard';
  refId: number;
  version: number;
  publishedBy: number | null;
  publishedAt: string;
}

// ─── 规则中心：评分卡 ────────────────────────────────────────────────────────────
/** 分段匹配方式：range=数值区间[min,max)；eq=等值；in=集合；default=兜底恒中 */
export type RuleScorecardBandOp = 'range' | 'eq' | 'in' | 'default';

export interface RuleScorecardBand {
  id: string;
  op: RuleScorecardBandOp;
  /** range：下界（含），null/缺省 = -∞ */
  min?: number | null;
  /** range：上界（不含），null/缺省 = +∞ */
  max?: number | null;
  /** eq：比较值（按字符串比较） */
  value?: string;
  /** in：集合（按字符串比较） */
  values?: string[];
  score: number;
  label?: string;
}

export interface RuleScorecardVariable {
  key: string;
  label: string;
  /** 取值表达式（安全表达式引擎，从 scope 取值，如 form.age） */
  expr: string;
  type: 'number' | 'string' | 'boolean';
  /** 权重：变量得分 × 权重计入总分，缺省 1 */
  weight?: number;
  /** 所有分段均未命中时该变量的得分，缺省 0 */
  missingScore?: number;
  bands: RuleScorecardBand[];
}

/** 等级映射：按 minScore 从高到低取首个 totalScore >= minScore 的档位 */
export interface RuleScorecardGrade {
  grade: string;
  minScore: number;
  /** 建议决策（如 approve/review/reject），透出给调用方 */
  decision?: string | null;
}

export interface RuleScorecard {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  status: RuleDecisionStatus;
  /** 基础分：所有变量得分之外的起始分 */
  baseScore: number;
  variables: RuleScorecardVariable[];
  grades: RuleScorecardGrade[];
  version: number;
  publishedAt?: string | null;
  /** 编辑态与最新发布快照不一致（有未发布修改） */
  dirty?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: number | null;
  createdByName?: string | null;
}

export interface RuleScorecardVariableTrace {
  key: string;
  label: string;
  raw: unknown;
  /** 命中的分段说明；未命中为 null（走 missingScore） */
  matchedBand: string | null;
  score: number;
  weight: number;
  weighted: number;
  missed: boolean;
}

export interface RuleScorecardEvaluateResult {
  totalScore: number;
  baseScore: number;
  grade: string | null;
  decision: string | null;
  variables: RuleScorecardVariableTrace[];
}

// ─── 规则中心：决策表灰度发布 ────────────────────────────────────────────────────
/** 灰度配置：新版本按灰度主体哈希分桶生效，其余流量走上一版本快照 */
export interface RuleGrayConfig {
  /** 灰度流量百分比（1-99） */
  grayPercent: number;
  /** 灰度主体表达式（如 form.userId），缺省对整包输入哈希 */
  grayDimension?: string | null;
  /** 灰度中的新版本号（灰度外流量走 grayVersion - 1） */
  grayVersion: number;
}

// ─── 规则中心：批量仿真 ──────────────────────────────────────────────────────────
export interface RuleSimulateRowResult {
  index: number;
  matched: boolean;
  outputs: Record<string, unknown>;
  matchedRowIds: string[];
  error?: string;
}

export interface RuleSimulateResult {
  total: number;
  matched: number;
  unmatched: number;
  errors: number;
  rowHits: Array<{ rowId: string; count: number }>;
  results: RuleSimulateRowResult[];
}

// ─── 规则中心：名单库（黑/白/灰名单） ────────────────────────────────────────────
export type RuleListType = 'black' | 'white' | 'grey';

/** 条目匹配模式：exact=精确；prefix=前缀；regex=正则 */
export type RuleListMatchMode = 'exact' | 'prefix' | 'regex';

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
  matchMode: RuleListMatchMode;
  /** 过期时间；到期后自动不再命中 */
  expiresAt?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface RuleListCheckResult {
  hit: boolean;
  listType?: RuleListType;
  item?: { value: string; label?: string | null; matchMode?: RuleListMatchMode; expiresAt?: string | null };
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

// ─── 规则中心：统一求值门面 ──────────────────────────────────────────────────────
/** 统一规则资产引用：kind + key 定位一个可求值资产 */
export interface RuleRef {
  kind: RuleRefKind;
  key: string;
}

/**
 * 统一求值结论信封（rules-runtime decide() 返回值）。
 * 业务消费方只依赖该结构，不感知各资产的解析与快照细节。
 */
export interface RuleDecision {
  matched: boolean;
  outputs: Record<string, unknown>;
  /** 实际求值的资产与版本（名单无版本概念，为 null） */
  ref: { kind: RuleRefKind; key: string; version: number | null };
  /** matched=false 的原因；not_found=资产不存在/未发布/已禁用；error=求值异常（仅 optional 模式） */
  reason?: RuleEvaluateReason | 'not_found' | 'error';
  /** 决策表未命中但按设置回退了默认输出 */
  usedFallback?: boolean;
}

// ─── 规则中心：执行记录（全资产通用） ────────────────────────────────────────────
export interface RuleExecution {
  id: number;
  refKind: RuleRefKind;
  /** 资产行 ID（决策表/流/评分卡/名单）；快照缺失时可为 null */
  refId: number | null;
  ruleKey: string;
  /** 求值所用的发布版本；名单/无版本场景为 null */
  version: number | null;
  /** 调用方标识（如 workflow.gateway / member.coupon / admin.evaluate） */
  caller: string | null;
  /** 调用方展示名：内置调用方为中文名，open.{clientId} 解析为 open.{应用名} */
  callerName: string | null;
  /** 关联上下文（调用方自定语义，如 workflow:42#gateway_1 / payment:order:ORD1 / member:138xxx） */
  bizRef: string | null;
  source: RuleExecutionSource;
  matched: boolean;
  /** 命中策略；仅决策表类记录有值 */
  hitPolicy: RuleHitPolicy | null;
  input: Record<string, unknown>;
  outputs: Record<string, unknown>;
  matchedRowIds: string[];
  createdAt: string;
}
