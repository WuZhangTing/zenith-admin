import { describe, expect, it } from 'vitest';
import { hasPageComponent, lazyPageComponent } from './page-registry';

describe('page registry', () => {
  it('reuses the same lazy component identity across parent rerenders', () => {
    const first = lazyPageComponent('users/UsersPage');
    const second = lazyPageComponent('/users/UsersPage.tsx');

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('returns null for unknown page components', () => {
    expect(hasPageComponent('missing/UnknownPage')).toBe(false);
    expect(lazyPageComponent('missing/UnknownPage')).toBeNull();
  });
});
