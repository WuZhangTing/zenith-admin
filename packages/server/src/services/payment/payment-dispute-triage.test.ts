/**
 * 交易投诉智能分流 triageDispute 单测。
 *
 * 覆盖要点：
 *  1. 决策表命中 → 写 route/priority/slaHours + SLA 收紧 deadline + system 时间线留痕
 *  2. SLA 只收紧不放松：分流 deadline 晚于现有 deadline → 不覆盖
 *  3. 未命中（未发布/无匹配行）→ 零写入零留言
 *  4. 命中但 route 输出为空 → 零写入（防脏输出）
 *
 * Mock 策略：db / rules-runtime decide 全 mock。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db', () => {
  const db = { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), $count: vi.fn() };
  return { db };
});

vi.mock('../../lib/context', () => ({
  currentUser: vi.fn().mockReturnValue({ userId: 1, tenantId: null }),
  currentUserOrNull: vi.fn().mockReturnValue(null),
}));

vi.mock('./payment.service', () => ({
  refund: vi.fn(),
}));

vi.mock('../platform/rules-runtime.service', () => ({
  decide: vi.fn(),
}));

import { db } from '../../db';
import { decide } from '../platform/rules-runtime.service';
import { triageDispute } from './payment-dispute.service';
import type { PaymentDisputeRow } from '../../db/schema';

const dbMock = vi.mocked(db);
const decideMock = vi.mocked(decide);

function updateChain() {
  const chain = { set: vi.fn(), where: vi.fn().mockResolvedValue(undefined) };
  chain.set.mockReturnValue(chain);
  return chain;
}

function insertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeRow(overrides: Partial<PaymentDisputeRow> = {}): PaymentDisputeRow {
  const createdAt = new Date('2026-01-01T00:00:00Z');
  return {
    id: 11, disputeNo: 'DSP1', channelDisputeNo: null, channel: 'wechat',
    orderNo: 'PAY1', complainant: 'oUSER1', complainantPhone: null,
    type: 'refund_request', content: '申请退款', amount: 5000, status: 'pending',
    route: null, priority: null, slaHours: null,
    deadline: new Date(createdAt.getTime() + 24 * 3600 * 1000),
    refundNo: null, resolvedAt: null, tenantId: null,
    createdAt, updatedAt: createdAt,
  } as PaymentDisputeRow;
}

const hit = (outputs: Record<string, unknown>) => ({
  matched: true, outputs, ref: { kind: 'table' as const, key: 'dispute_triage', version: 3 },
});
const miss = () => ({
  matched: false, outputs: {}, ref: { kind: 'table' as const, key: 'dispute_triage', version: null }, reason: 'not_found' as const,
});

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.$count.mockResolvedValue(0);
});

describe('triageDispute', () => {
  it('命中 → 写路由三字段 + SLA 收紧 deadline + system 留痕', async () => {
    const upd = updateChain();
    const ins = insertChain();
    dbMock.update.mockReturnValue(upd as never);
    dbMock.insert.mockReturnValue(ins as never);
    decideMock.mockResolvedValueOnce(hit({ route: 'urgent', priority: 100, slaHours: 12 }));

    const row = makeRow();
    await triageDispute(row);

    expect(decideMock).toHaveBeenCalledWith(
      { kind: 'table', key: 'dispute_triage' },
      { dispute: { type: 'refund_request', amount: 5000 }, history: { disputeCount90d: 0 } },
      expect.objectContaining({ caller: 'payment.dispute', bizRef: 'payment:dispute:DSP1' }),
    );
    const patch = upd.set.mock.calls[0][0];
    expect(patch).toMatchObject({ route: 'urgent', priority: 100, slaHours: 12 });
    // SLA 12h 早于默认 24h → deadline 被收紧
    expect(patch.deadline).toEqual(new Date(row.createdAt.getTime() + 12 * 3600 * 1000));
    const reply = ins.values.mock.calls[0][0];
    expect(reply.author).toBe('system');
    expect(reply.content).toContain('智能分流');
    expect(reply.content).toContain('加急处理');
  });

  it('SLA 只收紧不放松：分流 SLA 晚于现有 deadline → 不覆盖 deadline', async () => {
    const upd = updateChain();
    dbMock.update.mockReturnValue(upd as never);
    dbMock.insert.mockReturnValue(insertChain() as never);
    decideMock.mockResolvedValueOnce(hit({ route: 'manual', priority: 10, slaHours: 48 }));

    await triageDispute(makeRow());

    const patch = upd.set.mock.calls[0][0];
    expect(patch).toMatchObject({ route: 'manual', priority: 10, slaHours: 48 });
    expect(patch.deadline).toBeUndefined();
  });

  it('未命中（未发布/无匹配行）→ 零写入零留言', async () => {
    decideMock.mockResolvedValueOnce(miss());
    await triageDispute(makeRow());
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('命中但 route 输出为空 → 零写入（防脏输出）', async () => {
    decideMock.mockResolvedValueOnce(hit({ route: '', priority: 5 }));
    await triageDispute(makeRow());
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('复诉人历史计数并入事实包', async () => {
    dbMock.$count.mockResolvedValue(4);
    const upd = updateChain();
    dbMock.update.mockReturnValue(upd as never);
    dbMock.insert.mockReturnValue(insertChain() as never);
    decideMock.mockResolvedValueOnce(hit({ route: 'urgent', priority: 90, slaHours: 24 }));

    await triageDispute(makeRow());

    expect(decideMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ history: { disputeCount90d: 4 } }),
      expect.anything(),
    );
  });
});
