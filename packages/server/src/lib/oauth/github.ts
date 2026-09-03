import { httpGet, httpPost, HttpClientError } from '../http-client';
import type { OAuthProvider, OAuthProviderConfig, OAuthTokenResult, OAuthUserInfo } from './types';

export class GitHubProvider implements OAuthProvider {
  readonly provider = 'github' as const;
  constructor(private readonly cfg: OAuthProviderConfig) {}

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: `${this.cfg.callbackBaseUrl}/oauth/callback/github`,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async getToken(code: string): Promise<OAuthTokenResult> {
    const resp = await httpPost('https://github.com/login/oauth/access_token', {
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
      code,
    }, {
      headers: { Accept: 'application/json' },
      timeout: 10_000,
      retries: 1,
    });
    if (!resp.ok) throw new HttpClientError('GitHub token request failed', { status: resp.status, url: resp.url });
    const data = await resp.json<Record<string, unknown>>();
    if (data.error) throw new Error(`GitHub OAuth error: ${(data.error_description || data.error) as string}`);
    return { accessToken: data.access_token as string };
  }

  async getUserInfo(token: OAuthTokenResult): Promise<OAuthUserInfo> {
    const headers = { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json' };
    const resp = await httpGet('https://api.github.com/user', { headers, timeout: 10_000, retries: 1 });
    if (!resp.ok) throw new HttpClientError('GitHub userinfo request failed', { status: resp.status, url: resp.url });
    const user = await resp.json<Record<string, unknown>>();
    // 公开资料里的 email 可能为空且不带验证状态；/user/emails（user:email scope）给出 verified 标记，
    // 只有已验证的主邮箱才能作为自动关联本地账号的依据
    const verified = await this.fetchPrimaryVerifiedEmail(headers);
    return {
      openId: String(user.id),
      nickname: (user.login as string) || (user.name as string) || '',
      avatar: user.avatar_url as string | undefined,
      email: verified ?? (user.email as string | undefined),
      emailVerified: verified !== undefined,
    };
  }

  private async fetchPrimaryVerifiedEmail(headers: Record<string, string>): Promise<string | undefined> {
    try {
      const resp = await httpGet('https://api.github.com/user/emails', { headers, timeout: 10_000, retries: 1 });
      if (!resp.ok) return undefined;
      const emails = await resp.json<Array<{ email?: string; primary?: boolean; verified?: boolean }>>();
      if (!Array.isArray(emails)) return undefined;
      const primary = emails.find((e) => e.verified && e.primary) ?? emails.find((e) => e.verified);
      return primary?.email || undefined;
    } catch {
      return undefined;
    }
  }
}
