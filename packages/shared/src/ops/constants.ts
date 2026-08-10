/**
 * 终端会话枚举常量（pg enum / TS union / 前端展示三端共用）。
 */

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
