import type { UserFeedbackCategory, UserFeedbackStatus } from './types';

export const USER_ROLES = ['admin', 'user'] as const;

export const SUPER_ADMIN_CODE = 'super_admin';

export const TENANT_ADMIN_CODE = 'tenant_admin';

export const OAUTH_PROVIDERS = ['github', 'dingtalk', 'wechat_work', 'feishu'] as const;

export type OAuthProviderType = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_PROVIDER_LABELS: Record<OAuthProviderType, string> = {
  github: 'GitHub',
  dingtalk: '钉钉',
  wechat_work: '企业微信',
  feishu: '飞书',
};

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

// ─── 通讯录同步 ──────────────────────────────────────────────────────
export const DIRECTORY_SYNC_SOURCE_TYPES = ['ldap', 'dingtalk', 'wechat_work', 'feishu', 'scim'] as const;

export type DirectorySyncSourceType = (typeof DIRECTORY_SYNC_SOURCE_TYPES)[number];

export const DIRECTORY_SYNC_SOURCE_TYPE_LABELS: Record<DirectorySyncSourceType, string> = {
  ldap: 'LDAP / AD',
  dingtalk: '钉钉',
  wechat_work: '企业微信',
  feishu: '飞书',
  scim: 'SCIM 2.0',
};

/** 拉取型源（支持定时/手动全量同步与连接测试）；SCIM 为 IdP 推送型 */
export const DIRECTORY_SYNC_PULL_TYPES = ['ldap', 'dingtalk', 'wechat_work', 'feishu'] as const;

/** 支持平台事件回调的源类型 */
export const DIRECTORY_SYNC_CALLBACK_TYPES = ['dingtalk', 'wechat_work', 'feishu'] as const;

/** 字段映射：可选的源侧标准字段 */
export const DIRECTORY_SYNC_MAPPABLE_SOURCE_FIELDS = ['username', 'nickname', 'email', 'phone'] as const;

export type DirectorySyncMappableSourceField = (typeof DIRECTORY_SYNC_MAPPABLE_SOURCE_FIELDS)[number];

export const DIRECTORY_SYNC_SOURCE_FIELD_LABELS: Record<DirectorySyncMappableSourceField, string> = {
  username: '登录名（username）',
  nickname: '姓名（nickname）',
  email: '邮箱（email）',
  phone: '手机号（phone）',
};

/** 字段映射取值：不同步该字段 */
export const DIRECTORY_SYNC_FIELD_IGNORE = '__ignore__';

export const DIRECTORY_SYNC_MATCH_KEYS = ['phone', 'email', 'username'] as const;

export type DirectorySyncMatchKey = (typeof DIRECTORY_SYNC_MATCH_KEYS)[number];

export const DIRECTORY_SYNC_MATCH_KEY_LABELS: Record<DirectorySyncMatchKey, string> = {
  phone: '手机号',
  email: '邮箱',
  username: '用户名',
};

export const DIRECTORY_SYNC_CONFLICT_POLICIES = ['source', 'local', 'suspend'] as const;

export type DirectorySyncConflictPolicy = (typeof DIRECTORY_SYNC_CONFLICT_POLICIES)[number];

export const DIRECTORY_SYNC_CONFLICT_POLICY_LABELS: Record<DirectorySyncConflictPolicy, string> = {
  source: '源优先（外部覆盖本地）',
  local: '本地优先（保留本地修改）',
  suspend: '挂起人工裁决',
};

export const DIRECTORY_SYNC_RUN_STATUSES = ['running', 'success', 'partial', 'failed', 'aborted'] as const;

export type DirectorySyncRunStatus = (typeof DIRECTORY_SYNC_RUN_STATUSES)[number];

export const DIRECTORY_SYNC_RUN_STATUS_LABELS: Record<DirectorySyncRunStatus, string> = {
  running: '同步中',
  success: '成功',
  partial: '部分失败',
  failed: '失败',
  aborted: '已熔断',
};

export const DIRECTORY_SYNC_TRIGGER_TYPES = ['schedule', 'manual', 'preview', 'callback'] as const;

export type DirectorySyncTriggerType = (typeof DIRECTORY_SYNC_TRIGGER_TYPES)[number];

export const DIRECTORY_SYNC_TRIGGER_TYPE_LABELS: Record<DirectorySyncTriggerType, string> = {
  schedule: '定时',
  manual: '手动',
  preview: '预览',
  callback: '回调',
};

export const DIRECTORY_SYNC_ITEM_ACTIONS = ['create', 'update', 'link', 'disable', 'skip', 'conflict', 'fail'] as const;

export type DirectorySyncItemAction = (typeof DIRECTORY_SYNC_ITEM_ACTIONS)[number];

export const DIRECTORY_SYNC_ITEM_ACTION_LABELS: Record<DirectorySyncItemAction, string> = {
  create: '新增',
  update: '更新',
  link: '绑定',
  disable: '禁用',
  skip: '跳过',
  conflict: '冲突',
  fail: '失败',
};

export const DIRECTORY_SYNC_ENTITY_TYPES = ['user', 'department'] as const;

export type DirectorySyncEntityType = (typeof DIRECTORY_SYNC_ENTITY_TYPES)[number];

export const DIRECTORY_SYNC_ENTITY_TYPE_LABELS: Record<DirectorySyncEntityType, string> = {
  user: '用户',
  department: '部门',
};

export const DIRECTORY_SYNC_CONFLICT_TYPES = ['multi_match', 'field_conflict'] as const;

export type DirectorySyncConflictType = (typeof DIRECTORY_SYNC_CONFLICT_TYPES)[number];

export const DIRECTORY_SYNC_CONFLICT_TYPE_LABELS: Record<DirectorySyncConflictType, string> = {
  multi_match: '匹配到多个本地账号',
  field_conflict: '两侧字段均有修改',
};

export const DIRECTORY_SYNC_CONFLICT_STATUSES = ['pending', 'resolved', 'ignored'] as const;

export type DirectorySyncConflictStatus = (typeof DIRECTORY_SYNC_CONFLICT_STATUSES)[number];

export const DIRECTORY_SYNC_CONFLICT_STATUS_LABELS: Record<DirectorySyncConflictStatus, string> = {
  pending: '待裁决',
  resolved: '已裁决',
  ignored: '已忽略',
};

export const DIRECTORY_SYNC_RESOLUTIONS = ['source', 'local', 'manual'] as const;

export type DirectorySyncResolution = (typeof DIRECTORY_SYNC_RESOLUTIONS)[number];
