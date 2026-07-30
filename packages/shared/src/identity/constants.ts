import type { UserFeedbackCategory, UserFeedbackStatus } from './types';

export const USER_ROLES = ['admin', 'user'] as const;

export const SUPER_ADMIN_CODE = 'super_admin';

export const TENANT_ADMIN_CODE = 'tenant_admin';

export const OAUTH_PROVIDERS = ['github', 'dingtalk', 'wechat_work'] as const;

export type OAuthProviderType = (typeof OAUTH_PROVIDERS)[number];

// ─── 意见反馈 ────────────────────────────────────────────────────────
export const USER_FEEDBACK_CATEGORY_LABELS: Record<UserFeedbackCategory, string> = {
  suggestion: '功能建议',
  bug: '问题反馈',
  ux: '体验问题',
  other: '其他',
};

export const USER_FEEDBACK_STATUS_LABELS: Record<UserFeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

// ─── 自 validation 上移（枚举 SSOT：供跨域 z.enum() 引用，避免 validation 间值环）───
export function isSafeOAuthRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:') {
      return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    }
    const unsafeProtocols = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'blob:']);
    return !unsafeProtocols.has(url.protocol) && /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
  } catch {
    return false;
  }
}
