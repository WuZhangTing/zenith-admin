import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSymbolicateCache,
  configureSymbolicateCache,
  getSymbolicateCacheStats,
  symbolicateStack,
} from './source-map-symbolicate';

/** 生成一个最小可用的 sourcemap：generated 1:0 → src/original.ts 10:2 (name orig) */
function makeSourceMap(source = 'src/original.ts'): string {
  return JSON.stringify({
    version: 3,
    sources: [source],
    names: ['orig'],
    mappings: 'AAUEA', // [0,10,2,0] → gen col 0 ← source 0, line 10(0-based), col 2, name 0
    file: 'app.js',
  });
}

const STACK = [
  'Error: boom',
  '    at fn (https://cdn.example.com/assets/app.js:1:1)',
].join('\n');

afterEach(() => {
  clearSymbolicateCache();
  configureSymbolicateCache();
});

describe('sourcemap consumer LRU 缓存', () => {
  it('还原堆栈并把帧映射回源码位置', async () => {
    const result = await symbolicateStack(STACK, [
      { fileName: 'app.js', content: makeSourceMap(), cacheKey: '1:100' },
    ]);
    expect(result).toContain('src/original.ts:11:2');
  });

  it('同一 cacheKey 重复调用：第二次命中缓存，不重复解析', async () => {
    const maps = [{ fileName: 'app.js', content: makeSourceMap(), cacheKey: '1:100' }];
    await symbolicateStack(STACK, maps);
    await symbolicateStack(STACK, maps);
    const stats = getSymbolicateCacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.entries).toBe(1);
  });

  it('cacheKey 变化（重新上传）后视为新条目', async () => {
    await symbolicateStack(STACK, [{ fileName: 'app.js', content: makeSourceMap(), cacheKey: '1:100' }]);
    await symbolicateStack(STACK, [{ fileName: 'app.js', content: makeSourceMap(), cacheKey: '2:200' }]);
    expect(getSymbolicateCacheStats().misses).toBe(2);
  });

  it('超出字节预算时按 LRU 淘汰最旧条目', async () => {
    const content = makeSourceMap();
    configureSymbolicateCache({ maxBytes: content.length + 10 }); // 只装得下 1 份
    await symbolicateStack(STACK, [{ fileName: 'app.js', content, cacheKey: 'a:1' }]);
    await symbolicateStack(STACK, [{ fileName: 'app.js', content, cacheKey: 'b:2' }]);
    const stats = getSymbolicateCacheStats();
    expect(stats.entries).toBe(1);
    expect(stats.bytes).toBeLessThanOrEqual(content.length + 10);
    // 最旧的 a:1 被淘汰，再次访问是 miss
    await symbolicateStack(STACK, [{ fileName: 'app.js', content, cacheKey: 'a:1' }]);
    expect(getSymbolicateCacheStats().misses).toBe(3);
  });

  it('clearSymbolicateCache 清空全部条目', async () => {
    await symbolicateStack(STACK, [{ fileName: 'app.js', content: makeSourceMap(), cacheKey: '1:100' }]);
    clearSymbolicateCache();
    expect(getSymbolicateCacheStats().entries).toBe(0);
    expect(getSymbolicateCacheStats().bytes).toBe(0);
  });

  it('无 cacheKey 时不进缓存（旧行为：用后即销毁）', async () => {
    const result = await symbolicateStack(STACK, [{ fileName: 'app.js', content: makeSourceMap() }]);
    expect(result).toContain('src/original.ts');
    expect(getSymbolicateCacheStats().entries).toBe(0);
  });

  it('malformed sourcemap 不缓存也不抛错，帧原样保留', async () => {
    const result = await symbolicateStack(STACK, [{ fileName: 'app.js', content: '{bad json', cacheKey: 'x:1' }]);
    expect(result).toBeNull();
    expect(getSymbolicateCacheStats().entries).toBe(0);
  });
});
