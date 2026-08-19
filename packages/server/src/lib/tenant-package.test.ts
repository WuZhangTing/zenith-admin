/**
 * 套餐功能集解析单测。
 *
 * 锁定两类关键语义：
 * 1. 「不限制」返回 null 的三种情形（多租户关闭 / 无租户 / 未绑定套餐）；
 * 2. fail-closed：套餐被禁用时返回**空集**（全部可授权功能关闭），
 *    而不是回退为 null（那会静默变成全功能放行）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const configMock = vi.hoisted(() => ({ multiTenantMode: true }));
vi.mock('../config', () => ({ config: configMock }));

vi.mock('../db', () => ({
  db: { select: vi.fn() },
}));

import { db } from '../db';
import { getTenantPackageFeatureSet } from './tenant-package';

const dbMock = vi.mocked(db);

/** 构造一次 select().from().where().limit() / 无 limit 链，resolve 指定行 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  configMock.multiTenantMode = true;
});

describe('getTenantPackageFeatureSet', () => {
  it('多租户关闭时返回 null（不限制），不触发任何查询', async () => {
    configMock.multiTenantMode = false;
    expect(await getTenantPackageFeatureSet(1)).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('tenantId 为空（平台级视角）时返回 null', async () => {
    expect(await getTenantPackageFeatureSet(null)).toBeNull();
    expect(await getTenantPackageFeatureSet(undefined)).toBeNull();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('租户未绑定套餐时返回 null（不限制）', async () => {
    dbMock.select.mockReturnValueOnce(createChain([{ packageId: null }]));
    expect(await getTenantPackageFeatureSet(1)).toBeNull();
  });

  it('套餐被禁用时返回空集（fail-closed，而不是 null）', async () => {
    dbMock.select
      .mockReturnValueOnce(createChain([{ packageId: 10 }]))
      .mockReturnValueOnce(createChain([{ status: 'disabled' }]));
    const set = await getTenantPackageFeatureSet(1);
    expect(set).toBeInstanceOf(Set);
    expect(set!.size).toBe(0);
  });

  it('启用套餐返回其分配的功能 key 集合', async () => {
    dbMock.select
      .mockReturnValueOnce(createChain([{ packageId: 10 }]))
      .mockReturnValueOnce(createChain([{ status: 'enabled' }]))
      .mockReturnValueOnce(createChain([{ featureKey: 'wiki' }, { featureKey: 'workflow' }]));
    const set = await getTenantPackageFeatureSet(1);
    expect([...set!].sort()).toEqual(['wiki', 'workflow']);
  });
});
