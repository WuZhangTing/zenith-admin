import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  PREFERENCES_KEY,
  REFRESH_TOKEN_KEY,
  TABS_STORAGE_KEY,
  TOKEN_KEY,
} from '@zenith/shared/core';
import { AuthProvider } from '@/providers/AuthProvider';
import { ADMIN_AUTH_INVALIDATED_EVENT, request } from '@/utils/request';
import { useAuth } from './useAuth';

vi.mock('@/utils/request', () => ({
  ADMIN_AUTH_INVALIDATED_EVENT: 'auth:invalidated',
  request: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockRequest = vi.mocked(request);

function makeMeResponse(overrides: Record<string, unknown> = {}) {
  return {
    code: 0,
    message: 'success',
    data: {
      id: 1,
      username: 'admin',
      nickname: '管理员',
      email: 'admin@example.com',
      permissions: ['user:read', 'role:read'],
      ...overrides,
    },
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function renderAuthHook(client = createClient()) {
  return {
    client,
    ...renderHook(() => useAuth(), { wrapper: createWrapper(client) }),
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('AuthProvider initialization', () => {
  it('stays anonymous without credentials and does not request /api/auth/me', () => {
    const { result } = renderAuthHook();

    expect(result.current.status).toBe('anonymous');
    expect(result.current.user).toBeNull();
    expect(mockRequest.get).not.toHaveBeenCalled();
  });

  it('loads one shared session for multiple consumers', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    mockRequest.get.mockResolvedValue(makeMeResponse());
    const client = createClient();

    function Consumer({ name }: Readonly<{ name: string }>) {
      const auth = useAuth();
      return <span data-testid={name}>{auth.user?.username ?? auth.status}</span>;
    }

    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <Consumer name="first" />
          <Consumer name="second" />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('first')).toHaveTextContent('admin');
      expect(screen.getByTestId('second')).toHaveTextContent('admin');
    });
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
    expect(mockRequest.get).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ silent: true }));
  });

  it('keeps credentials and exposes unavailable status on network failure', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    mockRequest.get.mockResolvedValue({ code: -1, message: '网络请求失败', data: null });

    const { result } = renderAuthHook();

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('valid-token');
  });

  it('clears credentials when the session is rejected', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'expired-refresh');
    mockRequest.get.mockResolvedValue({ code: 401, message: 'Unauthorized', data: null });

    const { result } = renderAuthHook();

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});

describe('AuthProvider actions', () => {
  it('stores login credentials and fetches the session exactly once', async () => {
    mockRequest.post.mockResolvedValueOnce({
      code: 0,
      message: 'success',
      data: {
        token: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
        user: { id: 1 },
      },
    });
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    const { result } = renderAuthHook();

    await act(async () => {
      await result.current.login('admin', 'password');
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-access-token');
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('new-refresh-token');
    expect(result.current.user?.username).toBe('admin');
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
  });

  it('does not persist credentials after a failed login', async () => {
    mockRequest.post.mockResolvedValueOnce({
      code: 400,
      message: '用户名或密码错误',
      data: null,
    });
    const { result } = renderAuthHook();

    await act(async () => {
      await result.current.login('admin', 'wrong');
    });

    expect(result.current.status).toBe('anonymous');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(mockRequest.get).not.toHaveBeenCalled();
  });

  it('logs out without issuing another /api/auth/me request and clears identity caches', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh');
    localStorage.setItem(PREFERENCES_KEY, '{}');
    localStorage.setItem(TABS_STORAGE_KEY, '[]');
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    mockRequest.post.mockResolvedValueOnce({ code: 0, message: 'success', data: null });
    const client = createClient();
    client.setQueryData(['private', 'data'], { owner: 1 });
    const { result } = renderAuthHook(client);
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => result.current.logout());

    await waitFor(() => {
      expect(result.current.status).toBe('anonymous');
      expect(client.getQueryData(['private', 'data'])).toBeUndefined();
    });
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
  });

  it('updates the shared user while preserving permissions and avoiding refetch', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    const { result } = renderAuthHook();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const current = result.current.user!;

    act(() => result.current.updateUser({ ...current, nickname: '新昵称' }));

    await waitFor(() => expect(result.current.user?.nickname).toBe('新昵称'));
    expect(result.current.permissions).toEqual(['user:read', 'role:read']);
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
  });

  it('does not replace the session user when another account is edited', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    const { result } = renderAuthHook();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    const current = result.current.user!;

    act(() => result.current.updateUser({ ...current, id: 2, nickname: '其他用户' }));

    expect(result.current.user?.id).toBe(1);
    expect(result.current.user?.nickname).toBe('管理员');
  });
});

describe('AuthProvider invalidation synchronization', () => {
  it('handles HTTP unauthorized notifications through the shared state machine', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh');
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    const { result } = renderAuthHook();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    act(() => globalThis.dispatchEvent(new Event(ADMIN_AUTH_INVALIDATED_EVENT)));

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
  });

  it('synchronizes logout from another browser tab', async () => {
    localStorage.setItem(TOKEN_KEY, 'valid-token');
    mockRequest.get.mockResolvedValueOnce(makeMeResponse());
    const { result } = renderAuthHook();
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    localStorage.removeItem(TOKEN_KEY);

    act(() => {
      globalThis.dispatchEvent(new StorageEvent('storage', {
        key: TOKEN_KEY,
        oldValue: 'valid-token',
        newValue: null,
      }));
    });

    await waitFor(() => expect(result.current.status).toBe('anonymous'));
    expect(mockRequest.get).toHaveBeenCalledTimes(1);
  });
});
