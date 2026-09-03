import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Toast } from '@douyinfe/semi-ui';
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from '@zenith/shared/core';
import type { LoginResult } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { markPostLoginHome } from '@/lib/post-login';
import type { MfaHandoffState } from '@/lib/mfa-handoff';

type EnterpriseCallbackResult = { loginResult: LoginResult; redirectTo?: string | null };

export default function EnterpriseCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('正在处理企业登录...');

  useEffect(() => {
    const samlTicket = searchParams.get('samlTicket');
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const callback = samlTicket
      ? request.post<EnterpriseCallbackResult>(
        '/api/auth/enterprise/saml/exchange',
        { ticket: samlTicket },
        { silent: true },
      )
      : code && state
        ? request.post<EnterpriseCallbackResult>(
          '/api/auth/enterprise/callback',
          { code, state },
          { silent: true },
        )
        : null;
    if (!callback) {
      setMessage('企业登录参数不完整');
      return;
    }
    callback
      .then((res) => {
        const loginResult = res.code === 0 ? res.data?.loginResult : undefined;
        // 企业 SSO 与密码登录共用 MFA 策略：命中挑战时交给登录页的验证表单完成
        if (loginResult && 'mfaRequired' in loginResult && loginResult.mfaRequired) {
          const handoff: MfaHandoffState = { mfaChallenge: loginResult, redirectTo: res.data.redirectTo ?? null };
          navigate('/login', { replace: true, state: handoff });
          return;
        }
        if (loginResult && 'token' in loginResult) {
          localStorage.setItem(TOKEN_KEY, loginResult.token.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, loginResult.token.refreshToken);
          Toast.success('登录成功');
          // 整页刷新最终落地 BASE_URL（首页），打标记供 HomeEntry 应用默认首页偏好
          markPostLoginHome();
          navigate(res.data.redirectTo || '/', { replace: true });
          globalThis.location.href = import.meta.env.BASE_URL;
          return;
        }
        setMessage(res.message || '企业登录失败');
        Toast.error(res.message || '企业登录失败');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      })
      .catch(() => {
        setMessage('企业登录失败');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      });
  }, [navigate, searchParams]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <Spin size="large" />
      <span>{message}</span>
    </div>
  );
}
