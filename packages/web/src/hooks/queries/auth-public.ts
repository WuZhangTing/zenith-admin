import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { EnterpriseIdentityDiscovery, OAuthProviderType } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface CaptchaResult {
  captchaId: string;
  svg: string;
  enabled: boolean;
}

export const authPublicKeys = {
  all: ['auth-public'] as const,
  captcha: ['auth-public', 'captcha'] as const,
  publicConfig: (key: string) => ['auth-public', 'public-config', key] as const,
  enterpriseProviders: (tenantCode: string) => ['auth-public', 'enterprise-providers', tenantCode] as const,
  oauthProviders: ['auth-public', 'oauth-providers'] as const,
};

export function usePublicCaptcha() {
  return useQuery({
    queryKey: authPublicKeys.captcha,
    queryFn: () => request.get<CaptchaResult>('/api/auth/captcha', { silent: true }).then(unwrap),
  });
}

export function usePublicSystemConfig(key: string) {
  return useQuery({
    queryKey: authPublicKeys.publicConfig(key),
    queryFn: () => request.get<{ configValue: string }>(`/api/system-configs/public/${key}`, { silent: true }).then(unwrap),
  });
}

export function useEnterpriseProviders(tenantCode: string) {
  return useQuery({
    queryKey: authPublicKeys.enterpriseProviders(tenantCode),
    queryFn: () =>
      request
        .get<EnterpriseIdentityDiscovery>(`/api/auth/enterprise/providers${toQueryString({ tenantCode })}`, { silent: true })
        .then(unwrap)
        .catch(() => ({ tenantCode, providers: [] })),
    placeholderData: keepPreviousData,
  });
}

/**
 * 已启用的第三方登录提供方（公开接口）。
 * 后端不可达 / 接口异常时按「无可用提供方」处理（返回空数组），登录页据此整块不渲染，而不是渲染出点了就报错的入口。
 */
export function useOAuthProviders(enabled = true) {
  return useQuery({
    queryKey: authPublicKeys.oauthProviders,
    queryFn: () =>
      request
        .get<OAuthProviderType[]>('/api/auth/oauth/providers', { silent: true })
        .then(unwrap)
        .catch((): OAuthProviderType[] => []),
    enabled,
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (values: { email: string }) =>
      request.post<null>('/api/auth/forgot-password', { email: values.email }, { silent: true }).then(unwrap),
  });
}
