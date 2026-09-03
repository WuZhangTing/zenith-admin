/**
 * 会员短信验证码服务（H4）：
 * - 验证码明文永不写日志；
 * - 仅开发模式回传 devCode；
 * - 非开发模式下未配置渠道 / 发送失败直接报错并回滚本次验证码与发送间隔。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from 'hono/http-exception';

vi.mock('../../config', () => ({ config: { isDevelopment: false, redis: { keyPrefix: 'test:' } } }));
vi.mock('../../lib/redis', () => ({
  default: { ttl: vi.fn(), set: vi.fn(), del: vi.fn(), get: vi.fn(), incr: vi.fn(), expire: vi.fn() },
}));
vi.mock('../../lib/logger', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../../db', () => {
  const db = { select: vi.fn() };
  return { db };
});
vi.mock('../messaging/sms-configs.service', () => ({ findDefaultSmsConfig: vi.fn() }));
vi.mock('../../lib/sms-sender', () => ({ sendSmsByProvider: vi.fn(), renderTemplate: vi.fn((t: string) => t) }));

import { config } from '../../config';
import redis from '../../lib/redis';
import logger from '../../lib/logger';
import { db } from '../../db';
import { findDefaultSmsConfig } from '../messaging/sms-configs.service';
import { sendSmsByProvider } from '../../lib/sms-sender';
import { sendMemberSmsCode } from './member-sms.service';

const redisMock = vi.mocked(redis);
const dbMock = vi.mocked(db);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function allLogged(): string {
  return [...vi.mocked(logger.warn).mock.calls, ...vi.mocked(logger.info).mock.calls, ...vi.mocked(logger.error).mock.calls]
    .map((c) => c.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
    .join('\n');
}

/** 从 redis.set 的调用里取出本次生成的验证码 */
function issuedCode(): string {
  const call = redisMock.set.mock.calls.find((c) => String(c[0]).startsWith('test:member:smscode:login:'));
  return String(call?.[1]);
}

function mockProviderConfigured(success: boolean) {
  vi.mocked(findDefaultSmsConfig).mockResolvedValue({ provider: 'aliyun' } as never);
  dbMock.select.mockReturnValueOnce(createChain([{ id: 1, content: '您的验证码是 {{code}}', provider: 'aliyun', status: 'enabled' }]));
  vi.mocked(sendSmsByProvider).mockResolvedValue({ success } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  config.isDevelopment = false;
  redisMock.ttl.mockResolvedValue(-2);
  redisMock.set.mockResolvedValue('OK' as never);
  redisMock.del.mockResolvedValue(1 as never);
});

describe('sendMemberSmsCode', () => {
  it('发送间隔内再次请求 → 429', async () => {
    redisMock.ttl.mockResolvedValue(42);
    await expect(sendMemberSmsCode('13800138000', 'login')).rejects.toMatchObject({ status: 429 });
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('非开发模式 + 成功投递：不回传验证码，日志里不出现验证码', async () => {
    mockProviderConfigured(true);
    const result = await sendMemberSmsCode('13800138000', 'login');
    expect(result).toEqual({});
    expect(allLogged()).not.toContain(issuedCode());
  });

  it('非开发模式 + 未配置短信渠道 → 503，回滚验证码与发送间隔，日志只含脱敏号码', async () => {
    vi.mocked(findDefaultSmsConfig).mockResolvedValue(null as never);
    try {
      await sendMemberSmsCode('13800138000', 'register');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HTTPException);
      expect((err as HTTPException).status).toBe(503);
    }
    expect(redisMock.del).toHaveBeenCalledWith('test:member:smscode:register:13800138000');
    expect(redisMock.del).toHaveBeenCalledWith('test:member:smscode-interval:13800138000');
    const logged = allLogged();
    expect(logged).toContain('138****8000');
    expect(logged).not.toContain('13800138000');
    const code = String(redisMock.set.mock.calls.find((c) => String(c[0]).includes('smscode:register'))?.[1]);
    expect(logged).not.toContain(code);
  });

  it('非开发模式 + 服务商返回失败 → 502 并回滚', async () => {
    mockProviderConfigured(false);
    await expect(sendMemberSmsCode('13800138000', 'reset')).rejects.toMatchObject({ status: 502 });
    expect(redisMock.del).toHaveBeenCalledWith('test:member:smscode:reset:13800138000');
  });

  it('非开发模式 + 服务商抛异常 → 502（异常不冒泡为 500）', async () => {
    vi.mocked(findDefaultSmsConfig).mockResolvedValue({ provider: 'aliyun' } as never);
    dbMock.select.mockReturnValueOnce(createChain([{ id: 1, content: '{{code}}', provider: 'aliyun', status: 'enabled' }]));
    vi.mocked(sendSmsByProvider).mockRejectedValue(new Error('network down'));
    await expect(sendMemberSmsCode('13800138000', 'login')).rejects.toMatchObject({ status: 502 });
  });

  it('开发模式 + 未配置渠道：回传 devCode 供联调，验证码保留在 Redis，且仍不写日志', async () => {
    config.isDevelopment = true;
    vi.mocked(findDefaultSmsConfig).mockResolvedValue(null as never);
    const result = await sendMemberSmsCode('13800138000', 'login');
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(result.devCode).toBe(issuedCode());
    expect(redisMock.del).not.toHaveBeenCalledWith('test:member:smscode:login:13800138000');
    expect(allLogged()).not.toContain(result.devCode!);
  });

  it('开发模式 + 成功投递：同样回传 devCode', async () => {
    config.isDevelopment = true;
    mockProviderConfigured(true);
    const result = await sendMemberSmsCode('13800138000', 'login');
    expect(result.devCode).toBe(issuedCode());
  });
});
