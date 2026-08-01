import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from './http-client';

class TestHttpClient extends HttpClient {
  invalidateAuthentication(): void {
    this.clearAuthAndRedirect();
  }
}

describe('HttpClient unauthorized handling', () => {
  beforeEach(() => localStorage.clear());

  it('clears credentials and delegates navigation to the host callback', () => {
    const onUnauthorized = vi.fn();
    localStorage.setItem('access-token', 'access');
    localStorage.setItem('refresh-token', 'refresh');
    const client = new TestHttpClient({
      baseUrl: '',
      tokenKey: 'access-token',
      refreshTokenKey: 'refresh-token',
      refreshPath: '/refresh',
      loginUrl: () => '/login',
      onUnauthorized,
    });

    client.invalidateAuthentication();

    expect(localStorage.getItem('access-token')).toBeNull();
    expect(localStorage.getItem('refresh-token')).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
