/**
 * 审计字段自动注入（db/index.ts wrapExecutor Proxy）回归测试。
 *
 * 该 Proxy 直接替换 drizzle builder 的内部方法（values / set / onConflictDoUpdate），
 * 依赖 drizzle 的内部结构；升级 drizzle（尤其 v1.0）后注入可能静默失效——
 * 审计字段丢失不会报错。本文件用 .toSQL()（不触库）断言三条注入链路仍然生效。
 */
import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

vi.mock('../config', () => ({
  config: {
    databaseUrl: 'postgresql://unit:test@localhost:5432/unit_test_never_connects',
    database: { maxConnections: 1, idleTimeoutSeconds: 1, connectTimeoutSeconds: 1, ssl: false },
    log: { level: 'silent', dir: 'logs', maxFiles: '30d' },
    redis: { keyPrefix: 'test:' },
  },
}));
vi.mock('../lib/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../lib/redis', () => ({
  default: { get: vi.fn(), set: vi.fn(), del: vi.fn(), on: vi.fn() },
}));

const { db, wrapExecutorForTest } = await import('./index');
const { runAsUser } = await import('../lib/audit-context');
const { tenants, userRoles } = await import('./schema');

describe('audit inject proxy', () => {
  it('injects createdBy/updatedBy into insert values under runAsUser', async () => {
    await runAsUser(42, () => {
      const q = db.insert(tenants).values({ name: 'T', code: 't-001' }).toSQL();
      expect(q.params.filter((p) => p === 42)).toHaveLength(2); // created_by + updated_by
    });
  });

  it('injects for every row of a bulk insert', async () => {
    await runAsUser(7, () => {
      const q = db.insert(tenants).values([
        { name: 'A', code: 'a' },
        { name: 'B', code: 'b' },
      ]).toSQL();
      expect(q.params.filter((p) => p === 7)).toHaveLength(4); // 2 行 × created_by + updated_by
    });
  });

  it('injects updatedBy into update set', async () => {
    await runAsUser(42, () => {
      const q = db.update(tenants).set({ name: 'N' }).where(eq(tenants.id, 1)).toSQL();
      expect(q.sql).toContain('"updated_by"');
      expect(q.params).toContain(42);
    });
  });

  it('injects updatedBy into onConflictDoUpdate set', async () => {
    await runAsUser(42, () => {
      const q = db.insert(tenants).values({ name: 'T', code: 't' })
        .onConflictDoUpdate({ target: tenants.code, set: { name: 'T2' } })
        .toSQL();
      // insert 行注入 created_by + updated_by（2 个参数），conflict set 再注入 updated_by（1 个参数）
      expect(q.params.filter((p) => p === 42)).toHaveLength(3);
    });
  });

  it('skips tables without audit columns and skips when no audit context', async () => {
    await runAsUser(42, () => {
      const junction = db.insert(userRoles).values({ userId: 1, roleId: 2 }).toSQL();
      expect(junction.sql).not.toContain('created_by');
      expect(junction.params).toEqual([1, 2]);
    });
    const anonymous = db.insert(tenants).values({ name: 'T', code: 't' }).toSQL();
    expect(anonymous.params).toEqual(['T', 't']); // 无审计上下文：只有业务字段参数
  });

  it('explicit values win over injection', async () => {
    await runAsUser(42, () => {
      const q = db.insert(tenants).values({ name: 'T', code: 't', createdBy: 9 } as never).toSQL();
      expect(q.params).toContain(9);
    });
  });

  it('wraps nested transaction executors so injection survives inside tx', async () => {
    const valuesSpy = vi.fn().mockReturnValue({});
    const fakeTx = { insert: vi.fn().mockReturnValue({ values: valuesSpy }) };
    const fakeDb = {
      transaction: vi.fn(async (cb: (tx: object) => unknown) => cb(fakeTx)),
    };
    const wrapped = wrapExecutorForTest(fakeDb) as unknown as {
      transaction: (cb: (tx: { insert: (t: unknown) => { values: (v: unknown) => unknown } }) => unknown) => Promise<unknown>;
    };
    await runAsUser(42, () =>
      wrapped.transaction(async (tx) => {
        tx.insert(tenants).values({ name: 'T', code: 't' });
      }),
    );
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: 42, updatedBy: 42, name: 'T', code: 't' }),
    );
  });
});
