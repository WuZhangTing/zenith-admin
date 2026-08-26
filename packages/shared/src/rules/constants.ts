/**
 * 规则中心通用常量（SSOT）：统一求值门面的资产类型与执行留痕来源。
 * validation / DTO 通过 z.enum() 引用，前端展示复用 labels。
 */

/** 可求值的规则资产类型：决策表 / 决策流 / 评分卡 / 名单 */
export const RULE_REF_KINDS = ['table', 'flow', 'scorecard', 'list'] as const;

export type RuleRefKind = typeof RULE_REF_KINDS[number];

export const RULE_REF_KIND_LABELS: Record<RuleRefKind, string> = {
  table: '决策表', flow: '决策流', scorecard: '评分卡', list: '名单',
};

/** 执行留痕来源：runtime=业务运行时；manual=后台按 key 求值；test=测试求值；open=开放平台 */
export const RULE_EXECUTION_SOURCES = ['runtime', 'manual', 'test', 'open'] as const;

export type RuleExecutionSource = typeof RULE_EXECUTION_SOURCES[number];

export const RULE_EXECUTION_SOURCE_LABELS: Record<RuleExecutionSource, string> = {
  runtime: '运行时', manual: '手动', test: '测试', open: '开放平台',
};

/** 内置调用方标识 → 展示名；open.{clientId} 由服务端解析为 open.{应用名} */
export const RULE_CALLER_LABELS: Record<string, string> = {
  'admin.test': '后台测试',
  'admin.evaluate': '后台求值',
  'workflow.gateway': '工作流网关',
  'workflow.assignee': '工作流审批人解析',
  'member.coupon': '优惠券资格判定',
  'member.auth': '会员认证风控',
  'payment.risk': '支付风控',
};
