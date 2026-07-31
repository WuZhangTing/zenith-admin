import { describe, expect, it, vi } from 'vitest';
import { AhoCorasick, applyReplacements, createTtlCache, dedupeOverlaps, toCodePoints, type AcMatch } from './aho-corasick';

/** 测试辅助：把文本扫成 `{ start, end, payload }` 命中列表，等价于三个词库服务的用法 */
function collect(automaton: AhoCorasick<string>, text: string): AcMatch<string>[] {
  const chars = toCodePoints(text);
  const matches: AcMatch<string>[] = [];
  automaton.scan(chars, (word, endIndex) => {
    matches.push({ start: endIndex - toCodePoints(word).length + 1, end: endIndex + 1, payload: word });
  });
  return matches;
}

describe('AhoCorasick', () => {
  it('空词库时 isEmpty 为 true 且 scan 不回调', () => {
    const automaton = new AhoCorasick<string>([]);
    expect(automaton.isEmpty).toBe(true);
    const onHit = vi.fn();
    automaton.scan(toCodePoints('任意文本'), onHit);
    expect(onHit).not.toHaveBeenCalled();
  });

  it('空字符串模式被忽略，不会把根节点变成命中点', () => {
    const automaton = new AhoCorasick([{ word: '', payload: 'empty' }]);
    expect(automaton.isEmpty).toBe(true);
  });

  it('单次扫描命中全部模式（含 fail 链上的后缀词）', () => {
    const automaton = new AhoCorasick([
      { word: 'he', payload: 'he' },
      { word: 'she', payload: 'she' },
      { word: 'his', payload: 'his' },
      { word: 'hers', payload: 'hers' },
    ]);
    expect(collect(automaton, 'ushers').map((m) => m.payload)).toEqual(['she', 'he', 'hers']);
  });

  it('命中区间按码点计算，emoji 不会错位', () => {
    const automaton = new AhoCorasick([{ word: '差评', payload: '差评' }]);
    const matches = collect(automaton, '🎉差评🎉');
    expect(matches).toEqual([{ start: 1, end: 3, payload: '差评' }]);
    expect(applyReplacements(toCodePoints('🎉差评🎉'), matches, () => '好评')).toBe('🎉好评🎉');
  });

  it('onHit 返回 false 可提前终止扫描', () => {
    const automaton = new AhoCorasick([{ word: 'a', payload: 'a' }]);
    const seen: number[] = [];
    automaton.scan(toCodePoints('aaa'), (_p, i) => {
      seen.push(i);
      return false;
    });
    expect(seen).toEqual([0]);
  });
});

describe('dedupeOverlaps', () => {
  it('按起点升序、长词优先，剔除重叠区间', () => {
    const matches: AcMatch<string>[] = [
      { start: 2, end: 4, payload: 'short' },
      { start: 0, end: 3, payload: 'long' },
      { start: 0, end: 1, payload: 'tiny' },
      { start: 4, end: 6, payload: 'tail' },
    ];
    expect(dedupeOverlaps(matches).map((m) => m.payload)).toEqual(['long', 'tail']);
  });
});

describe('applyReplacements', () => {
  it('按不重叠命中替换，保留未命中片段', () => {
    const chars = toCodePoints('abcXdefXghi');
    const matches: AcMatch<string>[] = [
      { start: 3, end: 4, payload: 'X' },
      { start: 7, end: 8, payload: 'X' },
    ];
    expect(applyReplacements(chars, matches, () => '**')).toBe('abc**def**ghi');
  });

  it('替换为空串等价于删除命中词', () => {
    const chars = toCodePoints('好脏话好');
    const matches: AcMatch<string>[] = [{ start: 1, end: 3, payload: '脏话' }];
    expect(applyReplacements(chars, matches, () => '')).toBe('好好');
  });

  it('无命中时原样返回', () => {
    expect(applyReplacements(toCodePoints('原文'), [], () => 'x')).toBe('原文');
  });
});

describe('createTtlCache', () => {
  it('TTL 内复用缓存，过期后重新加载', async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn().mockImplementation(() => Promise.resolve('v'));
      const cache = createTtlCache(load, 1000);
      await cache.get();
      await cache.get();
      expect(load).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      await cache.get();
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('invalidate() 后下次读取立即重建', async () => {
    const load = vi.fn().mockImplementation(() => Promise.resolve('v'));
    const cache = createTtlCache(load, 60_000);
    await cache.get();
    cache.invalidate();
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('并发读取共享同一次加载，不重复查库', async () => {
    const load = vi.fn().mockImplementation(() => Promise.resolve('v'));
    const cache = createTtlCache(load, 60_000);
    const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect([a, b, c]).toEqual(['v', 'v', 'v']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('加载失败不写入缓存，下次读取重试', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('v');
    const cache = createTtlCache(load, 60_000);
    await expect(cache.get()).rejects.toThrow('db down');
    await expect(cache.get()).resolves.toBe('v');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
