/**
 * 席位配额单测（License 部署级 + 租户级双层上限）。
 *
 * 覆盖：
 * - getTenantUserLimit：多租户关闭/平台级/未设上限 → null；租户与套餐上限取最小值
 * - reserveTenantSeats：advisory lock 后同事务 count 校验；
 *   required 模式 License 席位超限 400；租户席位边界判定
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const configMock = vi.hoisted(() => ({ multiTenantMode: true, licenseMode: 'off' as string }));
vi.mock('../config', () => ({ config: configMock }));

vi.mock('../db', () => {
  const db = { select: vi.fn(), $count: vi.fn(), insert: vi.fn() };
  return { db };
});

const getLicenseSnapshotMock = vi.hoisted(() => vi.fn());
vi.mock('./licensing', () => ({ getLicenseSnapshot: getLicenseSnapshotMock }));

// logger 在模块加载时读取 config.log 配置，单测中隔离掉
vi.mock('./logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { db } from '../db';
import { getTenantUserLimit, reserveTenantSeats } from './tenant-quota';

const dbMock = vi.mocked(db);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/** 模拟事务执行器：execute（advisory lock）+ select 链 */
function createTxMock(selectResults: unknown[][]) {
  let i = 0;
  return {
    execute: vi.fn(async () => undefined),
    select: vi.fn(() => createChain(selectResults[i++] ?? [])),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  configMock.multiTenantMode = true;
  configMock.licenseMode = 'off';
});

describe('getTenantUserLimit', () => {
  it('多租户模式关闭 → null（不限制，不查库）', async () => {
    configMock.multiTenantMode = false;
    expect(await getTenantUserLimit(1)).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('tenantId 为空（平台级用户）→ null', async () => {
    expect(await getTenantUserLimit(null)).toBeNull();
    expect(await getTenantUserLimit(undefined)).toBeNull();
  });

  it('租户与套餐都未设上限 → null', async () => {
    dbMock.select.mockReturnValueOnce(createChain([{ maxUsers: null, packageId: null }]));
    expect(await getTenantUserLimit(1)).toBeNull();
  });

  it('租户不存在 → null', async () => {
    dbMock.select.mockReturnValueOnce(createChain([]));
    expect(await getTenantUserLimit(999)).toBeNull();
  });

  it('仅租户设置上限 → 取租户值', async () => {
    dbMock.select.mockReturnValueOnce(createChain([{ maxUsers: 50, packageId: null }]));
    expect(await getTenantUserLimit(1)).toBe(50);
  });

  it('租户与套餐都设置 → 取最小值', async () => {
    dbMock.select
      .mockReturnValueOnce(createChain([{ maxUsers: 50, packageId: 3 }]))
      .mockReturnValueOnce(createChain([{ quotas: { maxUsers: 20 } }]));
    expect(await getTenantUserLimit(1)).toBe(20);
  });

  it('仅套餐设置上限 → 取套餐值', async () => {
    dbMock.select
      .mockReturnValueOnce(createChain([{ maxUsers: null, packageId: 3 }]))
      .mockReturnValueOnce(createChain([{ quotas: { maxUsers: 30 } }]));
    expect(await getTenantUserLimit(1)).toBe(30);
  });
});

describe('reserveTenantSeats', () => {
  it('先取事务级 advisory lock 再校验', async () => {
    const tx = createTxMock([]);
    configMock.multiTenantMode = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await reserveTenantSeats(tx as any, null);
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });

  it('租户席位：新增后恰好等于上限 → 通过（边界允许）', async () => {
    dbMock.select.mockReturnValueOnce(createChain([{ maxUsers: 10, packageId: null }]));
    const tx = createTxMock([[{ count: 9 }]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(reserveTenantSeats(tx as any, 1)).resolves.toBeUndefined();
  });

  it('租户席位：新增后超过上限 → 400', async () => {
    dbMock.select.mockReturnValueOnce(createChain([{ maxUsers: 10, packageId: null }]));
    const tx = createTxMock([[{ count: 10 }]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(reserveTenantSeats(tx as any, 1)).rejects.toMatchObject({
      status: 400,
      message: '该租户用户数已达上限（10），无法新增',
    });
  });

  it('required 模式：License 席位超限 → 400（拒绝新增，存量不受影响）', async () => {
    configMock.licenseMode = 'required';
    getLicenseSnapshotMock.mockResolvedValueOnce({
      licenseRowId: 1,
      payload: { limits: { maxUsers: 100, maxTenants: null, maxNodes: null } },
    });
    const tx = createTxMock([[{ count: 100 }]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(reserveTenantSeats(tx as any, null)).rejects.toMatchObject({ status: 400 });
  });

  it('required 模式：License 未设席位上限 → 通过', async () => {
    configMock.licenseMode = 'required';
    configMock.multiTenantMode = false;
    getLicenseSnapshotMock.mockResolvedValueOnce({
      licenseRowId: 1,
      payload: { limits: { maxUsers: null, maxTenants: null, maxNodes: null } },
    });
    const tx = createTxMock([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(reserveTenantSeats(tx as any, null)).resolves.toBeUndefined();
  });

  it('warn 模式：License 席位超限放行（祖父条款）', async () => {
    configMock.licenseMode = 'warn';
    configMock.multiTenantMode = false;
    getLicenseSnapshotMock.mockResolvedValueOnce({
      licenseRowId: 1,
      payload: { limits: { maxUsers: 10, maxTenants: null, maxNodes: null } },
    });
    dbMock.insert.mockReturnValueOnce({ values: vi.fn(() => ({ catch: vi.fn() })) } as never);
    const tx = createTxMock([[{ count: 10 }]]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(reserveTenantSeats(tx as any, null)).resolves.toBeUndefined();
  });
});
