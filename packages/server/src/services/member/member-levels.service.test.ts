/**
 * 会员等级服务单测（成长值自动定级，业务规则关键）。
 *
 * 覆盖 addGrowthValue：会员不存在 404、成长值增减与 0 下限钳制、
 * 按阈值自动匹配最高满足等级、低于所有阈值时降为无等级。
 * 以及 listLevels：各等级会员数改为单条 GROUP BY 聚合（防 N+1 回归）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { db } from '../../db';
import { addGrowthValue, listLevels } from './member-levels.service';

const dbMock = vi.mocked(db);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit', 'orderBy', 'groupBy', 'set', 'values', 'returning']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/** select 序列：1. 会员当前成长值  2. 匹配等级（阈值 ≤ 新成长值的最高档） */
function mockFlow(growthValue: number | null, matchedLevel: { id: number } | null) {
  dbMock.select.mockReturnValueOnce(createChain(growthValue == null ? [] : [{ growthValue }]));
  if (growthValue != null) {
    dbMock.select.mockReturnValueOnce(createChain(matchedLevel ? [matchedLevel] : []));
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  dbMock.transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
});

describe('addGrowthValue', () => {
  it('会员不存在 → 404', async () => {
    mockFlow(null, null);
    await expect(addGrowthValue(999, 100)).rejects.toMatchObject({ status: 404, message: '会员不存在' });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('增加成长值并升级到匹配的最高等级', async () => {
    mockFlow(900, { id: 3 });
    const updateChain = createChain([]);
    dbMock.update.mockReturnValueOnce(updateChain);

    await addGrowthValue(7, 200);

    expect(updateChain.set).toHaveBeenCalledWith({ growthValue: 1100, levelId: 3 });
  });

  it('扣减成长值（负 delta）自动降级', async () => {
    mockFlow(1100, { id: 1 });
    const updateChain = createChain([]);
    dbMock.update.mockReturnValueOnce(updateChain);

    await addGrowthValue(7, -1000);

    expect(updateChain.set).toHaveBeenCalledWith({ growthValue: 100, levelId: 1 });
  });

  it('扣减超过当前值时钳制为 0（成长值不为负）', async () => {
    mockFlow(50, null);
    const updateChain = createChain([]);
    dbMock.update.mockReturnValueOnce(updateChain);

    await addGrowthValue(7, -9999);

    expect(updateChain.set).toHaveBeenCalledWith({ growthValue: 0, levelId: null });
  });

  it('低于所有等级阈值 → levelId 置空', async () => {
    mockFlow(10, null);
    const updateChain = createChain([]);
    dbMock.update.mockReturnValueOnce(updateChain);

    await addGrowthValue(7, 5);

    expect(updateChain.set).toHaveBeenCalledWith({ growthValue: 15, levelId: null });
  });
});

const LEVEL_ROWS = [
  { id: 1, name: '青铜', level: 1, growthThreshold: 0, discount: 100, icon: null, benefits: null, description: null, sort: 0, status: 'enabled', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: '白银', level: 2, growthThreshold: 100, discount: 95, icon: null, benefits: null, description: null, sort: 1, status: 'enabled', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, name: '黄金', level: 3, growthThreshold: 500, discount: 90, icon: null, benefits: null, description: null, sort: 2, status: 'enabled', createdAt: new Date(), updatedAt: new Date() },
];

describe('listLevels', () => {
  it('无论多少等级都只发一条聚合查询（不退化为按行 count）', async () => {
    dbMock.select.mockReturnValueOnce(createChain(LEVEL_ROWS));
    const countChain = createChain([{ levelId: 1, n: 8 }, { levelId: 3, n: 1 }]);
    dbMock.select.mockReturnValueOnce(countChain);

    await listLevels();

    // 1 次取等级行 + 1 次聚合统计 = 2，与等级数量无关
    expect(dbMock.select).toHaveBeenCalledTimes(2);
    expect(dbMock.$count).not.toHaveBeenCalled();
    expect(countChain.groupBy).toHaveBeenCalledTimes(1);
    // 软删会员必须仍被排除：聚合查询带 where 条件
    expect(countChain.where).toHaveBeenCalledTimes(1);
  });

  it('聚合结果按 levelId 对号入座，无会员的等级计 0', async () => {
    dbMock.select.mockReturnValueOnce(createChain(LEVEL_ROWS));
    dbMock.select.mockReturnValueOnce(createChain([{ levelId: 1, n: 8 }, { levelId: 3, n: 1 }]));

    const list = await listLevels();

    expect(list.map((l) => [l.id, l.memberCount])).toEqual([
      [1, 8],
      [2, 0], // 未出现在聚合结果中 → 兜底 0，而非 undefined
      [3, 1],
    ]);
  });

  it('没有任何等级时不发聚合查询', async () => {
    dbMock.select.mockReturnValueOnce(createChain([]));

    const list = await listLevels();

    expect(list).toEqual([]);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});
