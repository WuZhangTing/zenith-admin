/**
 * 全套测试共用的 Redis 替身。
 *
 * `lib/redis` 在模块加载时就 `client.connect()`——任何测试文件只要传递依赖
 * 摸到它（lib/permissions、middleware 栈、大量 service），就会向本机发起真实
 * TCP 连接：本地有 Redis 时全量跑一次曾产生 65 条真实连接（日志噪音 + 跨 worker
 * 共享真实状态的竞态面），CI 没有 Redis 时则留下 ioredis 重连定时器与 worker
 * 退出互相竞争。因此由 `src/test-setup.ts` 全局替换，单个测试文件如需断言
 * 调用细节，仍可用自己的 `vi.mock('../lib/redis', ...)` 覆盖（后注册者生效）。
 *
 * 用 Proxy 而非逐个列举方法：限流、幂等、会话、黑名单会用到十几个不同命令，
 * 逐个补是维护负担，漏一个就是一条 unhandled rejection。
 */
import { vi } from 'vitest';

/** multi()/pipeline() 的链式替身：任意命令返回自身，exec 归空 */
function createChainStub(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  return new Proxy(chain, {
    get(target, prop: string) {
      if (prop === 'exec') return vi.fn().mockResolvedValue([]);
      if (prop === 'then') return undefined;
      if (!(prop in target)) target[prop] = vi.fn(() => createChainStub());
      return target[prop];
    },
  });
}

/** 一个「怎么调都返回 null」的 Redis 替身，覆盖已知命令的特殊返回形状 */
export function createRedisStub(): Record<string, unknown> {
  const stub: Record<string, unknown> = {
    // hono-rate-limiter 的 RedisStore 在构造时立即 SCRIPT LOAD
    script: vi.fn().mockResolvedValue('stub-sha'),
    // 限流脚本约定返回 [窗口计数, 重置毫秒数]，兜底 null 会让解构处抛
    // "(intermediate value) is not iterable" 并打进日志
    eval: vi.fn().mockResolvedValue([1, 60_000]),
    evalsha: vi.fn().mockResolvedValue([1, 60_000]),
    keys: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(['0', []]),
    exists: vi.fn().mockResolvedValue(0),
    // 幂等中间件用 SET NX 判断是否首次请求，'OK' 表示放行
    set: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    // rate-limit 的 hit stats 走 multi().incr().expire().exec()
    pipeline: vi.fn(() => createChainStub()),
    multi: vi.fn(() => createChainStub()),
    status: 'ready',
  };

  return new Proxy(stub, {
    get(target, prop: string) {
      if (prop === 'then') return undefined; // 避免被当成 thenable
      if (!(prop in target)) target[prop] = vi.fn().mockResolvedValue(null);
      return target[prop];
    },
  });
}
