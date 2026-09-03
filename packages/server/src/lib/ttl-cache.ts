/**
 * 进程内 TTL 缓存：单飞（single-flight）+ 过期即用旧值后台刷新（stale-while-revalidate）。
 *
 * 高并发热路径上的朴素「过期即查库」缓存有两个问题：
 * - 击穿：过期瞬间在途的几百个请求同时未命中，同一条查询被排进连接池几百次，
 *   查询构造的 CPU 与排队延迟一起把事件循环拖垮（IoT WS 接入 800 帧/s 时实测卡死两分钟）
 * - 同刻过期：同一批 key 在同一秒过期，形成周期性抖动
 *
 * 语义：
 * - `get(key, loader)`：未过期直接返回；已过期但有旧值 → **立即返回旧值**，后台单飞刷新；
 *   无值 → 单飞加载（同 key 并发只执行一次 loader，其余等待同一个 Promise）
 * - TTL 带 ±jitter（默认 20%），错开同批 key 的过期时刻
 * - `delete` / `clear` 供写路径主动失效
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();
  private readonly inflight = new Map<K, Promise<V>>();
  private readonly jitter: number;
  private readonly staleWhileRevalidate: boolean;

  constructor(
    private readonly ttlMs: number,
    options: { jitter?: number; staleWhileRevalidate?: boolean } = {},
  ) {
    this.jitter = options.jitter ?? 0.2;
    this.staleWhileRevalidate = options.staleWhileRevalidate ?? true;
  }

  private expiry(now: number): number {
    const spread = this.ttlMs * this.jitter;
    return now + this.ttlMs + (Math.random() * 2 - 1) * spread;
  }

  private load(key: K, loader: () => Promise<V>): Promise<V> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const p = loader().then((value) => {
      this.entries.set(key, { value, expiresAt: this.expiry(Date.now()) });
      return value;
    }).finally(() => {
      if (this.inflight.get(key) === p) this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }

  get(key: K, loader: () => Promise<V>): Promise<V> {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > now) return Promise.resolve(entry.value);
    if (entry && this.staleWhileRevalidate) {
      // 旧值先用，刷新失败保留旧值（下次 get 再试）
      this.load(key, loader).catch(() => {});
      return Promise.resolve(entry.value);
    }
    return this.load(key, loader);
  }

  /** 只读当前值（不触发加载，过期值也返回） */
  peek(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: K, value: V): void {
    this.entries.set(key, { value, expiresAt: this.expiry(Date.now()) });
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
