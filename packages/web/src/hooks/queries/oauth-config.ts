import { useQuery } from '@tanstack/react-query';
import { oauthConfigContract, type OAuthProviderType } from '@zenith/shared/identity';
import { api, useApiMutation } from '@/lib/contract-query';

export const oauthConfigKeys = {
  all: ['oauth-config'] as const,
  lists: ['oauth-config', 'list'] as const,
  list: () => ['oauth-config', 'list'] as const,
  detail: (provider: OAuthProviderType | undefined) => ['oauth-config', 'detail', provider] as const,
};

export function useOAuthConfigs() {
  return useQuery({
    queryKey: oauthConfigKeys.list(),
    queryFn: () => api(oauthConfigContract.list),
  });
}

/** 整体替换保存单个 provider 的配置（`clientSecret` 传掩码或省略时保留原值） */
export function useSaveOAuthConfig() {
  return useApiMutation(oauthConfigContract.update, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: oauthConfigKeys.all }),
  });
}
