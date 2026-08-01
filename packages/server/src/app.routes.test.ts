/**
 * 路由表快照——`app.ts`、`routes/_kit.ts`、`routes/index.ts` 三处注释都声称
 * 「路由表由 src/app.routes.test.ts 快照锁定」，本文件即该锁。
 *
 * 锁定全部 method + path，捕获误删、误改路径、以及子路由器忘记挂载。
 * 267 个路由文件没有任何路由级单元测试，这是「接口被静默删掉」的唯一防线——
 * 契约测试那侧只有 `operations.length > 1500` 这类下界断言，删掉单个路由不会触发。
 *
 * 快照变更本身不是错误——新增接口就应该更新快照。它的价值在于**强制这件事被看见**：
 * `npx vitest -u` 之后 diff 会明确显示动了哪些路由。
 *
 * **不锁挂载顺序。** 曾有一份「域装配清单」快照试图锁定它，但清单里只存挂载路径，
 * 而顺序真正有语义的场景恰恰是同一路径被多次挂载（`/api/analytics` ×4、
 * `/api/ai/conversations` ×3）——此时互换两条挂载得到逐字节相同的清单，
 * 它防不住自己声称要防的那件事，却让人以为顺序已被保护。已移除，
 * 顺序改动需人工核对，见 `routes/_kit.ts` 约束 1。
 */
import { describe, it, expect } from 'vitest';
import { mockServerInfra } from './test-utils/contract';

mockServerInfra();

describe('路由表快照', () => {
  it('完整路由表保持不变', async () => {
    const { createApp } = await import('./app');
    const { app } = createApp();

    // app.routes 含中间件条目（method 为 ALL），只取真正的端点；
    // 排序保证快照稳定——注册顺序不在本快照的锁定范围内。
    const table = [...new Set(
      app.routes
        .filter((r) => r.method !== 'ALL')
        .map((r) => `${r.method} ${r.path}`),
    )].sort();

    expect(table.length).toBeGreaterThan(1500);
    expect(table).toMatchSnapshot();
  }, 120_000);
});
