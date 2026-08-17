import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { ApiScope, OAuth2Client, OAuth2ClientCreated, OAuth2MyGrant, OAuth2Token, OAuth2UserGrant, RatePlan } from '@zenith/shared/open-platform';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';

export interface OAuth2AppListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  environment?: 'production' | 'sandbox';
  reviewStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
}

export const oauth2AppKeys = {
  all: ['oauth2-apps'] as const,
  lists: ['oauth2-apps', 'list'] as const,
  list: (params: OAuth2AppListParams) => ['oauth2-apps', 'list', params] as const,
  detail: (id: number | undefined) => ['oauth2-apps', 'detail', id] as const,
  ratePlans: ['oauth2-apps', 'rate-plans'] as const,
  scopes: ['oauth2-apps', 'scopes'] as const,
  grantsPrefix: ['oauth2-apps', 'grants'] as const,
  grants: (id: number, page: number, pageSize: number) => ['oauth2-apps', 'grants', id, page, pageSize] as const,
  tokensPrefix: ['oauth2-apps', 'tokens'] as const,
  tokens: (clientId: string, page: number, pageSize: number) => ['oauth2-apps', 'tokens', clientId, page, pageSize] as const,
  myGrantsPrefix: ['oauth2-apps', 'my-grants'] as const,
  myGrants: (page: number, pageSize: number) => ['oauth2-apps', 'my-grants', page, pageSize] as const,
};

export function useOAuth2AppList(params: OAuth2AppListParams) {
  return useQuery({
    queryKey: oauth2AppKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<OAuth2Client>>(`/api/oauth2/clients${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useOAuth2AppDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: oauth2AppKeys.detail(id),
    queryFn: () => request.get<OAuth2Client>(`/api/oauth2/clients/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useOAuth2RatePlans() {
  return useQuery({
    queryKey: oauth2AppKeys.ratePlans,
    queryFn: () => request.get<RatePlan[]>('/api/rate-plans/options', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useOAuth2ApiScopes() {
  return useQuery({
    queryKey: oauth2AppKeys.scopes,
    queryFn: () => request.get<ApiScope[]>('/api/api-scopes/options', { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useSaveOAuth2App() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Record<string, unknown> }) =>
      (id === undefined
        ? request.post<OAuth2ClientCreated>('/api/oauth2/clients', values)
        : request.put<OAuth2Client>(`/api/oauth2/clients/${id}`, values)
      ).then(unwrap),
    onSuccess: (_data, { id }) => {
      if (id !== undefined) void qc.invalidateQueries({ queryKey: oauth2AppKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.lists });
      // ratePlans / scopes 是静态字典型下拉源，与应用增删改无关
    },
  });
}

export function useDeleteOAuth2App() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/oauth2/clients/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: oauth2AppKeys.detail(id) });
      qc.removeQueries({ queryKey: ['oauth2-apps', 'grants', id] });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.lists });
      // 应用删除后其令牌一并失效
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.tokensPrefix });
    },
  });
}

export function useRegenerateOAuth2AppSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<{ clientId: string; clientSecret: string; previousValidUntil: string }>(`/api/oauth2/clients/${id}/regenerate-secret`).then(unwrap),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.lists });
    },
  });
}

export function useReviewOAuth2App() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, comment }: {
      id: number;
      action: 'approve' | 'reject';
      comment?: string;
    }) => request.post<OAuth2Client>(`/api/oauth2/clients/${id}/review`, { action, comment }).then(unwrap),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.lists });
    },
  });
}

export function useOAuth2AppGrants(id: number, page: number, pageSize: number) {
  return useQuery({
    queryKey: oauth2AppKeys.grants(id, page, pageSize),
    queryFn: () => request.get<PaginatedResponse<OAuth2UserGrant>>(
      `/api/oauth2/clients/${id}/grants${toQueryString({ page, pageSize })}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useOAuth2AppTokens(clientId: string | undefined, page: number, pageSize: number) {
  return useQuery({
    queryKey: oauth2AppKeys.tokens(clientId ?? '', page, pageSize),
    queryFn: () => request.get<PaginatedResponse<OAuth2Token>>(
      `/api/oauth2/clients/tokens${toQueryString({ clientId, page, pageSize })}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
    enabled: Boolean(clientId),
  });
}

export function useRevokeOAuth2Token() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/oauth2/clients/tokens/${id}`).then(unwrap),
    // 吊销令牌只影响令牌列表与授权记录，不改变应用本身
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.tokensPrefix });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.grantsPrefix });
    },
  });
}

// ─── 我的已授权应用（用户自助）──────────────────────────────────────────────

export function useMyOAuth2Grants(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: oauth2AppKeys.myGrants(page, pageSize),
    queryFn: () => request.get<PaginatedResponse<OAuth2MyGrant>>(
      `/api/oauth2/clients/my-grants${toQueryString({ page, pageSize })}`,
    ).then(unwrap),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRevokeMyOAuth2Grant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/oauth2/clients/my-grants/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.myGrantsPrefix });
      // 撤销会连带作废该用户在该应用下的令牌，管理端的令牌与授权记录同步过期
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.tokensPrefix });
      void qc.invalidateQueries({ queryKey: oauth2AppKeys.grantsPrefix });
    },
  });
}
