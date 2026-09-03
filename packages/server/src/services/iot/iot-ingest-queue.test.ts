import { beforeEach, describe, expect, it, vi } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('../../lib/logger', () => ({
  default: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  MAX_PENDING_PER_DEVICE, drainIotDeviceWork, enqueueIotDeviceWork, getIotDeviceWorkStats,
} from './iot-ingest-queue';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  vi.clearAllMocks();
  await drainIotDeviceWork(1_000);
});

describe('enqueueIotDeviceWork', () => {
  it('同一设备的任务按入队顺序串行执行', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    enqueueIotDeviceWork(1, 'a', async () => { await gate; order.push('a'); });
    enqueueIotDeviceWork(1, 'b', async () => { order.push('b'); });
    await tick();
    expect(order).toEqual([]);

    release();
    await drainIotDeviceWork(1_000);
    expect(order).toEqual(['a', 'b']);
  });

  it('不同设备的任务互不阻塞', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    enqueueIotDeviceWork(1, 'slow', async () => { await gate; order.push('slow'); });
    enqueueIotDeviceWork(2, 'fast', async () => { order.push('fast'); });
    await tick();
    expect(order).toEqual(['fast']);

    release();
    await drainIotDeviceWork(1_000);
    expect(order).toEqual(['fast', 'slow']);
  });

  it('任务抛错只记日志，不影响后续任务', async () => {
    const order: string[] = [];
    enqueueIotDeviceWork(1, 'boom', async () => { throw new Error('boom'); });
    enqueueIotDeviceWork(1, 'next', async () => { order.push('next'); });
    await drainIotDeviceWork(1_000);
    expect(order).toEqual(['next']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom 执行失败'));
  });

  it('单设备积压超过上限时丢弃新任务并返回 false', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    enqueueIotDeviceWork(1, 'blocker', async () => { await gate; });
    for (let i = 1; i < MAX_PENDING_PER_DEVICE; i++) {
      expect(enqueueIotDeviceWork(1, 'fill', async () => {})).toBe(true);
    }
    expect(enqueueIotDeviceWork(1, 'overflow', async () => {})).toBe(false);
    expect(getIotDeviceWorkStats().dropped).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('积压'));

    release();
    await drainIotDeviceWork(1_000);
    expect(getIotDeviceWorkStats().inFlight).toBe(0);
    expect(getIotDeviceWorkStats().devices).toBe(0);
  });

  it('drain 超时返回 false，任务完成后返回 true', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    enqueueIotDeviceWork(9, 'hang', async () => { await gate; });
    expect(await drainIotDeviceWork(50)).toBe(false);
    release();
    expect(await drainIotDeviceWork(1_000)).toBe(true);
  });
});
