/**
 * MSW handlers for OAuth2 standard endpoints (authorize, token, userinfo, etc.)
 */
import { http, HttpResponse } from 'msw';
import { ok, badRequest } from '@/mocks/utils/handlers';

const BASE = '/api/oauth2';

// 简单的 mock token store
const accessTokens = new Map<string, { userId: number; clientId: string; scopes: string[] }>();

export const oauth2AuthHandlers = [
  // 查询应用授权信息
  http.get(`${BASE}/authorize/info`, ({ request: req }) => {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('client_id');
    const scope = url.searchParams.get('scope') ?? 'openid';
    if (!clientId) {
      return badRequest('client_id 缺失', { status: 400 });
    }
    return ok({
      clientId,
      name: 'Demo 应用（Mock）',
      logoUrl: null,
      description: '这是一个演示应用',
      requestedScopes: scope.split(' ').filter(Boolean),
      alreadyGranted: false,
    }, 'success');
  }),

  // 用户确认授权
  http.post(`${BASE}/authorize`, async ({ request: req }) => {
    const body = await req.json() as Record<string, string>;
    const code = `mock_code_${Date.now()}`;
    // mock 不需要真正存储 code，直接返回跳转 URL
    const stateParam = body.state ? `&state=${encodeURIComponent(body.state)}` : '';
    return ok({ redirectUrl: `${body.redirect_uri}?code=${code}${stateParam}` }, 'success');
  }),

  // 令牌端点（form-urlencoded，mock 接受 JSON 也行）
  http.post(`${BASE}/token`, async ({ request: req }) => {
    const contentType = req.headers.get('content-type') ?? '';
    let body: Record<string, string>;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = await req.json() as Record<string, string>;
    }

    const grantType = body.grant_type;
    if (grantType === 'authorization_code' || grantType === 'client_credentials') {
      const token = `oat_mock_${Date.now()}`;
      accessTokens.set(token, { userId: 1, clientId: body.client_id ?? '', scopes: ['openid', 'profile'] });
      return HttpResponse.json({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 7200,
        refresh_token: `ort_mock_${Date.now()}`,
        scope: body.scope ?? 'openid',
      });
    }
    return HttpResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }),

  // 令牌撤销
  http.post(`${BASE}/token/revoke`, async () => {
    return ok(null, '已撤销');
  }),

  // 令牌自省
  http.post(`${BASE}/token/introspect`, async ({ request: req }) => {
    const contentType = req.headers.get('content-type') ?? '';
    let body: Record<string, string>;
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = await req.json() as Record<string, string>;
    }
    const token = body.token ?? '';
    const info = accessTokens.get(token);
    if (!info) {
      return HttpResponse.json({ active: false });
    }
    return HttpResponse.json({
      active: true,
      scope: info.scopes.join(' '),
      client_id: info.clientId,
      username: 'admin',
      sub: String(info.userId),
      token_type: 'access',
    });
  }),

  // UserInfo
  http.get(`${BASE}/userinfo`, () => {
    return HttpResponse.json({
      sub: '1',
      name: 'Super Admin',
      nickname: 'admin',
      email: 'admin@zenith.com',
      email_verified: true,
    });
  }),
];
