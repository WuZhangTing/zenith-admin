import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { QueryOf } from '@zenith/shared/core';
import { sessionContract } from '@zenith/shared/identity';
import { api, useApiMutation } from '@/lib/contract-query';

export type SessionListParams = NonNullable<QueryOf<typeof sessionContract.list>>;

export const sessionKeys = {
  all: ['sessions'] as const,
  lists: ['sessions', 'list'] as const,
  list: (params: SessionListParams) => ['sessions', 'list', params] as const,
};

export function useSessionList(params: SessionListParams) {
  return useQuery({
    queryKey: sessionKeys.list(params),
    queryFn: () => api(sessionContract.list, { query: params }),
    placeholderData: keepPreviousData,
  });
}

/** 强制下线：single 只踢指定会话，all 踢该用户全部会话；两者都改变在线列表 */
export function useForceLogoutSession() {
  return useApiMutation(sessionContract.forceLogout, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}

export function useForceLogoutUserSessions() {
  return useApiMutation(sessionContract.forceLogoutUser, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: sessionKeys.all }),
  });
}
