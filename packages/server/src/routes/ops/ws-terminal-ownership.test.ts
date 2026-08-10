/**
 * Web 终端 WebSocket 会话归属回归测试。
 *
 * 锁定的不变式：handler 只能操作「本连接在 onOpen 中取得的会话引用」。
 * 历史实现按客户端传入的 sessionId 反查注册表，导致：
 *  - 同名 ID 被覆盖登记 → 原 PTY 脱管泄漏，且原连接的输入被写入他人进程；
 *  - 被拒连接的 onClose 仍能清空受害者 currentWs 并安排销毁；
 *  - 任何知道 ID 的人发一帧 terminal:close 即可销毁他人会话。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node-pty', () => ({ spawn: vi.fn() }));
vi.mock('ssh2', () => ({ Client: vi.fn() }));
vi.mock('node:inspector', () => ({ url: () => undefined }));
vi.mock('../../lib/jwt', () => ({
  verifyToken: vi.fn(async (token: string) => {
    const userId = Number(token.replace('user-', ''));
    return { userId, username: `u${userId}`, roles: [], tenantId: null };
  }),
}));
vi.mock('../../lib/session-manager', () => ({ isTokenBlacklisted: vi.fn(async () => false) }));
vi.mock('../../lib/permissions', () => ({
  isSuperAdmin: () => false,
  getUserPermissions: vi.fn(async () => ['system:terminal:execute']),
}));
vi.mock('../../lib/request-helpers', () => ({ getClientIp: () => '127.0.0.1' }));
vi.mock('../../services/ops/terminal-files.service', () => ({ listShells: vi.fn() }));
vi.mock('../../services/ops/ssh-profiles.service', () => ({ getSshConnectParams: vi.fn() }));
vi.mock('../../services/ops/terminal-sessions.service', () => ({ canAccessTerminalSession: () => true }));

import type { UpgradeWebSocket } from 'hono/ws';
import {
  getSession,
  setSession,
  destroySession,
  type TerminalSession,
} from '../../lib/terminal-session-registry';
import { createWsTerminalRoute } from './ws-terminal';

interface FakeWs {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readonly sent: string[];
  readonly closed: { code?: number }[];
}

interface WsHandlers {
  onOpen?: (evt: unknown, ws: FakeWs) => Promise<void> | void;
  onMessage?: (evt: { data: unknown }, ws: FakeWs) => void;
  onClose?: (evt?: unknown, ws?: FakeWs) => void;
}

function makeWs(): FakeWs {
  const sent: string[] = [];
  const closed: { code?: number }[] = [];
  return {
    sent,
    closed,
    send: (data) => { sent.push(data); },
    close: (code) => { closed.push({ code }); },
  };
}

/** 捕获 upgradeWebSocket 收到的 handler 工厂，从而在测试中直接驱动生命周期回调。 */
let handlerFactory: ((c: unknown) => Promise<WsHandlers>) | null = null;
const fakeUpgrade = ((factory: (c: unknown) => Promise<WsHandlers>) => {
  handlerFactory = factory;
  return () => undefined;
}) as unknown as UpgradeWebSocket;

async function connect(query: Record<string, string>): Promise<{ handlers: WsHandlers; ws: FakeWs }> {
  createWsTerminalRoute(fakeUpgrade);
  const ctx = { req: { query: (key: string) => query[key] } };
  const handlers = await handlerFactory!(ctx);
  const ws = makeWs();
  await handlers.onOpen?.(undefined, ws);
  return { handlers, ws };
}

function makeVictimSession(sessionId: string, victimWs: FakeWs): TerminalSession {
  const session: TerminalSession = {
    sessionId,
    process: { write: vi.fn(), resize: vi.fn(), kill: vi.fn() },
    currentWs: victimWs,
    outputBuffer: '',
    idleTimer: null,
    userId: 1,
    username: 'victim',
    tenantId: null,
    kind: 'local',
    label: 'bash',
    clientIp: '127.0.0.1',
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    cols: 80,
    rows: 24,
    observers: new Set(),
    takenOverBy: null,
  };
  setSession(sessionId, session);
  return session;
}

describe('terminal websocket session ownership', () => {
  const SID = 'session-under-attack';

  beforeEach(() => {
    destroySession(SID);
    handlerFactory = null;
  });

  it('refuses to register over an existing session id', () => {
    const victim = makeVictimSession(SID, makeWs());
    const intruder = { ...victim, userId: 2, username: 'intruder' };

    expect(setSession(SID, intruder)).toBe(false);
    expect(getSession(SID)).toBe(victim);
  });

  it('rejects another user reusing a live session id without touching that session', async () => {
    const victimWs = makeWs();
    const victim = makeVictimSession(SID, victimWs);

    const { ws } = await connect({ token: 'user-2', sessionId: SID, shell: 'bash' });

    expect(ws.closed).toEqual([{ code: 4003 }]);
    // 注册表条目仍是受害者的会话，PTY 未被顶替
    expect(getSession(SID)).toBe(victim);
    expect(victim.currentWs).toBe(victimWs);
  });

  it('keeps the victim session alive when the rejected connection closes', async () => {
    const victimWs = makeWs();
    const victim = makeVictimSession(SID, victimWs);

    const { handlers } = await connect({ token: 'user-2', sessionId: SID, shell: 'bash' });
    handlers.onClose?.();

    // 被拒连接的 onClose 不得掐断受害者输出，也不得安排销毁
    expect(victim.currentWs).toBe(victimWs);
    expect(victim.idleTimer).toBeNull();
    expect(getSession(SID)).toBe(victim);
  });

  it('ignores terminal:close sent from a rejected connection', async () => {
    const victim = makeVictimSession(SID, makeWs());

    const { handlers, ws } = await connect({ token: 'user-2', sessionId: SID, shell: 'bash' });
    handlers.onMessage?.({ data: JSON.stringify({ type: 'terminal:close' }) }, ws);

    expect(getSession(SID)).toBe(victim);
    expect(victim.process.kill).not.toHaveBeenCalled();
  });

  it('lets the owner reconnect and does not let the stale connection detach it', async () => {
    const firstWs = makeWs();
    const victim = makeVictimSession(SID, firstWs);
    // 首个连接：模拟其已持有该会话
    const first = await connect({ token: 'user-1', sessionId: SID, shell: 'bash' });
    expect(first.ws.sent.some((m) => m.includes('terminal:reconnected'))).toBe(true);

    // 同一用户的新连接接管会话
    const second = await connect({ token: 'user-1', sessionId: SID, shell: 'bash' });
    expect(victim.currentWs).toBe(second.ws);

    // 旧连接随后关闭：不得清空已被接管的 currentWs
    first.handlers.onClose?.();
    expect(victim.currentWs).toBe(second.ws);
    expect(victim.idleTimer).toBeNull();
  });

  it('rejects a connection without a session id', async () => {
    const { ws } = await connect({ token: 'user-2', shell: 'bash' });
    expect(ws.closed).toEqual([{ code: 4000 }]);
  });
});
