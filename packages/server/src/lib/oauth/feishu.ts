import { httpGet, httpPost, HttpClientError } from '../http-client';
import type { OAuthProvider, OAuthProviderConfig, OAuthTokenResult, OAuthUserInfo } from './types';

const OPEN_API = 'https://open.feishu.cn';

interface FeishuTokenResponse {
  code?: number;
  error_description?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

interface FeishuUserInfoResponse {
  code?: number;
  msg?: string;
  data?: {
    open_id?: string;
    union_id?: string;
    name?: string;
    avatar_url?: string;
    email?: string;
    enterprise_email?: string;
  };
}

export class FeishuProvider implements OAuthProvider {
  readonly provider = 'feishu' as const;
  constructor(private readonly cfg: OAuthProviderConfig) {}

  private redirectUri(): string {
    return `${this.cfg.callbackBaseUrl}/oauth/callback/feishu`;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      state,
    });
    return `https://accounts.feishu.cn/open-apis/authen/v1/authorize?${params}`;
  }

  async getToken(code: string): Promise<OAuthTokenResult> {
    const resp = await httpPost(`${OPEN_API}/open-apis/authen/v2/oauth/token`, JSON.stringify({
      grant_type: 'authorization_code',
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      code,
      redirect_uri: this.redirectUri(),
    }), {
      headers: { 'content-type': 'application/json' },
      timeout: 10_000,
      retries: 1,
    });
    if (!resp.ok) throw new HttpClientError('Feishu token request failed', { status: resp.status, url: resp.url });
    const data = await resp.json<FeishuTokenResponse>();
    if (data.code !== 0 || !data.access_token) {
      throw new Error(`Feishu OAuth error: ${data.error_description ?? JSON.stringify(data)}`);
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async getUserInfo(token: OAuthTokenResult): Promise<OAuthUserInfo> {
    const resp = await httpGet(`${OPEN_API}/open-apis/authen/v1/user_info`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      timeout: 10_000,
      retries: 1,
    });
    if (!resp.ok) throw new HttpClientError('Feishu userinfo request failed', { status: resp.status, url: resp.url });
    const data = await resp.json<FeishuUserInfoResponse>();
    if (data.code !== 0 || !data.data?.open_id) {
      throw new Error(`Feishu userinfo error: ${data.msg ?? JSON.stringify(data)}`);
    }
    return {
      openId: data.data.open_id,
      unionId: data.data.union_id,
      nickname: data.data.name || data.data.open_id,
      avatar: data.data.avatar_url,
      email: data.data.email || data.data.enterprise_email,
    };
  }
}
