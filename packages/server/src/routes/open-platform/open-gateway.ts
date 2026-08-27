/**
 * 开放 API 网关（对外）：/api/open/v1/*
 *   - 鉴权方式：HMAC 签名（X-App-Key + 可选签名头），非管理员 Bearer Token
 *   - 鉴权方式：OAuth2 Bearer 令牌，或 AppKey + HMAC 签名（详见 middleware/open-gateway）
 *   - 经过 openGatewayAuth → openApiMetering → openRateLimit 三层网关中间件
 *   - 这里提供若干演示端点，使签名验签 / 限流套餐 / 调用统计端到端可用
 *   - CMS Headless 端点见 ./open-cms（走同一条中间件链，挂载在 /v1/cms 下）
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { RULE_REF_KINDS, type RuleRefKind } from '@zenith/shared/rules';
import { okBody, errBody } from '../../lib/openapi-schemas';
import { formatDateTime } from '../../lib/datetime';
import { openGatewayAuth, openApiMetering, openRateLimit } from '../../middleware/open-gateway';
import { decide } from '../../services/platform/rules-runtime.service';
import openCmsRoutes, { OPEN_CMS_ENDPOINTS } from './open-cms';

/**
 * 必须是 OpenAPIHono 而非普通 Hono：`OpenAPIHono.route()` 只在**父子都是 OpenAPIHono**
 * 时才把子路由的 openAPIRegistry 合并上来。父级用普通 Hono 会让 open-cms 的定义
 * 在这一层被静默丢弃，端点能正常访问但不会出现在 openapi.json / Swagger 里。
 */
const router = new OpenAPIHono();

// 网关三层中间件（顺序：鉴权 → 计量 → 限流 → 业务）
router.use('/v1/*', openGatewayAuth, openApiMetering, openRateLimit);

// CMS Headless 端点（挂在中间件之后，共用同一条鉴权/计量/限流链）
router.route('/v1', openCmsRoutes);

/** scope 校验：记录本次所需 scope；以 principal 的有效 scope 为准（令牌级而非应用级） */
function hasScope(c: Context, scope: string): boolean {
  c.set('openScope', scope);
  return c.get('openPrincipal')?.scopes.includes(scope) ?? false;
}

// GET /v1/ping —— 连通性测试（无需 scope）
router.get('/v1/ping', (c) => {
  const principal = c.get('openPrincipal');
  return c.json(okBody({
    pong: true,
    app: principal?.app.name ?? null,
    environment: principal?.app.environment ?? 'production',
    channel: principal?.channel ?? null,
    time: formatDateTime(new Date()),
  }), 200);
});

// GET /v1/echo —— 回显查询参数（scope: data:read）
router.get('/v1/echo', (c) => {
  if (!hasScope(c, 'data:read')) return c.json(errBody('应用未授权 scope：data:read', 403), 403);
  const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
  return c.json(okBody({ query }), 200);
});

// POST /v1/echo —— 回显 JSON 请求体（scope: data:write，用于演示带 body 的签名）
router.post('/v1/echo', async (c) => {
  if (!hasScope(c, 'data:write')) return c.json(errBody('应用未授权 scope：data:write', 403), 403);
  let body: unknown = null;
  try {
    body = await c.req.json();
  } catch {
    // 非 JSON body，按 null 处理
  }
  return c.json(okBody({ body }), 200);
});

// GET /v1/userinfo —— 返回当前调用主体信息（scope: user:read）
router.get('/v1/userinfo', (c) => {
  if (!hasScope(c, 'user:read')) return c.json(errBody('应用未授权 scope：user:read', 403), 403);
  const principal = c.get('openPrincipal');
  return c.json(okBody({
    appKey: principal?.app.clientId ?? null,
    appName: principal?.app.name ?? null,
    environment: principal?.app.environment ?? 'production',
    channel: principal?.channel ?? null,
    userId: principal?.userId ?? null,
    scopes: principal?.scopes ?? [],
  }), 200);
});

// POST /v1/rules/evaluate —— 规则中心统一求值（scope: rules:evaluate）
// 只允许求值已发布的平台级资产；kind=list 需传 subjects（待检测主体值集合）
router.post('/v1/rules/evaluate', async (c) => {
  if (!hasScope(c, 'rules:evaluate')) return c.json(errBody('应用未授权 scope：rules:evaluate', 403), 403);
  let body: { kind?: string; key?: string; facts?: Record<string, unknown>; subjects?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json(errBody('请求体必须是 JSON', 400), 400);
  }
  const kind = (body.kind ?? 'table') as RuleRefKind;
  if (!RULE_REF_KINDS.includes(kind)) return c.json(errBody(`不支持的资产类型：${String(body.kind)}（可选：${RULE_REF_KINDS.join('/')}）`, 400), 400);
  const key = body.key?.trim();
  if (!key) return c.json(errBody('缺少规则资产 key', 400), 400);
  const principal = c.get('openPrincipal');
  try {
    const decision = await decide(
      { kind, key },
      (body.facts ?? {}) as Record<string, unknown>,
      {
        caller: `open.${principal?.app.clientId ?? 'unknown'}`.slice(0, 64),
        mode: 'required',
        source: 'open',
        tenantId: null,
        subjects: Array.isArray(body.subjects) ? body.subjects.map(String) : undefined,
      },
    );
    return c.json(okBody(decision), 200);
  } catch (err) {
    if (err instanceof HTTPException) return c.json(errBody(err.message, err.status), err.status as 400);
    return c.json(errBody('规则求值失败，请检查 facts 输入', 400), 400);
  }
});

// ─── 短链服务（scope: data:write / data:read）────────────────────────────────
// POST /v1/short-links —— 生成短链（支持自定义短码 / 标题 / 有效期）
router.post('/v1/short-links', async (c) => {
  if (!hasScope(c, 'data:write')) return c.json(errBody('应用未授权 scope：data:write', 403), 403);
  let body: { targetUrl?: string; code?: string; title?: string; expiresAt?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(errBody('请求体必须是 JSON', 400), 400);
  }
  const targetUrl = body.targetUrl?.trim();
  if (!targetUrl) return c.json(errBody('缺少 targetUrl', 400), 400);
  const code = body.code?.trim();
  if (code && !/^[0-9A-Za-z_-]{4,32}$/.test(code)) {
    return c.json(errBody('自定义短码需为 4-32 位字母、数字、连字符或下划线', 400), 400);
  }
  const principal = c.get('openPrincipal');
  const { createOpenShortLink } = await import('../../services/short-link/short-link.service');
  try {
    const link = await createOpenShortLink(
      { targetUrl, code, title: body.title?.trim() || null, expiresAt: body.expiresAt?.trim() || null },
      principal?.app.name ?? principal?.app.clientId ?? 'unknown',
    );
    return c.json(okBody({ code: link.code, shortUrl: link.shortUrl, targetUrl: link.targetUrl, expiresAt: link.expiresAt }), 200);
  } catch (err) {
    if (err instanceof HTTPException) return c.json(errBody(err.message, err.status), err.status as 400);
    throw err;
  }
});

// GET /v1/short-links/:code/stats —— 短链访问统计（趋势/汇总）
router.get('/v1/short-links/:code/stats', async (c) => {
  if (!hasScope(c, 'data:read')) return c.json(errBody('应用未授权 scope：data:read', 403), 403);
  const code = c.req.param('code');
  const { findShortLinkByCode } = await import('../../services/short-link/short-link.service');
  const link = await findShortLinkByCode(code);
  if (!link) return c.json(errBody('短链不存在', 404), 404);
  const days = Number(c.req.query('days')) || undefined;
  const { computeShortLinkStats } = await import('../../services/short-link/short-link-stats.service');
  const stats = await computeShortLinkStats(link.id, days);
  return c.json(okBody({ code: link.code, shortUrl: link.shortUrl, totals: stats.totals, trend: stats.trend }), 200);
});

export default router;

/**
 * 开放 API 端点目录：演示端点（本文件）+ CMS Headless 端点（open-cms 派生）。
 * 供 API 调试台列出可调用端点，避免前端硬编码一份很快过期的清单。
 */
export const OPEN_GATEWAY_ENDPOINTS: Array<{
  method: string;
  path: string;
  summary: string;
  scope: string | null;
}> = [
  { method: 'GET', path: '/api/open/v1/ping', summary: '连通性测试', scope: null },
  { method: 'GET', path: '/api/open/v1/echo', summary: '查询参数回显', scope: 'data:read' },
  { method: 'POST', path: '/api/open/v1/echo', summary: '请求体回显（验证 body 参与签名）', scope: 'data:write' },
  { method: 'GET', path: '/api/open/v1/userinfo', summary: '当前调用主体信息', scope: 'user:read' },
  { method: 'POST', path: '/api/open/v1/rules/evaluate', summary: '规则中心统一求值（决策表/决策流/评分卡/名单）', scope: 'rules:evaluate' },
  { method: 'POST', path: '/api/open/v1/short-links', summary: '生成短链（支持自定义短码/有效期）', scope: 'data:write' },
  { method: 'GET', path: '/api/open/v1/short-links/{code}/stats', summary: '短链访问统计（汇总与趋势）', scope: 'data:read' },
  ...OPEN_CMS_ENDPOINTS.map((item) => ({ ...item, scope: null })),
];
