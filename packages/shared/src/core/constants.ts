import { createLabelOptions, createLabelOptionsFromMap } from './enum-options';

export const API_PREFIX = '/api';

export const TOKEN_KEY = 'zenith_token';

export const REFRESH_TOKEN_KEY = 'zenith_refresh_token';

export const PREFERENCES_KEY = 'zenith_preferences';

export const TABS_STORAGE_KEY = 'zenith_tabs';

export const USER_STATUSES = ['enabled', 'disabled'] as const;

/** 通用启用/禁用状态标签（与 common_status 字典种子文案一致；server 导出等无法走字典的场景使用） */
export const COMMON_STATUS_LABELS = { enabled: '启用', disabled: '禁用' } as const;

/** 通用启用/禁用下拉选项（与 COMMON_STATUS_LABELS 自动同步；行为中心事件覆盖/分群等复用） */
export const COMMON_STATUS_OPTIONS: Array<{ value: keyof typeof COMMON_STATUS_LABELS; label: string }> =
  createLabelOptionsFromMap(COMMON_STATUS_LABELS);

// ─── 会员中心（Member Center）────────────────────────────────────────
/** 会员前台 token 的 localStorage key（与管理员 zenith_token 隔离）*/
export const MEMBER_TOKEN_KEY = 'zenith_member_token';

export const MEMBER_REFRESH_TOKEN_KEY = 'zenith_member_refresh_token';

// ─── 通用比较运算符 ────────────────────────────────────────────────────
export const BASIC_COMPARISON_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;

export type BasicComparisonOperator = (typeof BASIC_COMPARISON_OPERATORS)[number];

export const BASIC_COMPARISON_OPERATOR_LABELS: Record<BasicComparisonOperator, string> = {
  eq: '等于 =',
  neq: '不等于 ≠',
  gt: '大于 >',
  gte: '大于等于 ≥',
  lt: '小于 <',
  lte: '小于等于 ≤',
};

export const BASIC_COMPARISON_OPERATOR_OPTIONS: Array<{ value: BasicComparisonOperator; label: string }> =
  createLabelOptions(BASIC_COMPARISON_OPERATORS, BASIC_COMPARISON_OPERATOR_LABELS);

export const BASIC_COMPARISON_OPERATOR_SYMBOLS: Record<BasicComparisonOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

export const BASIC_COMPARISON_SYMBOL_OPTIONS: Array<{
  value: BasicComparisonOperator;
  label: string;
}> = createLabelOptions(BASIC_COMPARISON_OPERATORS, BASIC_COMPARISON_OPERATOR_SYMBOLS);

// ─── 自 validation 上移（枚举 SSOT：供跨域 z.enum() 引用，避免 validation 间值环）───
export const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
