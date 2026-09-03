/**
 * 第三方 OAuth 登录 / 绑定安全契约（H2）：
 * 1. state 服务端单次消费，provider / 意图 / 发起用户不匹配即拒绝；
 * 2. 未绑定的外部身份默认 needBind；只有配置开启 autoLinkByEmail、邮箱已验证、唯一命中、账号启用、非平台超管才自动关联；
 * 3. 登录收口走 completeLoginWithMfa（MFA / 密码过期 / 登录日志与密码登录一致）；
 * 4. 绑定使用独立的 bind 意图 state，且必须由发起者本人完成。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from 'hono/http-exception';

vi.mock('../../db', () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    $count: vi.fn(),
    transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
  };
  return { db };
});
vi.mock('../../lib/redis', () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));
vi.mock('../../config', () => ({ config: { redis: { keyPrefix: 'test:' } } }));
vi.mock('../../lib/context', () => ({ currentUser: vi.fn() }));
vi.mock('../../lib/oauth', () => ({
  getOAuthProvider: vi.fn(),
  isProviderConfigured: vi.fn(async () => true),
  listConfiguredProviders: vi.fn(async () => ['github']),
}));
vi.mock('./auth.service', () => ({ completeLoginWithMfa: vi.fn() }));
vi.mock('./role-grant', () => ({ userHasPlatformSuperRole: vi.fn(async () => false) }));

import { db } from '../../db';
import redis from '../../lib/redis';
import { currentUser } from '../../lib/context';
import { getOAuthProvider } from '../../lib/oauth';
import { completeLoginWithMfa } from './auth.service';
import { userHasPlatformSuperRole } from './role-grant';
import { bindOAuthAccount, generateAuthUrl, generateBindAuthUrl, handleOAuthCallback } from './oauth.service';
import type { JwtPayload } from '../../middleware/auth';

const dbMock = vi.mocked(db);
const redisMock = vi.mocked(redis);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown = []): any {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit', 'set', 'values', 'returning']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

const client = { ip: '1.1.1.1', ua: 'ua' };
const localUser = { id: 42, username: 'alice', email: 'alice@example.com', status: 'enabled', tenantId: null, password: 'x' };
const providerStub = {
  provider: 'github' as const,
  getAuthUrl: vi.fn((state: string) => `https://idp.example/authorize?state=${state}`),
  getToken: vi.fn(async () => ({ accessToken: 'at' })),
  getUserInfo: vi.fn(async () => ({ openId: 'gh-1', nickname: 'alice', email: 'alice@example.com', emailVerified: true })),
};

function storedState(payload: Record<string, unknown>) {
  redisMock.get.mockResolvedValueOnce(JSON.stringify({ createdAt: Date.now(), ...payload }));
}

async function expectHttpError(fn: () => Promise<unknown>, status: number) {
  try {
    await fn();
    expect.unreachable('should have thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(HTTPException);
    expect((err as HTTPException).status).toBe(status);
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getOAuthProvider).mockResolvedValue(providerStub as never);
  providerStub.getToken.mockResolvedValue({ accessToken: 'at' });
  providerStub.getUserInfo.mockResolvedValue({ openId: 'gh-1', nickname: 'alice', email: 'alice@example.com', emailVerified: true });
  providerStub.getAuthUrl.mockImplementation((state: string) => `https://idp.example/authorize?state=${state}`);
  vi.mocked(userHasPlatformSuperRole).mockResolvedValue(false);
  redisMock.set.mockResolvedValue('OK' as never);
  redisMock.del.mockResolvedValue(1 as never);
});

describe('generateAuthUrl / generateBindAuthUrl', () => {
  it('登录：签发随机 state 并以 login 意图存入 Redis（带 TTL）', async () => {
    const { authUrl, state } = await generateAuthUrl('github');
    expect(state).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(authUrl).toContain(`state=${state}`);
    expect(redisMock.set).toHaveBeenCalledWith(`test:oauth-state:${state}`, expect.stringContaining('"intent":"login"'), 'EX', 600);
  });

  it('绑定：state 绑定到当前用户', async () => {
    vi.mocked(currentUser).mockReturnValue({ userId: 7 } as JwtPayload);
    const { state } = await generateBindAuthUrl('github');
    const stored = JSON.parse(redisMock.set.mock.calls[0][1] as string);
    expect(stored).toMatchObject({ provider: 'github', intent: 'bind', userId: 7 });
    expect(state).toHaveLength(32);
  });

  it('未知 / 未配置的提供方 → 400', async () => {
    await expectHttpError(() => generateAuthUrl('nope'), 400);
  });
});

describe('handleOAuthCallback（登录）', () => {
  it('state 不存在（过期 / 已消费）→ 400，不与提供方交换 code', async () => {
    redisMock.get.mockResolvedValueOnce(null);
    await expectHttpError(() => handleOAuthCallback('github', { code: 'c', state: 's' }, client), 400);
    expect(providerStub.getToken).not.toHaveBeenCalled();
  });

  it('state 属于其他提供方或绑定意图 → 400，且 state 已被删除（单次消费）', async () => {
    storedState({ provider: 'feishu', intent: 'login' });
    await expectHttpError(() => handleOAuthCallback('github', { code: 'c', state: 's' }, client), 400);
    expect(redisMock.del).toHaveBeenCalledWith('test:oauth-state:s');

    storedState({ provider: 'github', intent: 'bind', userId: 1 });
    await expectHttpError(() => handleOAuthCallback('github', { code: 'c', state: 's2' }, client), 400);
  });

  it('已绑定的外部身份 → 刷新令牌并经 completeLoginWithMfa 登录', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([{ id: 9, userId: 42 }])) // userOauthAccounts
      .mockReturnValueOnce(createChain([localUser])); // users
    dbMock.update.mockReturnValueOnce(createChain([]));
    vi.mocked(completeLoginWithMfa).mockResolvedValue({ token: { accessToken: 'a', refreshToken: 'r' } } as never);

    const result = await handleOAuthCallback('github', { code: 'c', state: 's', deviceId: 'd1' }, client);

    expect(completeLoginWithMfa).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }), expect.objectContaining({ ip: '1.1.1.1', deviceId: 'd1' }), expect.stringContaining('github'));
    expect(result.data).toEqual({ token: { accessToken: 'a', refreshToken: 'r' } });
    expect(result.message).toBe('登录成功');
  });

  it('MFA 命中时透传挑战', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select.mockReturnValueOnce(createChain([{ id: 9, userId: 42 }])).mockReturnValueOnce(createChain([localUser]));
    dbMock.update.mockReturnValueOnce(createChain([]));
    vi.mocked(completeLoginWithMfa).mockResolvedValue({ mfaRequired: true, challengeId: 'ch', methods: ['totp'], expiresAt: 1, reason: null } as never);

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ mfaRequired: true, challengeId: 'ch' });
    expect(result.message).toBe('请完成多因素认证');
  });

  it('未绑定 + 配置未开启 autoLinkByEmail → needBind，不查询用户表', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([])) // userOauthAccounts
      .mockReturnValueOnce(createChain([{ autoLinkByEmail: false }])); // oauthConfigs

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ needBind: true, oauthInfo: { provider: 'github', openId: 'gh-1' } });
    expect(dbMock.select).toHaveBeenCalledTimes(2);
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(completeLoginWithMfa).not.toHaveBeenCalled();
  });

  it('未绑定 + 邮箱未验证 → needBind（即使开启了 autoLinkByEmail）', async () => {
    storedState({ provider: 'github', intent: 'login' });
    providerStub.getUserInfo.mockResolvedValueOnce({ openId: 'gh-1', nickname: 'alice', email: 'alice@example.com', emailVerified: false });
    dbMock.select.mockReturnValueOnce(createChain([]));

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ needBind: true });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it('未绑定 + 开启 autoLinkByEmail + 已验证邮箱唯一命中 → 关联并登录', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ autoLinkByEmail: true }]))
      .mockReturnValueOnce(createChain([localUser])) // 按邮箱匹配
      .mockReturnValueOnce(createChain([localUser])); // 重新加载用户
    const insertChain = createChain([]);
    dbMock.insert.mockReturnValueOnce(insertChain);
    vi.mocked(completeLoginWithMfa).mockResolvedValue({ token: { accessToken: 'a', refreshToken: 'r' } } as never);

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, provider: 'github', openId: 'gh-1' }));
    expect(result.message).toBe('登录成功');
  });

  it('邮箱命中多个账号（跨租户同邮箱）→ needBind', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ autoLinkByEmail: true }]))
      .mockReturnValueOnce(createChain([localUser, { ...localUser, id: 43, tenantId: 2 }]));

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ needBind: true });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('命中的账号是平台超管 → 永不自动关联', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ autoLinkByEmail: true }]))
      .mockReturnValueOnce(createChain([localUser]));
    vi.mocked(userHasPlatformSuperRole).mockResolvedValue(true);

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ needBind: true });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('命中的账号已禁用 → needBind（不建立绑定）', async () => {
    storedState({ provider: 'github', intent: 'login' });
    dbMock.select
      .mockReturnValueOnce(createChain([]))
      .mockReturnValueOnce(createChain([{ autoLinkByEmail: true }]))
      .mockReturnValueOnce(createChain([{ ...localUser, status: 'disabled' }]));

    const result = await handleOAuthCallback('github', { code: 'c', state: 's' }, client);
    expect(result.data).toMatchObject({ needBind: true });
  });
});

describe('bindOAuthAccount（绑定）', () => {
  beforeEach(() => {
    vi.mocked(currentUser).mockReturnValue({ userId: 7 } as JwtPayload);
  });

  it('state 属于其他用户 → 403，不与提供方交换 code', async () => {
    storedState({ provider: 'github', intent: 'bind', userId: 99 });
    await expectHttpError(() => bindOAuthAccount('github', 'c', 's'), 403);
    expect(providerStub.getToken).not.toHaveBeenCalled();
  });

  it('登录意图的 state 不能用于绑定 → 400', async () => {
    storedState({ provider: 'github', intent: 'login' });
    await expectHttpError(() => bindOAuthAccount('github', 'c', 's'), 400);
  });

  it('合法 bind state → 写入绑定记录', async () => {
    storedState({ provider: 'github', intent: 'bind', userId: 7 });
    dbMock.select
      .mockReturnValueOnce(createChain([])) // 该 openId 未被绑定
      .mockReturnValueOnce(createChain([])); // 我尚未绑定该提供方
    const insertChain = createChain([]);
    dbMock.insert.mockReturnValueOnce(insertChain);

    await bindOAuthAccount('github', 'c', 's');
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining({ userId: 7, provider: 'github', openId: 'gh-1' }));
  });

  it('该第三方身份已被他人绑定 → 400', async () => {
    storedState({ provider: 'github', intent: 'bind', userId: 7 });
    dbMock.select.mockReturnValueOnce(createChain([{ id: 1, userId: 8 }]));
    await expectHttpError(() => bindOAuthAccount('github', 'c', 's'), 400);
  });
});
