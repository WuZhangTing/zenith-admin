import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './ttl-cache';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('TtlCache', () => {
  it('并发未命中只执行一次 loader（单飞）', async () => {
    const cache = new TtlCache<string, number>(1_000, { jitter: 0 });
    const loader = vi.fn(async () => 42);
    const results = await Promise.all([cache.get('k', loader), cache.get('k', loader), cache.get('k', loader)]);
    expect(results).toEqual([42, 42, 42]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(await cache.get('k', loader)).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('过期后先返回旧值并后台刷新一次', async () => {
    const cache = new TtlCache<string, number>(1_000, { jitter: 0 });
    let value = 1;
    const loader = vi.fn(async () => value);
    expect(await cache.get('k', loader)).toBe(1);

    vi.advanceTimersByTime(1_500);
    value = 2;
    // 过期：三次并发 get 都拿旧值，只触发一次刷新
    const stale = await Promise.all([cache.get('k', loader), cache.get('k', loader), cache.get('k', loader)]);
    expect(stale).toEqual([1, 1, 1]);
    expect(loader).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(await cache.get('k', loader)).toBe(2);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('关闭 stale-while-revalidate 时过期必须等待新值', async () => {
    const cache = new TtlCache<string, number>(1_000, { jitter: 0, staleWhileRevalidate: false });
    let value = 1;
    expect(await cache.get('k', async () => value)).toBe(1);
    vi.advanceTimersByTime(1_500);
    value = 2;
    expect(await cache.get('k', async () => value)).toBe(2);
  });

  it('刷新失败保留旧值，首次加载失败向调用方抛出且不缓存', async () => {
    const cache = new TtlCache<string, number>(1_000, { jitter: 0 });
    await expect(cache.get('k', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(cache.peek('k')).toBeUndefined();

    expect(await cache.get('k', async () => 1)).toBe(1);
    vi.advanceTimersByTime(1_500);
    expect(await cache.get('k', async () => { throw new Error('boom'); })).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(cache.peek('k')).toBe(1);
  });

  it('delete / clear 主动失效', async () => {
    const cache = new TtlCache<string, number>(1_000);
    await cache.get('a', async () => 1);
    await cache.get('b', async () => 2);
    cache.delete('a');
    expect(cache.peek('a')).toBeUndefined();
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
