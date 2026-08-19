import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PREFERENCES_KEY,
  REFRESH_TOKEN_KEY,
  TABS_STORAGE_KEY,
  TOKEN_KEY,
} from '@zenith/shared/core';
import type { LoginResponse, LoginResult } from '@zenith/shared/identity';
import { AuthContext, type AuthContextValue, type AuthStatus } from '@/hooks/useAuth';
import { PermissionContext } from '@/hooks/usePermission';
import {
  AuthRejectedError,
  authKeys,
  authSessionQueryOptions,
  updateCachedAuthUser,
} from '@/hooks/queries/auth';
import { ADMIN_AUTH_INVALIDATED_EVENT, request } from '@/utils/request';

const DEVICE_ID_KEY = 'zenith_device_id';
const AUTH_PUBLIC_QUERY_ROOT = 'auth-public';

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, value);
  return value;
}

function isLoginResponse(data: LoginResult): data is LoginResponse {
  return 'token' in data;
}

function clearStoredUserData(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(PREFERENCES_KEY);
  localStorage.removeItem(TABS_STORAGE_KEY);
}

function collectDeviceInfo(): Record<string, unknown> | undefined {
  try {
    const screen = window.screen;
    const nav = navigator as Navigator & { deviceMemory?: number };
    let gpu: string | undefined;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
      if (gl) {
        const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          gpu = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string || undefined;
        }
      }
    } catch { /* Best-effort device metadata. */ }
    return {
      screenWidth: screen.width,
      screenHeight: screen.height,
      // 保留 2 位小数：浏览器缩放会产生 1.1000000238418579 之类的长小数，后端列为 varchar(8)
      devicePixelRatio: String(Math.round((window.devicePixelRatio ?? 1) * 100) / 100),
      ...(gpu ? { gpu } : {}),
      ...(nav.hardwareConcurrency ? { cpuCores: nav.hardwareConcurrency } : {}),
      ...(nav.deviceMemory ? { memoryGb: String(nav.deviceMemory) } : {}),
    };
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  const initialCredentials = Boolean(localStorage.getItem(TOKEN_KEY));
  const [hasCredentials, setHasCredentials] = useState(initialCredentials);
  const hasCredentialsRef = useRef(initialCredentials);
  const previousCredentialsRef = useRef(initialCredentials);

  const sessionQuery = useQuery({
    ...authSessionQueryOptions(),
    enabled: hasCredentials,
  });

  const setCredentialPresence = useCallback((present: boolean) => {
    hasCredentialsRef.current = present;
    setHasCredentials(present);
  }, []);

  const clearIdentityCache = useCallback(async () => {
    const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== AUTH_PUBLIC_QUERY_ROOT;
    await queryClient.cancelQueries({ predicate });
    queryClient.removeQueries({ predicate });
    queryClient.getMutationCache().clear();
  }, [queryClient]);

  const transitionToAnonymous = useCallback(() => {
    setCredentialPresence(false);
    clearStoredUserData();
    void queryClient.cancelQueries({ queryKey: authKeys.all });
  }, [queryClient, setCredentialPresence]);

  const fetchCurrentSession = useCallback(async () => {
    if (!hasCredentialsRef.current) return;
    try {
      await queryClient.fetchQuery({ ...authSessionQueryOptions(), staleTime: 0 });
    } catch (error) {
      if (error instanceof AuthRejectedError) transitionToAnonymous();
    }
  }, [queryClient, transitionToAnonymous]);

  const activateSession = useCallback(async (token: LoginResponse['token']) => {
    hasCredentialsRef.current = true;
    await clearIdentityCache();
    localStorage.setItem(TOKEN_KEY, token.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, token.refreshToken);
    setHasCredentials(true);
    await fetchCurrentSession();
  }, [clearIdentityCache, fetchCurrentSession]);

  useEffect(() => {
    const wasAuthenticated = previousCredentialsRef.current;
    previousCredentialsRef.current = hasCredentials;
    if (hasCredentials || !wasAuthenticated) return;

    let active = true;
    void clearIdentityCache().then(() => {
      if (active && !hasCredentialsRef.current) {
        queryClient.removeQueries({ queryKey: authKeys.all });
      }
    });
    return () => { active = false; };
  }, [clearIdentityCache, hasCredentials, queryClient]);

  useEffect(() => {
    if (sessionQuery.error instanceof AuthRejectedError) transitionToAnonymous();
  }, [sessionQuery.error, transitionToAnonymous]);

  useEffect(() => {
    const handleInvalidated = () => transitionToAnonymous();
    globalThis.addEventListener(ADMIN_AUTH_INVALIDATED_EVENT, handleInvalidated);
    return () => globalThis.removeEventListener(ADMIN_AUTH_INVALIDATED_EVENT, handleInvalidated);
  }, [transitionToAnonymous]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) {
        transitionToAnonymous();
        return;
      }
      if (!hasCredentialsRef.current) {
        hasCredentialsRef.current = true;
        void clearIdentityCache().then(() => {
          if (!localStorage.getItem(TOKEN_KEY)) {
            transitionToAnonymous();
            return;
          }
          setHasCredentials(true);
          void fetchCurrentSession();
        });
      }
    };
    globalThis.addEventListener('storage', handleStorage);
    return () => globalThis.removeEventListener('storage', handleStorage);
  }, [clearIdentityCache, fetchCurrentSession, transitionToAnonymous]);

  const login = useCallback<AuthContextValue['login']>(async (
    username,
    password,
    captchaId,
    captchaCode,
    tenantCode,
  ) => {
    const res = await request.post<LoginResult>(
      '/api/auth/login',
      {
        username,
        password,
        captchaId,
        captchaCode,
        tenantCode,
        deviceInfo: collectDeviceInfo(),
        deviceId: getDeviceId(),
        rememberDevice: true,
      },
      { silent: true },
    );
    if (res.code === 0 && isLoginResponse(res.data)) await activateSession(res.data.token);
    return res;
  }, [activateSession]);

  const verifyMfaLogin = useCallback<AuthContextValue['verifyMfaLogin']>(async (
    challengeId,
    code,
    rememberDevice,
  ) => {
    const res = await request.post<LoginResponse>(
      '/api/auth/mfa/verify',
      { challengeId, code, rememberDevice },
      { silent: true },
    );
    if (res.code === 0) await activateSession(res.data.token);
    return res;
  }, [activateSession]);

  const register = useCallback<AuthContextValue['register']>(async (data) => {
    const res = await request.post<LoginResponse>('/api/auth/register', data, { silent: true });
    if (res.code === 0) await activateSession(res.data.token);
    return res;
  }, [activateSession]);

  const logout = useCallback(() => {
    request.post('/api/auth/logout', {}, { silent: true, skipAuth: true }).catch(() => {});
    transitionToAnonymous();
  }, [transitionToAnonymous]);

  const refresh = useCallback(async () => {
    await fetchCurrentSession();
  }, [fetchCurrentSession]);

  const updateUser = useCallback<AuthContextValue['updateUser']>((user) => {
    updateCachedAuthUser(queryClient, user);
  }, [queryClient]);

  const session = hasCredentials ? sessionQuery.data : undefined;
  let status: AuthStatus;
  if (!hasCredentials) status = 'anonymous';
  else if (session) status = 'authenticated';
  // 401 由上面的 effect 立即切到 anonymous，这一帧继续显示加载态，避免闪一下「连不上服务器」
  else if (sessionQuery.error instanceof AuthRejectedError) status = 'checking';
  // 失败过就停在 unavailable：无数据的查询重新 fetch 时，TanStack Query 会把 status 重置回 pending
  // 并清空 error，若据此判为 checking，点「重试」会整页闪回加载点再弹回错误页；
  // errorUpdatedAt 不参与这次重置，是「曾经失败」的稳定信号
  else if (sessionQuery.errorUpdatedAt > 0) status = 'unavailable';
  else if (sessionQuery.isFetching || sessionQuery.isPending) status = 'checking';
  else status = 'unavailable';

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    permissions: session?.permissions ?? [],
    status,
    loading: status === 'checking',
    refreshing: sessionQuery.isFetching,
    error: sessionQuery.error,
    login,
    verifyMfaLogin,
    register,
    logout,
    refresh,
    updateUser,
  }), [
    login,
    logout,
    refresh,
    register,
    session,
    sessionQuery.error,
    sessionQuery.isFetching,
    status,
    updateUser,
    verifyMfaLogin,
  ]);

  return (
    <AuthContext.Provider value={value}>
      <PermissionContext.Provider value={value.permissions}>
        {children}
      </PermissionContext.Provider>
    </AuthContext.Provider>
  );
}
