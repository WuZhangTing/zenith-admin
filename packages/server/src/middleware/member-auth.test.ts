/**
 * 会员认证中间件隔离测试（内存集成测试，不走网络）。
 *
 * 安全关键：验证 memberAuthMiddleware 仅接受 type='member' 的 token，
 * 拒绝管理员 token（无 type='member'），杜绝前台/后台两套用户体系互窜。
 *
 * Mock 策略：config / member-session-manager / db / logger 全部 mock，
 * 用固定测试密钥签发 JWT，覆盖隔离的各条边界。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { contextStorage } from 'hono/context-storage';

const TEST_JWT_SECRET = 'unit-test-only-fake-secret-do-not-use-in-production';

vi.mock('../config', () => ({
  config: {
    jwtSecret: 'unit-test-only-fake-secret-do-not-use-in-production',
    jwtRefreshSecret: 'unit-test-only-fake-refresh-secret',
    port: 3300,
    databaseUrl: 'mock://localhost/test',
    multiTenantMode: false,
    redis: { keyPrefix: 'test:' },
    log: { level: 'silent', dir: 'logs', maxFiles: '30d' },
  },
}));

vi.mock('../lib/member-session-manager', () => ({
  isMemberTokenBlacklisted: vi.fn().mockResolvedValue(false),
  touchMemberSession: vi.fn().mockResolvedValue(true),
  registerMemberSession: vi.fn(),
}));

vi.mock('../db', () => ({
  db: { select: vi.fn() },
}));

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { memberAuthMiddleware } from './member-auth';
import { db } from '../db';

const dbMock = vi.mocked(db);

// Minimal thenable Drizzle chain used by the live member/tenant lookup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'leftJoin', 'where', 'limit']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function activeMemberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nickname: 'Alice',
    phone: '13800138000',
    username: 'alice',
    email: null,
    status: 'active',
    tenantId: null,
    tenantStatus: null,
    tenantExpireAt: null,
    ...overrides,
  };
}

const now = () => Math.floor(Date.now() / 1000);

async function makeMemberToken(overrides: Record<string, unknown> = {}) {
  return sign(
    { memberId: 1, identifier: '13800138000', type: 'member', tenantId: null, jti: 'test-jti', iat: now(), exp: now() + 3600, ...overrides },
    TEST_JWT_SECRET,
    'HS256',
  );
}

async function makeAdminToken() {
  return sign(
    { userId: 1, username: 'admin', roles: ['admin'], tenantId: null, jti: 'admin-jti', iat: now(), exp: now() + 3600 },
    TEST_JWT_SECRET,
    'HS256',
  );
}

function buildApp() {
  const app = new Hono();
  app.use('*', contextStorage());
  app.get('/protected', memberAuthMiddleware, (c) => {
    const m = c.get('member');
    return c.json({ code: 0, message: 'ok', data: { memberId: m.memberId } });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.select.mockReturnValue(createChain([activeMemberRow()]));
});

describe('memberAuthMiddleware - token 隔离（安全关键）', () => {
  it('无 Authorization 头 → 401 未登录', async () => {
    const res = await buildApp().request('/protected');
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('未登录');
  });

  it('合法会员 token（type=member）→ 200 通过并注入 member', async () => {
    const token = await makeMemberToken();
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.memberId).toBe(1);
  });

  it('会员已被封禁 → 403，旧 access token 立即失效', async () => {
    dbMock.select.mockReturnValueOnce(createChain([activeMemberRow({ status: 'banned' })]));
    const token = await makeMemberToken();
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('账号不可用');
  });

  it('会员已删除/不存在 → 401，旧 access token 立即失效', async () => {
    dbMock.select.mockReturnValueOnce(createChain([]));
    const token = await makeMemberToken();
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('会员不存在');
  });

  it('会员租户被禁用 → 403，旧 access token 立即失效', async () => {
    dbMock.select.mockReturnValueOnce(createChain([activeMemberRow({ tenantId: 7, tenantStatus: 'disabled' })]));
    const token = await makeMemberToken({ tenantId: 7 });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('租户已被禁用或过期');
  });

  it('会员租户已过期 → 403，旧 access token 立即失效', async () => {
    dbMock.select.mockReturnValueOnce(createChain([activeMemberRow({
      tenantId: 7,
      tenantStatus: 'enabled',
      tenantExpireAt: new Date(Date.now() - 1000),
    })]));
    const token = await makeMemberToken({ tenantId: 7 });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(403);
    expect((await res.json()).message).toBe('租户已被禁用或过期');
  });

  it('会员租户声明与数据库不一致 → 401', async () => {
    dbMock.select.mockReturnValueOnce(createChain([activeMemberRow({ tenantId: 7, tenantStatus: 'enabled' })]));
    const token = await makeMemberToken({ tenantId: null });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('登录状态已失效，请重新登录');
  });

  it('管理员 token（无 type=member）→ 401 无效的会员令牌（杜绝越权）', async () => {
    const token = await makeAdminToken();
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe('无效的会员令牌');
  });

  it('type 被篡改为非 member → 401', async () => {
    const token = await makeMemberToken({ type: 'admin' });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('缺少 memberId 的 token → 401', async () => {
    const token = await makeMemberToken({ memberId: undefined });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });

  it('无效 JWT 字符串 → 401', async () => {
    const res = await buildApp().request('/protected', { headers: { Authorization: 'Bearer invalid.jwt.token' } });
    expect(res.status).toBe(401);
  });

  it('过期会员 token → 401', async () => {
    const token = await makeMemberToken({ iat: now() - 10, exp: now() - 1 });
    const res = await buildApp().request('/protected', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(401);
  });
});
