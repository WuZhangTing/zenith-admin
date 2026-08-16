import { createLabelOptionsFromMap } from '../core/enum-options';
import type { WorkflowApproveMethod, WorkflowApproverDedupMode } from './types';

export const WORKFLOW_DEFINITION_STATUSES = ['draft', 'published', 'disabled'] as const;

export const WORKFLOW_INSTANCE_STATUSES = ['draft', 'running', 'suspended', 'returned', 'approved', 'rejected', 'withdrawn', 'cancelled'] as const;

/** 活跃（非终态）实例状态：业务键（bizType+bizId）唯一约束仅作用于这些状态，终态后允许同一业务记录重新发起 */
export const WORKFLOW_ACTIVE_INSTANCE_STATUSES = ['draft', 'running', 'suspended', 'returned'] as const;

export const WORKFLOW_TASK_STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const;

export const WORKFLOW_NODE_TYPES = ['start', 'approve', 'end', 'exclusiveGateway', 'parallelGateway', 'ccNode'] as const;

export const WORKFLOW_CONDITION_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'] as const;

/**
 * 流程定义 flowData 的 schema 版本（引擎 schema 版本，区别于用户发布版本号 `version`）。
 * 作为单一真源用于：导出 JSON 标记、导入/发布时的运行时兼容迁移（normalizeFlowData）。
 * 未来引擎 schema 变更（重命名字段 / 合并枚举 / 补默认值等）时 +1，并在 normalizeFlowData 追加 upcast。
 */
export const WORKFLOW_SCHEMA_VERSION = 1;

/** 流程级「自动去重」三模式选项（同一审批人在流程中重复出现时） */
export const WORKFLOW_APPROVER_DEDUP_OPTIONS: ReadonlyArray<{ value: WorkflowApproverDedupMode; label: string }> = [
  { value: 'none',        label: '不自动通过' },
  { value: 'all',         label: '仅审批一次，后续重复的审批节点均自动通过' },
  { value: 'consecutive', label: '仅针对连续审批的节点自动通过' },
];

/**
 * 解析流程级「自动去重」模式。
 * 缺省时默认 'all'（审批一次后续重复节点自动通过）。
 */
export function resolveApproverDedupMode(
  settings: { approverDedupMode?: WorkflowApproverDedupMode } | null | undefined,
): WorkflowApproverDedupMode {
  return settings?.approverDedupMode ?? 'all';
}

/** 流程表单类型：designer=表单库可视化设计器，custom=用户自定义业务页面，external=业务系统主导（businessKey 关联） */
export const WORKFLOW_FORM_TYPES = ['designer', 'custom', 'external'] as const;

export type WorkflowFormType = typeof WORKFLOW_FORM_TYPES[number];

export const WORKFLOW_FORM_TYPE_LABELS: Record<WorkflowFormType, string> = {
  designer: '表单库设计器',
  custom: '自定义业务表单',
  external: '业务系统主导',
};

export const WORKFLOW_APPROVE_METHOD_LABELS: Record<WorkflowApproveMethod, string>
  & Record<string, string> = {
  or: '或签',
  and: '会签',
  sequential: '顺序会签',
  ratio: '比例会签',
  random: '随机一人',
  auto: '自动通过',
};

export const WORKFLOW_APPROVE_METHOD_OPTIONS: Array<{
  value: WorkflowApproveMethod;
  label: string;
}> = createLabelOptionsFromMap<WorkflowApproveMethod>(WORKFLOW_APPROVE_METHOD_LABELS);

/** 流程实例状态标签（web 各视图 / server 分析导出统一复用；Tag 颜色见 web workflow-runtime.ts） */
export const WORKFLOW_INSTANCE_STATUS_LABELS = {
  draft: '草稿',
  running: '审批中',
  suspended: '已挂起',
  returned: '已退回',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
  cancelled: '已取消',
} as const;

/** 审批任务状态标签 */
export const WORKFLOW_TASK_STATUS_LABELS = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  skipped: '已跳过',
  waiting: '等待中',
} as const;
