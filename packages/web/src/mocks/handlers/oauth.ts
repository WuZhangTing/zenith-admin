import { http } from 'msw';
import { OAUTH_PROVIDERS } from '@zenith/shared/identity';
import { ok } from '@/mocks/utils/handlers';

const API = import.meta.env.VITE_API_BASE_URL || '';

export const oauthHandlers = [
  // 已启用的提供方（演示模式全部开放；须先于 :provider 注册，否则被当成 provider="providers"）
  http.get(`${API}/api/auth/oauth/providers`, () => {
    return ok([...OAUTH_PROVIDERS]);
  }),

  // 获取登录授权链接
  http.get(`${API}/api/auth/oauth/:provider`, ({ params }) => {
    const provider = params.provider as string;
    return ok({
      authUrl: `https://example.com/oauth/${provider}?demo=true`,
      state: 'mock-state-123',
    });
  }),

  // 获取绑定授权链接（当前用户）
  http.get(`${API}/api/auth/oauth/:provider/bind`, ({ params }) => {
    const provider = params.provider as string;
    return ok({
      authUrl: `https://example.com/oauth/${provider}?demo=true&intent=bind`,
      state: 'mock-bind-state-123',
    });
  }),

  // OAuth 登录回调（code + state）
  http.post(`${API}/api/auth/oauth/:provider/callback`, () => {
    return ok({ needBind: true, oauthInfo: { provider: 'github', openId: 'mock-123', nickname: 'DemoUser' } }, '演示模式：第三方登录暂不可用');
  }),

  // 绑定（provider + code + state）
  http.post(`${API}/api/auth/oauth/bind`, () => {
    return ok(null, '绑定成功（演示）');
  }),

  // 解绑
  http.delete(`${API}/api/auth/oauth/unbind/:provider`, () => {
    return ok(null, '已解绑（演示）');
  }),

  // 账号列表
  http.get(`${API}/api/auth/oauth/accounts`, () => {
    return ok([
        {
          id: 1,
          provider: 'github',
          openId: '12345678',
          nickname: 'demo-github-user',
          avatar: null,
          createdAt: '2025-01-01 00:00:00',
        },
      ]);
  }),
];
