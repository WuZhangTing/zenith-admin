import { HTTPException } from 'hono/http-exception';
import {
  listSessionsMeta,
  getSessionMeta,
  terminateSession,
  type TerminalSessionMeta,
  type TerminalKind,
} from '../../lib/terminal-session-registry';
import { config } from '../../config';
import { currentUser } from '../../lib/context';
import { getEffectiveTenantId, isPlatformAdmin } from '../../lib/tenant';
import type { JwtPayload } from '../../middleware/auth';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime } from '../../lib/datetime';

/**
 * 判断用户能否观察 / 接管 / 终止归属指定租户的终端会话。
 *
 * 与 `tenantCondition` 同语义，但终端会话存活在内存注册表而非数据库，
 * 无法复用 SQL 条件，因此在此实现同一套判定。
 */
export function canAccessTerminalSession(user: JwtPayload, sessionTenantId: number | null): boolean {
  if (!config.multiTenantMode) return true;
  const effectiveTenantId = getEffectiveTenantId(user);
  // 平台超管未切换租户视角时可见全部会话
  if (isPlatformAdmin(user) && effectiveTenantId === null) return true;
  return sessionTenantId === effectiveTenantId;
}

/** 将注册表元数据映射为对外 DTO（含派生的空闲/持续时长） */
function mapMeta(m: TerminalSessionMeta) {
  const now = Date.now();
  return {
    sessionId: m.sessionId,
    userId: m.userId,
    username: m.username,
    kind: m.kind,
    label: m.label,
    clientIp: m.clientIp,
    cols: m.cols,
    rows: m.rows,
    connected: m.connected,
    observerCount: m.observerCount,
    takenOver: m.takenOver,
    startedAt: formatDateTime(new Date(m.startedAt)),
    lastActivityAt: formatDateTime(new Date(m.lastActivityAt)),
    idleSeconds: Math.max(0, Math.floor((now - m.lastActivityAt) / 1000)),
    durationSeconds: Math.max(0, Math.floor((now - m.startedAt) / 1000)),
  };
}

export interface ListTerminalSessionsParams {
  page: number;
  pageSize: number;
  keyword?: string;
  kind?: TerminalKind;
}

/** 分页列出活动终端会话（内存注册表，进程内分页）。 */
export function listTerminalSessions(params: ListTerminalSessionsParams) {
  const { page, pageSize, keyword, kind } = params;
  const user = currentUser();
  let all = listSessionsMeta().filter((s) => canAccessTerminalSession(user, s.tenantId));
  if (kind) all = all.filter((s) => s.kind === kind);
  if (keyword) {
    const kw = keyword.toLowerCase();
    all = all.filter(
      (s) => s.username.toLowerCase().includes(kw) || s.label.toLowerCase().includes(kw) || s.clientIp.includes(kw),
    );
  }
  const total = all.length;
  const list = all.slice(pageOffset(page, pageSize), page * pageSize).map(mapMeta);
  return { list, total, page, pageSize };
}

/** 获取单个会话快照（用于强制终止前的审计记录）。跨租户返回 null。 */
export function getTerminalSessionSnapshot(sessionId: string) {
  const m = getSessionMeta(sessionId);
  if (!m || !canAccessTerminalSession(currentUser(), m.tenantId)) return null;
  return mapMeta(m);
}

/** 强制终止指定会话。跨租户按「不存在」处理，避免暴露他租户会话的存在性。 */
export function terminateTerminalSession(sessionId: string): void {
  const meta = getSessionMeta(sessionId);
  if (!meta || !canAccessTerminalSession(currentUser(), meta.tenantId)) {
    throw new HTTPException(404, { message: '会话不存在或已结束' });
  }
  terminateSession(sessionId);
}
