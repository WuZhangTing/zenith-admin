/**
 * 路由装配防线。
 *
 * 背景：`src/index.ts` 曾把 236 个 `app.route()` 摊在一个文件里，挂载顺序只能靠
 * 人肉连读 236 行来保证。改为按域装配（`src/routes/index.ts` 的 ROUTE_DOMAINS）后，
 * 顺序由本测试锁定——任何域内重排、域间调序、误删/误加挂载都会在 CI 暴露。
 *
 * 这些断言之所以能写，是因为 `createApp()` 已从 `src/index.ts` 抽离为纯函数：
 * 此前 index.ts 顶层就有 `serve()`，app 根本无法在测试进程里构造。
 */
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { ROUTE_DOMAINS } from './routes';
import type { DomainCtx } from './routes/_kit';

/** 域装配清单：域顺序 + 域内挂载顺序，二者都是语义的一部分 */
function mountManifest(): string[] {
  const ctx = { upgradeWebSocket: (() => undefined) as unknown } as DomainCtx;
  const lines: string[] = [];
  for (const domain of ROUTE_DOMAINS) {
    for (const [path] of domain.mounts(ctx)) lines.push(`${domain.name}  ${path}`);
  }
  for (const domain of ROUTE_DOMAINS) {
    for (const [path] of domain.fallback?.(ctx) ?? []) lines.push(`${domain.name}  [fallback] ${path}`);
  }
  return lines;
}

describe('路由装配', () => {
  it('域装配清单不漂移（域顺序 + 域内挂载顺序）', () => {
    expect(mountManifest()).toMatchSnapshot();
  });

  it('路由表（唯一 method+path）不漂移', () => {
    const { app } = createApp();
    const unique = [...new Set(app.routes.map((r) => `${r.method} ${r.path}`))].sort();
    expect(unique).toMatchSnapshot();
  });

  it('兜底挂载必须晚于全部 API 路由——否则会吞掉未匹配的一切请求', () => {
    const { app } = createApp();
    // CMS 前台 SSR 挂在 '/'（按 Host 匹配站点），必须是最后注册的业务路由
    const lastBusiness = app.routes.filter((r) => r.method !== 'ALL').at(-1);
    expect(lastBusiness?.path).toBe('/*');
  });

  it('全局中间件必须早于全部业务路由', () => {
    const { app } = createApp();
    const firstBusiness = app.routes.findIndex((r) => !(r.method === 'ALL' && r.path === '/*'));
    // 前若干条必须全是全局中间件（ALL /*）
    expect(firstBusiness).toBeGreaterThan(0);
    expect(app.routes.slice(0, firstBusiness).every((r) => r.method === 'ALL' && r.path === '/*')).toBe(true);
  });

  it('同一路径被多次挂载时顺序即语义，需显式登记', () => {
    const ctx = { upgradeWebSocket: (() => undefined) as unknown } as DomainCtx;
    const paths = ROUTE_DOMAINS.flatMap((d) => d.mounts(ctx).map(([p]) => p));
    const dup = [...new Set(paths.filter((p, i) => paths.indexOf(p) !== i))].sort();
    // 新增重复挂载会让本断言失败——请确认顺序无误后再登记到此处
    expect(dup).toEqual([
      '/api/ai/conversations',
      '/api/analytics',
      '/api/payment',
      '/api/report/dashboards',
    ]);
  });

  it('域名唯一且非空', () => {
    const names = ROUTE_DOMAINS.map((d) => d.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
