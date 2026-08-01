import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { User } from '@zenith/shared/identity';
import { request } from '@/utils/request';
import { ApiError, LOOKUP_STALE_TIME } from '@/lib/query';

export interface AuthSession {
  user: Omit<User, 'password'>;
  permissions: string[];
}

export class AuthRejectedError extends ApiError {
  constructor(message = '登录状态已失效') {
    super(401, message);
    this.name = 'AuthRejectedError';
  }
}

export const authKeys = {
  all: ['auth'] as const,
  me: ['auth', 'me'] as const,
};

export function authSessionQueryOptions() {
  return queryOptions({
    queryKey: authKeys.me,
    queryFn: async ({ signal }): Promise<AuthSession> => {
      const res = await request.get<User & { permissions?: string[] }>('/api/auth/me', { silent: true, signal });
      if (res.code === 401) throw new AuthRejectedError(res.message);
      if (res.code !== 0) throw new ApiError(res.code, res.message);
      const { permissions, ...user } = res.data;
      return { user, permissions: permissions ?? [] };
    },
    staleTime: LOOKUP_STALE_TIME,
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function updateCachedAuthUser(
  queryClient: QueryClient,
  user: Omit<User, 'password'>,
): void {
  queryClient.setQueryData<AuthSession>(authKeys.me, (current) => {
    if (!current || current.user.id !== user.id) return current;
    return { ...current, user };
  });
}
