/**
 * 路由表双快照——`app.ts`、`routes/_kit.ts`、`routes/index.ts` 三处注释都声称
 * 「路由表由 src/app.routes.test.ts 快照锁定」，本文件即该锁。
 *
 * 锁两样东西，对应两类不同的事故：
 *
 *  1. **域装配清单**（每个域挂了哪些路径、顺序如何）
 *     `_kit.ts` 的约束 1 写明「mounts 返回的数组顺序即挂载顺序」——同一路径被多次
 *     挂载时（`/api/analytics` ×4、`/api/ai/conversations` ×3），先注册者优先匹配，
 *     顺序是语义的一部分。这类改动在 diff 里只是挪了一行，评审极易放过。
 *
 *  2. **完整路由表**（全部 method + path）
 *     捕获误删、误改路径、以及子路由器忘记挂载。
 *
 * 快照变更本身不是错误——新增接口就应该更新快照。它的价值在于**强制这件事被看见**：
 * `npx vitest -u` 之后 diff 会明确显示动了哪些路由。
 */
import { describe, it, expect } from 'vitest';
import { mockServerInfra } from './test-utils/contract';

mockServerInfra();

/** `upgradeWebSocket` 只在 WS 路由的 handler 里被调用，快照阶段不会执行到 */
const wsStub = (() => () => ({})) as unknown as import('hono/ws').UpgradeWebSocket;

describe('路由表快照', () => {
  it('域装配清单（域顺序 + 各域挂载路径顺序）保持不变', async () => {
    const { ROUTE_DOMAINS } = await import('./routes');

    const manifest = ROUTE_DOMAINS.map((domain) => ({
      domain: domain.name,
      mounts: domain.mounts({ upgradeWebSocket: wsStub }).map(([path]) => path),
      fallback: domain.fallback?.({ upgradeWebSocket: wsStub }).map(([path]) => path) ?? [],
    }));

    expect(manifest).toMatchSnapshot();
  }, 120_000);

  it('完整路由表保持不变', async () => {
    const { createApp } = await import('./app');
    const { app } = createApp();

    // app.routes 含中间件条目（method 为 ALL），只取真正的端点；
    // 排序保证快照稳定——注册顺序已由上一条断言单独锁定。
    const table = [...new Set(
      app.routes
        .filter((r) => r.method !== 'ALL')
        .map((r) => `${r.method} ${r.path}`),
    )].sort();

    expect(table.length).toBeGreaterThan(1500);
    expect(table).toMatchSnapshot();
  }, 120_000);
});
