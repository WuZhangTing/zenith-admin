/**
 * 终端会话枚举常量（pg enum / TS union / 前端展示三端共用）。
 */
import { createLabelOptions } from '../core/enum-options';

/**
 * 终端会话生命周期状态。
 *
 * active 起步即为终态之前的唯一"可写"状态：会话只有在进程创建成功后才登记，
 * 因此不存在 creating 中间态；进程创建失败直接落 failed。
 */
export const TERMINAL_SESSION_STATES = ['active', 'detached', 'terminated', 'failed'] as const;
export type TerminalSessionState = (typeof TERMINAL_SESSION_STATES)[number];

export const TERMINAL_SESSION_STATE_LABELS: Record<TerminalSessionState, string> = {
  active: '连接中',
  detached: '已断开',
  terminated: '已结束',
  failed: '异常终止',
};

/** 终端会话运行目标类型 */
export const TERMINAL_SESSION_KINDS = ['local', 'ssh', 'docker'] as const;
export type TerminalSessionKind = (typeof TERMINAL_SESSION_KINDS)[number];

export const TERMINAL_SESSION_KIND_LABELS: Record<TerminalSessionKind, string> = {
  local: '本地',
  ssh: 'SSH',
  docker: 'Docker',
};

/** 会话结束原因；落库用于事后追溯"这个会话是怎么没的" */
export const TERMINAL_END_REASONS = [
  'client_closed',
  'process_exited',
  'idle_timeout',
  'terminated_by_admin',
  'server_shutdown',
  'start_failed',
] as const;
export type TerminalEndReason = (typeof TERMINAL_END_REASONS)[number];

export const TERMINAL_END_REASON_LABELS: Record<TerminalEndReason, string> = {
  client_closed: '用户关闭',
  process_exited: '进程退出',
  idle_timeout: '断开超时回收',
  terminated_by_admin: '管理员终止',
  server_shutdown: '服务停机',
  start_failed: '启动失败',
};

// ─── 应用版本管理（在线升级）──────────────────────────────────────────────────

/** 发布渠道 */
export const APP_RELEASE_CHANNELS = ['stable', 'beta', 'internal'] as const;
export type AppReleaseChannel = (typeof APP_RELEASE_CHANNELS)[number];

export const APP_RELEASE_CHANNEL_LABELS: Record<AppReleaseChannel, string> = {
  stable: '正式版',
  beta: '测试版',
  internal: '内部版',
};

export const APP_RELEASE_CHANNEL_OPTIONS: Array<{ value: AppReleaseChannel; label: string }> =
  createLabelOptions(APP_RELEASE_CHANNELS, APP_RELEASE_CHANNEL_LABELS);

/** 版本发布状态机：draft → published → revoked（revoked 可重新 published） */
export const APP_RELEASE_STATUSES = ['draft', 'published', 'revoked'] as const;
export type AppReleaseStatus = (typeof APP_RELEASE_STATUSES)[number];

export const APP_RELEASE_STATUS_LABELS: Record<AppReleaseStatus, string> = {
  draft: '草稿',
  published: '已发布',
  revoked: '已撤回',
};

export const APP_RELEASE_STATUS_OPTIONS: Array<{ value: AppReleaseStatus; label: string }> =
  createLabelOptions(APP_RELEASE_STATUSES, APP_RELEASE_STATUS_LABELS);

/** 客户端平台 */
export const APP_PLATFORMS = ['windows', 'macos', 'linux', 'android', 'ios', 'web'] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export const APP_PLATFORM_LABELS: Record<AppPlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
  web: 'Web',
};

export const APP_PLATFORM_OPTIONS: Array<{ value: AppPlatform; label: string }> =
  createLabelOptions(APP_PLATFORMS, APP_PLATFORM_LABELS);

/** CPU 架构 */
export const APP_ARCHES = ['x64', 'arm64', 'universal'] as const;
export type AppArch = (typeof APP_ARCHES)[number];

export const APP_ARCH_LABELS: Record<AppArch, string> = {
  x64: 'x64',
  arm64: 'ARM64',
  universal: '通用',
};

export const APP_ARCH_OPTIONS: Array<{ value: AppArch; label: string }> =
  createLabelOptions(APP_ARCHES, APP_ARCH_LABELS);

/**
 * 制品类型。
 * installer=完整安装包 hotupdate=Web 资源热更包 metadata=electron-updater
 * 元数据（latest.yml / blockmap）external=外部链接（App Store / TestFlight）
 */
export const APP_ARTIFACT_KINDS = ['installer', 'hotupdate', 'metadata', 'external'] as const;
export type AppArtifactKind = (typeof APP_ARTIFACT_KINDS)[number];

export const APP_ARTIFACT_KIND_LABELS: Record<AppArtifactKind, string> = {
  installer: '安装包',
  hotupdate: '热更新包',
  metadata: '元数据',
  external: '外部链接',
};

export const APP_ARTIFACT_KIND_OPTIONS: Array<{ value: AppArtifactKind; label: string }> =
  createLabelOptions(APP_ARTIFACT_KINDS, APP_ARTIFACT_KIND_LABELS);

/** 走文件上传的制品类型（external 走外链录入，不上传文件） */
export const APP_FILE_ARTIFACT_KINDS = ['installer', 'hotupdate', 'metadata'] as const;
export type AppFileArtifactKind = (typeof APP_FILE_ARTIFACT_KINDS)[number];

/** 升级事件类型（check 由服务端记录，install_* 由客户端回执上报） */
export const APP_RELEASE_EVENT_TYPES = ['check', 'download', 'install_success', 'install_fail'] as const;
export type AppReleaseEventType = (typeof APP_RELEASE_EVENT_TYPES)[number];

export const APP_RELEASE_EVENT_TYPE_LABELS: Record<AppReleaseEventType, string> = {
  check: '检查更新',
  download: '下载',
  install_success: '安装成功',
  install_fail: '安装失败',
};

/** 客户端可主动上报的事件（download 与 check 由服务端记录） */
export const APP_CLIENT_REPORTABLE_EVENT_TYPES = ['install_success', 'install_fail'] as const;
export type AppClientReportableEventType = (typeof APP_CLIENT_REPORTABLE_EVENT_TYPES)[number];

/** semver 校验（允许预发布 / 构建元数据后缀，如 1.2.3-beta.1） */
export const APP_SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;
