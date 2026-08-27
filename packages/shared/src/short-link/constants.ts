import { createLabelOptions } from '../core/enum-options';

// ─── 跳转方式 ─────────────────────────────────────────────────────────────────
export const SHORT_LINK_REDIRECT_TYPES = ['302', '301'] as const;

export type ShortLinkRedirectType = (typeof SHORT_LINK_REDIRECT_TYPES)[number];

export const SHORT_LINK_REDIRECT_TYPE_LABELS: Record<ShortLinkRedirectType, string> = {
  '302': '302 临时跳转',
  '301': '301 永久跳转',
};

export const SHORT_LINK_REDIRECT_TYPE_OPTIONS = createLabelOptions(SHORT_LINK_REDIRECT_TYPES, SHORT_LINK_REDIRECT_TYPE_LABELS);

// ─── 来源业务类型 ─────────────────────────────────────────────────────────────
export const SHORT_LINK_BIZ_TYPES = ['custom', 'sms', 'broadcast', 'payment_link', 'cms_content'] as const;

export type ShortLinkBizType = (typeof SHORT_LINK_BIZ_TYPES)[number];

export const SHORT_LINK_BIZ_TYPE_LABELS: Record<ShortLinkBizType, string> = {
  custom: '手工创建',
  sms: '短信',
  broadcast: '消息广播',
  payment_link: '收款链接',
  cms_content: 'CMS 内容',
};

export const SHORT_LINK_BIZ_TYPE_OPTIONS = createLabelOptions(SHORT_LINK_BIZ_TYPES, SHORT_LINK_BIZ_TYPE_LABELS);

// ─── 短码规则 ─────────────────────────────────────────────────────────────────
/** 自动生成短码使用的字符表：base62 剔除易混字符 0/O/1/l/I */
export const SHORT_LINK_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';

/** 自动生成短码长度 */
export const SHORT_LINK_CODE_LENGTH = 7;

export const SHORT_LINK_CODE_MIN = 4;

export const SHORT_LINK_CODE_MAX = 32;

/** 自定义短码字符集：字母、数字、连字符、下划线 */
export const SHORT_LINK_CODE_PATTERN = /^[0-9A-Za-z_-]+$/;

/** 保留短码（避免与系统路径、常见入口冲突，自定义短码禁止使用） */
export const SHORT_LINK_RESERVED_CODES = [
  'api', 'admin', 's', 'static', 'assets', 'docs', 'metrics', 'login', 'logout',
  'oauth', 'oauth2', 'pay', 'app', 'ws', 'files', 'public', 'health',
] as const;

// ─── 统计 ─────────────────────────────────────────────────────────────────────
/** 统计视图默认时间窗口（天） */
export const SHORT_LINK_STATS_DEFAULT_DAYS = 30;

export const SHORT_LINK_STATS_MAX_DAYS = 90;

/** 维度分布 Top N */
export const SHORT_LINK_STATS_TOP_LIMIT = 10;
