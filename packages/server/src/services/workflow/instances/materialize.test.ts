import { describe, expect, it, vi } from 'vitest';
import { checkNodeCompletion, filterCurrentActivation } from './materialize';
import type { DbExecutor } from '../../../db/types';

type Row = { id: number; activationId: string | null; status?: string };

describe('filterCurrentActivation 节点重入轮次过滤', () => {
  it('只保留最新 activationId 的任务（历史轮 rejected 不参与判定）', () => {
    const rows: Row[] = [
      { id: 1, activationId: 'round-1', status: 'rejected' },
      { id: 2, activationId: 'round-1', status: 'skipped' },
      { id: 3, activationId: 'round-2', status: 'pending' },
      { id: 4, activationId: 'round-2', status: 'approved' },
    ];
    const filtered = filterCurrentActivation(rows);
    expect(filtered.map((r) => r.id)).toEqual([3, 4]);
  });

  it('最新行无 activationId（历史数据）时回退全量，保持旧行为', () => {
    const rows: Row[] = [
      { id: 1, activationId: 'round-1' },
      { id: 2, activationId: null },
    ];
    expect(filterCurrentActivation(rows)).toHaveLength(2);
  });

  it('全部无 activationId 的存量数据回退全量', () => {
    const rows: Row[] = [
      { id: 1, activationId: null },
      { id: 2, activationId: null },
    ];
    expect(filterCurrentActivation(rows)).toHaveLength(2);
  });

  it('空数组直接返回', () => {
    expect(filterCurrentActivation([])).toEqual([]);
  });

  it('同轮加签任务（继承 activationId）与原任务同轮统计', () => {
    const rows: Row[] = [
      { id: 1, activationId: 'round-2', status: 'pending' },
      { id: 5, activationId: 'round-2', status: 'pending' }, // 加签继承
      { id: 3, activationId: 'round-1', status: 'rejected' },
    ];
    const filtered = filterCurrentActivation(rows);
    expect(filtered.map((r) => r.id).sort()).toEqual([1, 5]);
  });
});

/** 构造只支持 checkNodeCompletion 所需链式调用的 fake 事务执行器 */
function fakeTx(rows: Array<Record<string, unknown>>, onUpdate?: (patch: Record<string, unknown>) => void): DbExecutor {
  return {
    select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        onUpdate?.(patch);
        return { where: () => Promise.resolve([]) };
      },
    }),
  } as unknown as DbExecutor;
}

describe('checkNodeCompletion before-加签恢复（signType 判定，回归 comment 被覆盖导致的死锁）', () => {
  const base = { instanceId: 1, nodeKey: 'n1', activationId: 'round-1', taskOrder: null as number | null };

  it('前加签任务经委派回执后 comment 被覆盖，仍按 signType 恢复挂起原任务', async () => {
    const restored: Array<Record<string, unknown>> = [];
    // 场景：原任务 waiting；前加签任务被委派 → 原加签任务 approved（comment 已被回执覆盖）+ 回执确认任务 approved（signType 继承）
    const rows = [
      { ...base, id: 1, status: 'waiting', signType: null, comment: null, approveMethod: 'or' },
      { ...base, id: 2, status: 'approved', signType: 'before', comment: '[委派回执] 某人 建议同意', approveMethod: 'or' },
      { ...base, id: 3, status: 'approved', signType: 'before', comment: '[委派回执] 某人 建议同意', approveMethod: 'or' },
    ];
    const tx = fakeTx(rows, (patch) => restored.push(patch));
    const { completed } = await checkNodeCompletion(tx, 1, 'n1');
    // 原任务被升回 pending（写库一次），节点因原任务恢复 pending 而尚未完成
    expect(restored.some((p) => p.status === 'pending')).toBe(true);
    expect(completed).toBe(false);
  });

  it('前加签任务未全部处理时不恢复原任务，节点不可能完成', async () => {
    const updates: Array<Record<string, unknown>> = [];
    const rows = [
      { ...base, id: 1, status: 'waiting', signType: null, comment: null, approveMethod: 'or' },
      { ...base, id: 2, status: 'pending', signType: 'before', comment: '[加签-前] 由 张三 发起', approveMethod: 'or' },
    ];
    const tx = fakeTx(rows, (patch) => updates.push(patch));
    const { completed } = await checkNodeCompletion(tx, 1, 'n1');
    expect(updates).toHaveLength(0);
    expect(completed).toBe(false);
  });

  it('减签（skipped）视同已处理，同样恢复挂起原任务', async () => {
    const restored = vi.fn();
    const rows = [
      { ...base, id: 1, status: 'waiting', signType: null, comment: null, approveMethod: 'or' },
      { ...base, id: 2, status: 'skipped', signType: 'before', comment: '[减签] 由 张三 发起', approveMethod: 'or' },
    ];
    const tx = fakeTx(rows, restored);
    await checkNodeCompletion(tx, 1, 'n1');
    expect(restored).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });
});
