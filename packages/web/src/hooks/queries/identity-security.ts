import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { QueryOf } from '@zenith/shared/core';
import { identitySecurityContract } from '@zenith/shared/identity';
import { api, useApiMutation } from '@/lib/contract-query';

export type LoginRiskEventListParams = NonNullable<QueryOf<typeof identitySecurityContract.riskEvents>>;

export const identitySecurityKeys = {
  all: ['identity-security'] as const,
  policy: ['identity-security', 'policy'] as const,
  riskLists: ['identity-security', 'risk-events'] as const,
  riskList: (params: LoginRiskEventListParams) => ['identity-security', 'risk-events', params] as const,
};

export function useIdentitySecurityPolicy() {
  return useQuery({
    queryKey: identitySecurityKeys.policy,
    queryFn: () => api(identitySecurityContract.policy),
  });
}

export function useSaveIdentitySecurityPolicy() {
  return useApiMutation(identitySecurityContract.updatePolicy, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: identitySecurityKeys.all }),
  });
}

export function useLoginRiskEventList(params: LoginRiskEventListParams) {
  return useQuery({
    queryKey: identitySecurityKeys.riskList(params),
    queryFn: () => api(identitySecurityContract.riskEvents, { query: params }),
    placeholderData: keepPreviousData,
  });
}
