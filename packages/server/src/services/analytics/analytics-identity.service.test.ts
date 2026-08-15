/**
 * 行为中心：身份映射与匿名回溯合并单测。
 *
 * 覆盖点：
 * - 首绑 ON CONFLICT DO NOTHING（共享设备第二账号不抢占既有绑定）
 * - 匿名映射批量解析（空输入短路，不发查询）
 * - 回溯合并在单事务内完成：事件改写 / 会话归属 / 画像并入+删除
 * - processIdentityBindings 对单个绑定失败静默降级（best-effort，不影响采集）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transaction, dbInsert, dbSelect, txUpdate, txExecute, txDelete, loggerWarn } = vi.hoisted(() => ({
  transaction: vi.fn(),
  dbInsert: vi.fn(),
  dbSelect: vi.fn(),
  txUpdate: vi.fn(),
  txExecute: vi.fn(async () => undefined),
  txDelete: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../db', () => ({
  db: { transaction, insert: dbInsert, select: dbSelect },
}));

vi.mock('../../lib/logger', () => ({
  default: { warn: loggerWarn, info: vi.fn(), error: vi.fn() },
}));

import { upsertIdentityBindings, resolveAnonymousMappings, mergeAnonymousIdentity, processIdentityBindings, type IdentityBinding } from './analytics-identity.service';
import { db } from '../../db';

const binding: IdentityBinding = {
  tenantId: 11,
  anonymousId: 'anon-1',
  distinctId: 'u:42',
  identityType: 'admin',
  userId: 42,
  memberId: null,
  displayName: 'alice',
};

describe('analytics-identity.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbInsert.mockReturnValue({ values: () => ({ onConflictDoNothing: async () => undefined }) });
    dbSelect.mockReturnValue({ from: () => ({ where: async () => [] }) });
    txUpdate.mockReturnValue({ set: () => ({ where: async () => undefined }) });
    txDelete.mockReturnValue({ where: async () => undefined });
    transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ update: txUpdate, execute: txExecute, delete: txDelete }));
  });

  it('upsertIdentityBindings 空数组短路，不触发 insert', async () => {
    await upsertIdentityBindings(db, []);
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it('upsertIdentityBindings 走 ON CONFLICT DO NOTHING（首绑优先）', async () => {
    const onConflictDoNothing = vi.fn(async () => undefined);
    dbInsert.mockReturnValue({ values: () => ({ onConflictDoNothing }) });
    await upsertIdentityBindings(db, [binding]);
    expect(dbInsert).toHaveBeenCalledTimes(1);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('resolveAnonymousMappings 空输入返回空 Map 且不查询', async () => {
    const result = await resolveAnonymousMappings([], 11);
    expect(result.size).toBe(0);
    expect(dbSelect).not.toHaveBeenCalled();
  });

  it('resolveAnonymousMappings 返回 anonymousId → 权威身份映射', async () => {
    dbSelect.mockReturnValue({
      from: () => ({
        where: async () => [
          { anonymousId: 'anon-1', distinctId: 'u:42', identityType: 'admin', userId: 42, memberId: null },
        ],
      }),
    });
    const result = await resolveAnonymousMappings(['anon-1', 'anon-2'], 11);
    expect(result.get('anon-1')?.distinctId).toBe('u:42');
    expect(result.has('anon-2')).toBe(false);
  });

  it('mergeAnonymousIdentity 在单事务内完成事件改写 / 会话归属 / 画像并入与删除', async () => {
    await mergeAnonymousIdentity(binding);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(1);   // user_events distinct_id 改写
    expect(txExecute).toHaveBeenCalledTimes(2);  // sessions 归属 + profiles 并入
    expect(txDelete).toHaveBeenCalledTimes(1);   // 匿名画像行删除
  });

  it('processIdentityBindings 单个绑定失败时记 warn 且不抛出', async () => {
    transaction.mockRejectedValueOnce(new Error('deadlock'));
    await expect(processIdentityBindings([binding])).resolves.toBeUndefined();
    expect(loggerWarn).toHaveBeenCalledTimes(1);
  });
});
