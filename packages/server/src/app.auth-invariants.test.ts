/**
 * 认证不变量防线：写接口不得意外公开。
 *
 * 全局默认安全方案是 `BearerAuth`（见 app.ts 的 doc31），公开接口通过在
 * `createRoute` 里写 `security: []` 单独豁免。本测试遍历**整份 OpenAPI 文档**
 * （1800+ 操作），断言所有非 GET 的 `/api/*` 操作要么受 BearerAuth 保护，
 * 要么在下方白名单中显式登记。
 *
 * 价值：新增一个公开写接口会让本测试失败，必须显式改白名单——把"漏挂认证"
 * 从一个看不见的疏忽，变成一次必须过 review 的改动。此前 250 个路由文件里
 * 只有 2 个有测试，这类问题没有任何自动化拦截。
 *
 * 覆盖范围：仅覆盖走 `@hono/zod-openapi` 注册的路由（绝大多数业务接口）。
 * 裸 `Hono` 子应用（WebSocket、CMS 前台 SSR）不进 OpenAPI 文档，不在此列。
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';

/**
 * 允许匿名访问的写接口白名单。
 *
 * 均为认证入口本身或对外公开的回调/支付页，天然无法要求 Bearer token。
 * 新增条目前请确认：该接口是否已有其他防护（限流 / 签名校验 / 一次性 token）。
 */
const PUBLIC_WRITE_ALLOWLIST = new Set([
  // 管理端认证入口
  'POST /api/auth/login',
  'POST /api/auth/register',
  'POST /api/auth/refresh',
  'POST /api/auth/mfa/verify',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  // 第三方 / 企业身份源回调
  'POST /api/auth/oauth/{provider}/callback',
  'POST /api/auth/enterprise/callback',
  'POST /api/auth/enterprise/ldap/login',
  'POST /api/auth/enterprise/saml/acs',
  'POST /api/auth/enterprise/saml/exchange',
  // 会员端（C 端）认证入口
  'POST /api/member/auth/sms-code',
  'POST /api/member/auth/register',
  'POST /api/member/auth/login',
  'POST /api/member/auth/refresh',
  'POST /api/member/auth/reset-password',
  // 公开支付页：凭一次性 token 访问
  'POST /api/public/payment/link/{token}/pay',
]);

const WRITE_METHODS = ['post', 'put', 'delete', 'patch'] as const;

interface Operation { security?: unknown[] }

function collectOperations() {
  const { app } = createApp();
  const doc = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'auth-invariant-probe', version: '1' },
    security: [{ BearerAuth: [] }],
  }) as { paths?: Record<string, Record<string, Operation>> };

  const publicWrites: string[] = [];
  let total = 0;
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of WRITE_METHODS) {
      const op = item[method];
      if (!op) continue;
      total++;
      // security: [] 表示显式豁免全局 BearerAuth
      if (Array.isArray(op.security) && op.security.length === 0) {
        publicWrites.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return { total, publicWrites };
}

describe('认证不变量', () => {
  // 整份 OpenAPI 文档（1800+ 操作）生成耗时数秒，全 describe 只算一次
  let ops: ReturnType<typeof collectOperations>;
  beforeAll(() => { ops = collectOperations(); }, 120_000);

  it('所有匿名可访问的写接口都必须在白名单中显式登记', () => {
    const undeclared = ops.publicWrites.filter((op) => !PUBLIC_WRITE_ALLOWLIST.has(op)).sort();
    expect(
      undeclared,
      '以下写接口声明了 security: [] 但未登记到 PUBLIC_WRITE_ALLOWLIST。\n'
      + '若确为公开接口，请补充白名单并说明已有的替代防护（限流 / 签名 / 一次性 token）；\n'
      + '否则请移除 security: [] 并补上 authMiddleware + guard。',
    ).toEqual([]);
  });

  it('白名单不得残留已下线的接口', () => {
    const live = new Set(ops.publicWrites);
    const stale = [...PUBLIC_WRITE_ALLOWLIST].filter((op) => !live.has(op)).sort();
    expect(stale, '白名单中的接口已不存在或已不再公开，请清理').toEqual([]);
  });

  it('绝大多数写接口应处于受保护状态', () => {
    expect(ops.total).toBeGreaterThan(500);
    // 公开写接口占比极低是健康信号；显著上升说明有人在批量绕过认证
    expect(ops.publicWrites.length / ops.total).toBeLessThan(0.05);
  });
});
