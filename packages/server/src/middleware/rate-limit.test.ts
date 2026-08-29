/**
 * 接口限流中间件单测。
 *
 * 覆盖要点：
 *  1. 固定窗口：到限额放行、超限 429，标准 RateLimit-* 头与 Retry-After
 *  2. monitor 观察模式：超限只记拦截统计，请求放行
 *  3. 同请求规则去重：named + pathBound 命中同一规则只计一次
 *  4. 路径绑定：exact 与 /* 通配匹配、多规则命中按 priority 取大者
 *  5. 禁用规则直接放行（不触 Redis）
 *  6. Redis 故障放行（可用性优先于限流精确性）
 *  7. 解封：删除计数键 + 按裸身份清理 recent 记录（JSON member）
 *  8. 目录一致性：内置规则全部登记在 PREDEFINED_NAMES 且无死规则
 *
 * Mock 策略：redis 用带状态的内存假实现（eval 模拟固定窗口 Lua 语义），
 * config / db / logger / context 全部 mock。Lua 脚本本身的正确性由真实 Redis 冒烟验证。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../config', () => ({
  config: { redis: { keyPrefix: 'test:' }, trustedProxyCidrs: [] },
}));

vi.mock('../lib/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/context', () => ({
  currentUser: vi.fn(() => undefined),
}));

// refreshRateLimitRules 经 db.select().from() 读规则表；测试通过它注入自定义规则
const dbRows: unknown[] = [];
vi.mock('../db', () => ({
  db: { select: () => ({ from: () => Promise.resolve(dbRows) }) },
}));

// ─── 带状态的 Redis 假实现 ─────────────────────────────────────────────────────
interface CounterState { count: number; expiresAt: number }
const counters = new Map<string, CounterState>();
const zsets = new Map<string, string[]>();
let evalFails = false;

const redisMock = {
  eval: vi.fn((script: string, _numKeys: number, key: string, windowMsArg: string) => {
    if (evalFails) return Promise.reject(new Error('redis down'));
    const windowMs = Number(windowMsArg);
    const now = Date.now();
    let state = counters.get(key);
    if (!state || state.expiresAt <= now) {
      state = { count: 0, expiresAt: now + windowMs };
      counters.set(key, state);
    }
    state.count += 1;
    return Promise.resolve([state.count, state.expiresAt - now]);
  }),
  multi: vi.fn(() => {
    const chain = {
      incr: () => chain,
      expire: () => chain,
      hincrby: () => chain,
      zremrangebyrank: () => chain,
      zadd: (key: string, _score: number, member: string) => {
        const list = zsets.get(key) ?? [];
        list.push(member);
        zsets.set(key, list);
        return chain;
      },
      exec: () => Promise.resolve([]),
    };
    return chain;
  }),
  del: vi.fn((key: string) => {
    const existed = counters.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }),
  zrange: vi.fn((key: string) => Promise.resolve(zsets.get(key) ?? [])),
  zrem: vi.fn((key: string, ...members: string[]) => {
    const list = zsets.get(key) ?? [];
    zsets.set(key, list.filter((m) => !members.includes(m)));
    return Promise.resolve(members.length);
  }),
};

vi.mock('../lib/redis', () => ({ default: redisMock }));

const {
  namedRateLimit,
  pathBoundRateLimit,
  refreshRateLimitRules,
  unblockRateLimitKey,
  listRuleConfigs,
  getMountSource,
  PREDEFINED_NAMES,
  CODE_MOUNTED_NAMES,
} = await import('./rate-limit');

/** 构造完整的规则行（DB 行形状），仅覆盖关心的字段 */
function ruleRow(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    description: null,
    windowMs: 60_000,
    limit: 2,
    keyType: 'ip',
    enabled: true,
    mode: 'enforce',
    algorithm: 'fixed_window',
    allowlist: [],
    priority: 0,
    alertThreshold: null,
    blockedMessage: null,
    pathPatterns: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

async function loadRules(...rows: Record<string, unknown>[]): Promise<void> {
  dbRows.length = 0;
  dbRows.push(...rows);
  await refreshRateLimitRules();
}

/** 等待 fire-and-forget 的统计写入落地 */
const flushAsync = () => new Promise((r) => setImmediate(r));

beforeEach(async () => {
  counters.clear();
  zsets.clear();
  evalFails = false;
  vi.clearAllMocks();
  await loadRules();
});

describe('固定窗口限流', () => {
  it('到限额放行、超限 429，带标准 RateLimit-* 头与 Retry-After', async () => {
    await loadRules(ruleRow({ name: 't_fixed', limit: 2, blockedMessage: '慢一点' }));
    const app = new Hono();
    app.get('/api/t', namedRateLimit('t_fixed'), (c) => c.json({ ok: true }));

    const r1 = await app.request('/api/t');
    expect(r1.status).toBe(200);
    expect(r1.headers.get('RateLimit-Limit')).toBe('2');
    expect(r1.headers.get('RateLimit-Remaining')).toBe('1');

    const r2 = await app.request('/api/t');
    expect(r2.status).toBe(200);
    expect(r2.headers.get('RateLimit-Remaining')).toBe('0');

    const r3 = await app.request('/api/t');
    expect(r3.status).toBe(429);
    expect(r3.headers.get('Retry-After')).toMatch(/^\d+$/);
    expect(Number(r3.headers.get('RateLimit-Reset'))).toBeGreaterThan(0);
    const body = await r3.json() as { message: string };
    expect(body.message).toBe('慢一点');
  });

  it('Redis 故障时放行（fail-open）', async () => {
    await loadRules(ruleRow({ name: 't_down', limit: 1 }));
    evalFails = true;
    const app = new Hono();
    app.get('/api/t', namedRateLimit('t_down'), (c) => c.json({ ok: true }));
    for (let i = 0; i < 3; i++) {
      expect((await app.request('/api/t')).status).toBe(200);
    }
  });

  it('禁用规则直接放行，不触 Redis', async () => {
    await loadRules(ruleRow({ name: 't_off', limit: 1, enabled: false }));
    const app = new Hono();
    app.get('/api/t', namedRateLimit('t_off'), (c) => c.json({ ok: true }));
    expect((await app.request('/api/t')).status).toBe(200);
    expect(redisMock.eval).not.toHaveBeenCalled();
  });
});

describe('monitor 观察模式', () => {
  it('超限只记拦截统计（monitored 标记），请求仍放行', async () => {
    await loadRules(ruleRow({ name: 't_mon', limit: 1, mode: 'monitor' }));
    const app = new Hono();
    app.get('/api/t', namedRateLimit('t_mon'), (c) => c.json({ ok: true }));

    expect((await app.request('/api/t')).status).toBe(200);
    expect((await app.request('/api/t')).status).toBe(200);
    expect((await app.request('/api/t')).status).toBe(200);
    await flushAsync();

    const recent = zsets.get('test:rlstats:t_mon:recent') ?? [];
    expect(recent.length).toBe(2);
    const record = JSON.parse(recent[0]) as { key: string; monitored?: boolean };
    expect(record.monitored).toBe(true);
    expect(record.key).toBe('127.0.0.1');
  });
});

describe('同请求规则去重', () => {
  it('named 中间件挂两次只计一次', async () => {
    await loadRules(ruleRow({ name: 't_dup', limit: 10 }));
    const app = new Hono();
    app.use('/api/t', namedRateLimit('t_dup'));
    app.get('/api/t', namedRateLimit('t_dup'), (c) => c.json({ ok: true }));
    await app.request('/api/t');
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });

  it('pathBound 与 named 命中同一规则只计一次', async () => {
    await loadRules(ruleRow({ name: 't_both', limit: 10, pathPatterns: ['/api/t'] }));
    const app = new Hono();
    app.use('*', pathBoundRateLimit);
    app.get('/api/t', namedRateLimit('t_both'), (c) => c.json({ ok: true }));
    await app.request('/api/t');
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });
});

describe('路径绑定', () => {
  it('exact 精确匹配、/* 前缀匹配、不匹配放行', async () => {
    await loadRules(ruleRow({ name: 't_path', limit: 1, pathPatterns: ['/api/exact', '/api/tree/*'] }));
    const app = new Hono();
    app.use('*', pathBoundRateLimit);
    app.get('*', (c) => c.json({ ok: true }));

    await app.request('/api/exact');
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    await app.request('/api/exact-suffix'); // exact 不做前缀匹配
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    await app.request('/api/tree/deep/child');
    expect(redisMock.eval).toHaveBeenCalledTimes(2);
    await app.request('/api/other');
    expect(redisMock.eval).toHaveBeenCalledTimes(2);
  });

  it('多规则命中同一路径时取 priority 大者', async () => {
    await loadRules(
      ruleRow({ id: 1, name: 't_low', limit: 5, priority: 0, pathPatterns: ['/api/p/*'] }),
      ruleRow({ id: 2, name: 't_high', limit: 5, priority: 10, pathPatterns: ['/api/p/*'] }),
    );
    const app = new Hono();
    app.use('*', pathBoundRateLimit);
    app.get('*', (c) => c.json({ ok: true }));
    await app.request('/api/p/x');
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
    const counterKey = redisMock.eval.mock.calls[0][2] as string;
    expect(counterKey).toContain('t_high|');
  });
});

describe('解封', () => {
  it('删除计数键并按裸身份清理 recent 记录', async () => {
    await loadRules(ruleRow({ name: 't_unblock', limit: 1 }));
    const app = new Hono();
    app.get('/api/t', namedRateLimit('t_unblock'), (c) => c.json({ ok: true }));
    await app.request('/api/t');
    expect((await app.request('/api/t')).status).toBe(429);
    await flushAsync();

    expect(counters.has('test:rl:t_unblock|127.0.0.1')).toBe(true);
    expect((zsets.get('test:rlstats:t_unblock:recent') ?? []).length).toBe(1);

    const ok = await unblockRateLimitKey('t_unblock', '127.0.0.1');
    expect(ok).toBe(true);
    expect(counters.has('test:rl:t_unblock|127.0.0.1')).toBe(false);
    expect((zsets.get('test:rlstats:t_unblock:recent') ?? []).length).toBe(0);

    // 解封后立即恢复访问
    expect((await app.request('/api/t')).status).toBe(200);
  });

  it('无活跃计数时返回 false', async () => {
    expect(await unblockRateLimitKey('t_unblock', '10.0.0.1')).toBe(false);
  });
});

describe('规则目录一致性', () => {
  it('全部内置规则登记在 PREDEFINED_NAMES 且无死规则', async () => {
    await loadRules(); // 仅代码默认规则
    for (const cfg of listRuleConfigs()) {
      expect(PREDEFINED_NAMES.has(cfg.name), `${cfg.name} 应在 PREDEFINED_NAMES`).toBe(true);
      expect(Array.isArray(cfg.pathPatterns), `${cfg.name} 缺 pathPatterns`).toBe(true);
      const source = getMountSource(cfg.name, cfg.pathPatterns);
      expect(source, `${cfg.name} 是死规则（无代码挂载且无路径绑定）`).not.toBe('none');
    }
  });

  it('CODE_MOUNTED_NAMES 是 PREDEFINED_NAMES 的子集', () => {
    for (const name of CODE_MOUNTED_NAMES) {
      expect(PREDEFINED_NAMES.has(name)).toBe(true);
    }
  });
});
