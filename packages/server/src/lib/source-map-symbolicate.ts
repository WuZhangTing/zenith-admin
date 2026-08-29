/**
 * 压缩堆栈还原（基于上传的 source map）。
 *
 * SourceMapConsumer 缓存：解析一个数 MB 的 sourcemap（JSON.parse + WASM 索引构建）
 * 是主线程连续 CPU 段，而错误组详情页每次查看都要用同一批 map。按「id:updatedAt」
 * 缓存键做字节预算 LRU：重复查看零解析；上传（replace 先删后插产生新 id）与删除后
 * 由服务层显式清空。source-map@0.8 的 consumer 持有 WASM 内存、不受 GC 管理，
 * 淘汰必须 destroy——用引用计数避免「一个请求正在用、另一请求触发淘汰」的悬空销毁。
 */
import { SourceMapConsumer } from 'source-map';

function basename(url: string): string {
  const noQuery = url.split('?')[0].split('#')[0];
  const parts = noQuery.split('/');
  return parts[parts.length - 1] || noQuery;
}

const FRAME_RE = /^\s*at\s+(?:(.+?)\s+\()?(\S+?):(\d+):(\d+)\)?\s*$/;

export interface SourceMapEntry {
  fileName: string;
  content: string;
  /** 稳定缓存键（如 `${id}:${updatedAt}`）；缺省时不缓存，用后即销毁 */
  cacheKey?: string;
}

interface CacheSlot {
  consumer: SourceMapConsumer;
  bytes: number;
  /** 正在被 symbolicate 调用借用的次数；>0 时淘汰只标记 doomed，归还时再销毁 */
  refs: number;
  doomed: boolean;
}

const DEFAULT_MAX_CACHE_BYTES = 64 * 1024 * 1024;

const cache = new Map<string, CacheSlot>();
let cacheBytes = 0;
let maxCacheBytes = DEFAULT_MAX_CACHE_BYTES;
let cacheHits = 0;
let cacheMisses = 0;

function destroyConsumer(consumer: SourceMapConsumer): void {
  (consumer as unknown as { destroy?: () => void }).destroy?.();
}

function releaseSlot(slot: CacheSlot): void {
  slot.refs -= 1;
  if (slot.doomed && slot.refs <= 0) destroyConsumer(slot.consumer);
}

function evictOver(budget: number): void {
  for (const [key, slot] of cache) {
    if (cacheBytes <= budget) break;
    cache.delete(key);
    cacheBytes -= slot.bytes;
    slot.doomed = true;
    if (slot.refs <= 0) destroyConsumer(slot.consumer);
  }
}

/** 上传 / 删除 sourcemap 后清空缓存（先删后插的 replace 会产生新 id，旧键不再命中） */
export function clearSymbolicateCache(): void {
  evictOver(-1);
  cacheHits = 0;
  cacheMisses = 0;
}

/** 测试与观测用：当前缓存条目、占用字节与命中统计 */
export function getSymbolicateCacheStats(): { entries: number; bytes: number; hits: number; misses: number } {
  return { entries: cache.size, bytes: cacheBytes, hits: cacheHits, misses: cacheMisses };
}

/** 测试用：调整字节预算（不传恢复默认） */
export function configureSymbolicateCache(options?: { maxBytes?: number }): void {
  maxCacheBytes = options?.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
  evictOver(maxCacheBytes);
}

/** 借用一个 consumer：命中缓存刷新 LRU 序并加引用；未命中则解析（keyed 场景写入缓存） */
async function acquireConsumer(entry: SourceMapEntry): Promise<{ consumer: SourceMapConsumer; slot: CacheSlot | null } | null> {
  if (entry.cacheKey) {
    const hit = cache.get(entry.cacheKey);
    if (hit) {
      cacheHits += 1;
      cache.delete(entry.cacheKey);
      cache.set(entry.cacheKey, hit);
      hit.refs += 1;
      return { consumer: hit.consumer, slot: hit };
    }
  }
  let consumer: SourceMapConsumer;
  try {
    consumer = await new SourceMapConsumer(JSON.parse(entry.content));
  } catch {
    return null; // 解析失败不缓存，避免坏数据反复占位
  }
  if (!entry.cacheKey) return { consumer, slot: null };
  cacheMisses += 1;
  const slot: CacheSlot = { consumer, bytes: entry.content.length, refs: 1, doomed: false };
  cache.set(entry.cacheKey, slot);
  cacheBytes += slot.bytes;
  evictOver(maxCacheBytes);
  return { consumer, slot };
}

/**
 * 将压缩堆栈逐帧映射回源码位置。无法匹配的帧原样保留。
 */
export async function symbolicateStack(stack: string | null | undefined, maps: SourceMapEntry[]): Promise<string | null> {
  if (!stack || maps.length === 0) return null;
  const byBase = new Map<string, SourceMapEntry>();
  for (const m of maps) byBase.set(basename(m.fileName), m);

  const borrowed = new Map<string, { consumer: SourceMapConsumer; slot: CacheSlot | null }>();
  const lines = stack.split('\n');
  const out: string[] = [];
  let changed = false;

  try {
    for (const line of lines) {
      const m = FRAME_RE.exec(line);
      if (!m) { out.push(line); continue; }
      const fnName = m[1];
      const url = m[2];
      const lineNo = Number(m[3]);
      const colNo = Number(m[4]);
      const base = basename(url);
      const entry = byBase.get(base);
      if (!entry) { out.push(line); continue; }

      let held = borrowed.get(base);
      if (!held) {
        const acquired = await acquireConsumer(entry);
        if (!acquired) { out.push(line); continue; }
        held = acquired;
        borrowed.set(base, held);
      }
      const pos = held.consumer.originalPositionFor({ line: lineNo, column: colNo });
      if (pos.source && pos.line != null) {
        changed = true;
        out.push(`    at ${pos.name ?? fnName ?? '?'} (${pos.source}:${pos.line}:${pos.column ?? 0})`);
      } else {
        out.push(line);
      }
    }
  } catch {
    return null;
  } finally {
    for (const held of borrowed.values()) {
      if (held.slot) releaseSlot(held.slot);
      else destroyConsumer(held.consumer);
    }
  }
  return changed ? out.join('\n') : null;
}
