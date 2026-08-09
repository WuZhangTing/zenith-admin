import { createContext, useContext } from 'react';
import type { ApiResponse } from '@zenith/shared/core';
import type { User, LoginResponse, LoginResult } from '@zenith/shared/identity';

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous' | 'unavailable';
export type AuthResponse<T> = ApiResponse<T> & { retryAfterSeconds?: number };

export interface AuthContextValue {
  user: Omit<User, 'password'> | null;
  permissions: string[];
  status: AuthStatus;
  loading: boolean;
  /** 会话正在（重新）校验：unavailable 页据此显示重试进度而不整页切回加载态 */
  refreshing: boolean;
  error: Error | null;
  login: (
    username: string,
    password: string,
    captchaId?: string,
    captchaCode?: string,
    tenantCode?: string,
  ) => Promise<AuthResponse<LoginResult>>;
  verifyMfaLogin: (
    challengeId: string,
    code: string,
    rememberDevice: boolean,
  ) => Promise<AuthResponse<LoginResponse>>;
  register: (data: {
    username: string;
    nickname: string;
    email: string;
    password: string;
  }) => Promise<AuthResponse<LoginResponse>>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateUser: (user: Omit<User, 'password'>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
