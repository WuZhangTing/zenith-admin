/**
 * 路由契约测试——覆盖全部路由文件暴露的所有操作。
 *
 * 为什么需要这层测试：
 * service 层已有近 200 个单测，但它们测不到路由声明本身。以下缺陷类型只有在
 * 装配好的 app 上才能发现，且一旦发生后果严重：
 *
 *  1. 敏感路由漏挂 `authMiddleware` —— 未认证即可访问，service 单测完全无感
 *  2. 公开路由漏写 `security: []` —— OpenAPI 文档撒谎，接入方被误导；更糟的是
 *     它污染了「已声明受保护」集合，使真正的漏挂认证淹没在噪声里无法辨识
 *  3. 漏写 `commonErrorResponses` —— 前端拿不到规范的错误契约
 *
 * 本套件把这些不变量固化下来：任何新增路由若违反约定，CI 直接失败并指名到具体操作。
 *
 * 相关约束见 .agents/skills/zenith/references/constraints.md 的 Route 层章节。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  mockServerInfra,
  buildContractApp,
  requestWithoutCredentials,
  type AppLike,
  type RouteOperation,
} from './test-utils/contract';

mockServerInfra();

let app: AppLike;
let operations: RouteOperation[];
/** 无凭证访问时的实际状态码，按操作 id 索引 */
const unauthenticatedStatus = new Map<string, number>();

beforeAll(async () => {
  const built = await buildContractApp();
  app = built.app;
  operations = built.operations;

  // 全量探测一次，后续断言复用结果——对所有操作的进程内请求成本可观，
  // 拆到各 it 里重复发送会让耗时翻倍。
  for (const op of operations) {
    unauthenticatedStatus.set(op.id, await requestWithoutCredentials(app, op));
  }
  // 超时放宽到 480 秒：耗时几乎全在 buildContractApp() 转译整套 app，
  // 而发布流程的四路并行（lint / test / build / docs）抢的正是同一种转译资源。
  // 独占跑约 90 秒，并行下曾贴着 300 秒撞破——属「慢但有效」，不是卡死。
  // 见 .agents/skills/zenith/references/troubleshooting.md → 性能
}, 480_000);

/** 该操作的成功响应是否为 JSON——文件下载、SSE、渠道回调 ACK 等均不是 */
function producesJson(op: RouteOperation): boolean {
  const ok200 = op.operation.responses?.['200'];
  return Boolean(ok200?.content?.['application/json']);
}

describe('路由装配', () => {
  it('OpenAPI 文档暴露了预期规模的操作', () => {
    // 下界防止「路由域整体没挂上」这类静默失败——曾经的 fallback 挂载顺序问题
    // 就属于这一类：CMS SSR 挂在 '/' 会吞掉一切未匹配路径。
    expect(operations.length).toBeGreaterThan(1500);
  });

  it('不存在重复注册的 method + path', () => {
    const seen = new Set<string>();
    const duplicated: string[] = [];
    for (const op of operations) {
      if (seen.has(op.id)) duplicated.push(op.id);
      seen.add(op.id);
    }
    expect(duplicated).toEqual([]);
  });

  it('未匹配的路径返回标准 404 包络', async () => {
    const res = await app.request('/api/__definitely_not_a_route__');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 404 });
  });
});

describe('认证契约：声明与运行时行为必须一致', () => {
  /**
   * 这是本套件最重要的断言。
   *
   * app.ts 注册了全局 `security: [{ BearerAuth: [] }]`，因此**未显式声明
   * `security: []` 的操作即宣称自己需要 Bearer 令牌**。宣称受保护就必须真的受保护：
   * 无凭证访问只能得到 401。
   *
   * 若此处失败，只有两种可能，都必须修：
   *  - 该操作本就是公开端点 → 给它补上 `security: []`，让文档说实话
   *  - 该操作应当受保护 → 它漏挂了 `authMiddleware`，是一个未授权访问漏洞
   */
  it('声明需要 BearerAuth 的操作，无凭证访问一律返回 401', () => {
    const violations = operations
      .filter((op) => !op.isDeclaredPublic)
      .map((op) => ({ id: op.id, status: unauthenticatedStatus.get(op.id) ?? 0 }))
      .filter((r) => r.status !== 401)
      .map((r) => `${r.id} → ${r.status}`);

    expect(violations).toEqual([]);
  });

  /**
   * 反向校验：声明为公开的操作不应该返回 401。
   *
   * 出现 401 说明该操作实际挂了认证中间件，`security: []` 是错误声明——
   * 接入方会以为不需要令牌，调用后收到 401 且无从查证。
   */
  it('声明为公开（security: []）的操作，无凭证访问不应返回 401', () => {
    const violations = operations
      .filter((op) => op.isDeclaredPublic)
      .filter((op) => unauthenticatedStatus.get(op.id) === 401)
      .map((op) => op.id);

    expect(violations).toEqual([]);
  });

  it('公开端点数量维持在小范围内', () => {
    // 公开端点是攻击面。数量本身不是错误，但增长必须是显式、有意识的决定，
    // 因此在这里设一道阈值：新增公开端点会让这条断言失败，迫使评审。
    const publicOps = operations.filter((op) => op.isDeclaredPublic);
    expect(publicOps.length).toBeLessThanOrEqual(60);
  });
});

describe('错误响应契约', () => {
  /**
   * constraints.md Route 层：所有路由的 responses 块必须包含 `...commonErrorResponses`
   * （涵盖 400/401/403/404/500）。
   *
   * 豁免规则不是白名单，而是一条原则：**不返回 JSON 的端点不适用 JSON 错误契约**。
   * 微信/支付宝回调必须按渠道协议返回纯文本 ACK，给它们声明 `{ code, message }`
   * 错误体只会误导接入方。判据取 200 响应的 content-type，随代码自动演进。
   */
  it('所有返回 JSON 的操作都声明了 commonErrorResponses 的全部状态码', () => {
    const required = ['400', '401', '403', '404', '500'];
    const violations = operations
      .filter(producesJson)
      .map((op) => {
        const responses = op.operation.responses ?? {};
        const missing = required.filter((code) => !(code in responses));
        return missing.length ? `${op.id} 缺少 ${missing.join('/')}` : null;
      })
      .filter((v): v is string => v !== null);

    expect(violations).toEqual([]);
  });

  it('错误响应体使用统一的 code/message 包络', async () => {
    const res = await app.request('/api/users');
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
    expect(typeof body.message).toBe('string');
  });
});

describe('成功响应契约', () => {
  /**
   * constraints.md Route 层：200 响应统一用 `...ok()` / `...okPaginated()` / `...okMsg()`
   * 构造，它们都会把 DTO 包进 `{ code, message, data }` 包络。
   * 这里校验声明层面确实是这个形状，防止有人绕过辅助函数直接写裸 DTO。
   */
  it('所有 200 响应都是 { code, message, data } 包络', () => {
    const violations: string[] = [];
    for (const op of operations) {
      const schema = op.operation.responses?.['200']?.content?.['application/json']?.schema as
        | { properties?: Record<string, unknown>; $ref?: string; allOf?: unknown[] }
        | undefined;
      // 无 JSON 200 响应（文件下载、SSE、重定向等）不适用
      if (!schema || schema.$ref || schema.allOf) continue;
      const props = schema.properties;
      if (!props) continue;
      if (!('code' in props) || !('message' in props)) {
        violations.push(op.id);
      }
    }
    expect(violations).toEqual([]);
  });
});
