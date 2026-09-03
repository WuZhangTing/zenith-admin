import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { insertValues, mergeIotReportedBatch, bumpIotTelemetryCounter, ensurePartitions, logger } = vi.hoisted(() => ({
  insertValues: vi.fn(),
  mergeIotReportedBatch: vi.fn(),
  bumpIotTelemetryCounter: vi.fn(),
  ensurePartitions: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../db', () => ({
  db: { insert: () => ({ values: insertValues }) },
}));
vi.mock('../../lib/logger', () => ({ default: logger }));
vi.mock('./iot-shadow.service', () => ({ mergeIotReportedBatch }));
vi.mock('./iot-telemetry-counter', () => ({ bumpIotTelemetryCounter }));
vi.mock('./iot-partitions.service', () => ({
  ensureIotTelemetryPartitionsFor: ensurePartitions,
  isMissingIotTelemetryPartitionError: (err: unknown) => (err as { code?: string })?.code === '23514',
}));

import type { IotDeviceRow } from '../../db/schema';
import {
  FLUSH_INTERVAL_MS, MAX_PENDING_ROWS, enqueueIotTelemetry, flushIotIngestBuffer, getIotIngestBufferStats,
} from './iot-ingest-buffer';

const device = (id: number) => ({ id, sn: `SN-${id}`, productId: 1 } as unknown as IotDeviceRow);

function frame(deviceId: number, metrics: Record<string, number>, at: Date, points = 1) {
  const rows = Array.from({ length: points }, (_, i) => ({ deviceId, metrics, reportedAt: new Date(at.getTime() + i) }));
  return { device: device(deviceId), rows, merged: metrics, latestAt: new Date(at.getTime() + points - 1) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  insertValues.mockResolvedValue(undefined);
  mergeIotReportedBatch.mockImplementation(async (patches: Array<{ deviceId: number }>) =>
    new Map(patches.map((p) => [p.deviceId, { reported: {}, desired: {}, desiredVersion: 0 }])));
});

afterEach(async () => {
  vi.useRealTimers();
  await flushIotIngestBuffer();
});

describe('enqueueIotTelemetry', () => {
  it('同一刷写窗口内的帧合并成一条多行 INSERT + 一条影子 upsert', async () => {
    const t = new Date('2026-09-03T10:00:00Z');
    const p1 = enqueueIotTelemetry(frame(1, { temperature: 20 }, t));
    const p2 = enqueueIotTelemetry(frame(1, { humidity: 50 }, new Date(t.getTime() + 10)));
    const p3 = enqueueIotTelemetry(frame(2, { temperature: 30 }, t, 2));
    expect(getIotIngestBufferStats()).toMatchObject({ pendingFrames: 3, pendingRows: 4, flushing: false });
    expect(insertValues).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    await Promise.all([p1, p2, p3]);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues.mock.calls[0][0]).toHaveLength(4);
    expect(mergeIotReportedBatch).toHaveBeenCalledTimes(1);
    const patches = mergeIotReportedBatch.mock.calls[0][0] as Array<{ deviceId: number; metrics: Record<string, number>; reportedAt: Date }>;
    // 同设备两帧合并成一份 patch，取最新时刻；不同设备各一份
    expect(patches).toHaveLength(2);
    expect(patches.find((p) => p.deviceId === 1)).toMatchObject({ metrics: { temperature: 20, humidity: 50 }, reportedAt: new Date(t.getTime() + 10) });
    expect(bumpIotTelemetryCounter).toHaveBeenCalledWith(4);
  });

  it('待写行数达到上限立即刷写，不等定时器', async () => {
    const t = new Date('2026-09-03T10:00:00Z');
    const p = enqueueIotTelemetry(frame(1, { v: 1 }, t, MAX_PENDING_ROWS));
    await Promise.resolve();
    expect(getIotIngestBufferStats().flushing).toBe(true);
    await p;
    expect(insertValues).toHaveBeenCalledTimes(2); // 1000 行按 500 一块分两条语句
  });

  it('明细写入失败时整批 reject；影子失败只降级为 null', async () => {
    const t = new Date('2026-09-03T10:00:00Z');
    insertValues.mockRejectedValueOnce(new Error('db down'));
    const failed = enqueueIotTelemetry(frame(1, { v: 1 }, t));
    const rejection = expect(failed).rejects.toThrow('db down');
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    await rejection;
    expect(logger.error).toHaveBeenCalled();

    mergeIotReportedBatch.mockRejectedValueOnce(new Error('shadow down'));
    const degraded = enqueueIotTelemetry(frame(1, { v: 2 }, t));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    await expect(degraded).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('命中缺失分区时补建分区并重试', async () => {
    const t = new Date('2026-09-03T10:00:00Z');
    insertValues.mockRejectedValueOnce(Object.assign(new Error('no partition'), { code: '23514' }));
    const p = enqueueIotTelemetry(frame(1, { v: 1 }, t));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    await expect(p).resolves.not.toBeNull();
    expect(ensurePartitions).toHaveBeenCalledWith([t], { recheck: true });
    expect(insertValues).toHaveBeenCalledTimes(2);
  });

  it('在途批次期间到达的帧攒成下一批，刷完立即接上', async () => {
    const t = new Date('2026-09-03T10:00:00Z');
    let release!: () => void;
    insertValues.mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; }));
    const first = enqueueIotTelemetry(frame(1, { v: 1 }, t));
    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS);
    expect(getIotIngestBufferStats().flushing).toBe(true);

    const second = enqueueIotTelemetry(frame(2, { v: 2 }, t));
    expect(getIotIngestBufferStats()).toMatchObject({ pendingFrames: 1, flushing: true });
    release();
    await Promise.all([first, second]);
    expect(insertValues).toHaveBeenCalledTimes(2);
    expect(getIotIngestBufferStats()).toMatchObject({ pendingFrames: 0, flushing: false });
  });
});
