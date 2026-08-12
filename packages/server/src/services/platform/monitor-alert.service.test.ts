import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitorAlertRuleRow } from '../../db/schema';
import { monitorAlertEvents, monitorAlertRules } from '../../db/schema';

vi.mock('../../db', () => {
  const db = {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(async (callback: (tx: typeof db) => unknown) => callback(db)),
  };
  return { db };
});

vi.mock('../../lib/tenant', () => ({
  tenantScope: vi.fn(() => undefined),
  currentCreateTenantId: vi.fn(() => null),
}));

vi.mock('./monitor-history.service', () => ({
  getMetricSnapshotsByTenant: vi.fn(),
}));

vi.mock('../../lib/alert-dispatch', () => ({
  dispatchAlertChannels: vi.fn(),
}));

import { db } from '../../db';
import { setRuleEnabled, updateRule } from './monitor-alert.service';

const dbMock = vi.mocked(db);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChain(result: unknown[]): any {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'where', 'limit', 'set', 'returning']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function alertRule(overrides: Partial<MonitorAlertRuleRow> = {}): MonitorAlertRuleRow {
  return {
    id: 7,
    tenantId: null,
    name: 'CPU 使用率过高',
    metric: 'cpu',
    operator: 'gte',
    threshold: 85,
    durationMinutes: 5,
    level: 'warning',
    channels: ['inapp'],
    webhookUrl: null,
    recipientUserIds: [1],
    recipientEmails: [],
    silenceMinutes: 30,
    enabled: true,
    state: 'firing',
    breachingSince: new Date('2026-08-12T08:00:00Z'),
    lastTriggeredAt: new Date('2026-08-12T08:05:00Z'),
    lastValue: 92,
    createdBy: 1,
    updatedBy: 1,
    createdAt: new Date('2026-08-12T07:00:00Z'),
    updatedAt: new Date('2026-08-12T08:05:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('setRuleEnabled', () => {
  it('停用规则时原子关闭未恢复事件并清除运行态', async () => {
    const current = alertRule();
    const updated = alertRule({ enabled: false, state: 'ok', breachingSince: null });
    const ruleUpdate = createChain([updated]);
    const eventUpdate = createChain([]);

    dbMock.select.mockReturnValueOnce(createChain([current]));
    dbMock.update
      .mockReturnValueOnce(ruleUpdate)
      .mockReturnValueOnce(eventUpdate);

    const result = await setRuleEnabled(current.id, false);

    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(dbMock.update).toHaveBeenNthCalledWith(1, monitorAlertRules);
    expect(ruleUpdate.set).toHaveBeenCalledWith({ enabled: false, state: 'ok', breachingSince: null });
    expect(dbMock.update).toHaveBeenNthCalledWith(2, monitorAlertEvents);
    expect(eventUpdate.set).toHaveBeenCalledWith({
      status: 'resolved',
      resolvedAt: expect.any(Date),
    });
    expect(result).toMatchObject({ enabled: false, state: 'ok' });
  });

  it('重复启用正在运行的规则时不清除现有告警', async () => {
    const current = alertRule();
    dbMock.select
      .mockReturnValueOnce(createChain([current]))
      .mockReturnValueOnce(createChain([{ id: 1, email: 'admin@zenith.dev' }]));

    const result = await setRuleEnabled(current.id, true);

    expect(dbMock.transaction).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(result).toMatchObject({ enabled: true, state: 'firing' });
  });

  it('启用规则时拒绝不存在、停用或跨租户的接收用户', async () => {
    const current = alertRule({ enabled: false, state: 'ok' });
    dbMock.select
      .mockReturnValueOnce(createChain([current]))
      .mockReturnValueOnce(createChain([]));

    await expect(setRuleEnabled(current.id, true)).rejects.toMatchObject({
      message: '接收用户不存在、已停用或不属于当前租户',
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('邮件渠道要求所选用户至少有一个可用邮箱或配置额外邮箱', async () => {
    const current = alertRule({
      enabled: false,
      state: 'ok',
      channels: ['email'],
      recipientUserIds: [2],
      recipientEmails: [],
    });
    dbMock.select
      .mockReturnValueOnce(createChain([current]))
      .mockReturnValueOnce(createChain([{ id: 2, email: null }]));

    await expect(setRuleEnabled(current.id, true)).rejects.toMatchObject({
      message: '所选用户均未配置邮箱，请选择有邮箱的用户或填写额外邮箱',
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe('updateRule', () => {
  it('通过编辑表单停用规则时同样关闭未恢复事件', async () => {
    const current = alertRule();
    const updated = alertRule({ enabled: false, state: 'ok', breachingSince: null });
    const ruleUpdate = createChain([updated]);
    const eventUpdate = createChain([]);

    dbMock.select.mockReturnValueOnce(createChain([current]));
    dbMock.update
      .mockReturnValueOnce(ruleUpdate)
      .mockReturnValueOnce(eventUpdate);

    const result = await updateRule(current.id, { enabled: false });

    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(ruleUpdate.set).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      state: 'ok',
      breachingSince: null,
    }));
    expect(eventUpdate.set).toHaveBeenCalledWith({
      status: 'resolved',
      resolvedAt: expect.any(Date),
    });
    expect(result).toMatchObject({ enabled: false, state: 'ok' });
  });
});
