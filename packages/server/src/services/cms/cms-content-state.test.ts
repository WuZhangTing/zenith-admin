import { describe, expect, it } from 'vitest';
import { canTransitionCmsContentStatus, isCmsContentPubliclyVisible } from './cms-content-state';

describe('CMS content state machine', () => {
  it('allows only declared publish lifecycle transitions', () => {
    expect(canTransitionCmsContentStatus('draft', 'submit')).toBe(true);
    expect(canTransitionCmsContentStatus('pending', 'publish')).toBe(true);
    expect(canTransitionCmsContentStatus('published', 'offline')).toBe(true);
    expect(canTransitionCmsContentStatus('pending', 'reject')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionCmsContentStatus('published', 'publish')).toBe(false);
    expect(canTransitionCmsContentStatus('draft', 'offline')).toBe(false);
    expect(canTransitionCmsContentStatus('rejected', 'reject')).toBe(false);
  });

  it('treats expired, archived, deleted and non-published rows as not public', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const base = { status: 'published' as const, deletedAt: null, archivedAt: null, expireAt: null };
    expect(isCmsContentPubliclyVisible(base, now)).toBe(true);
    expect(isCmsContentPubliclyVisible({ ...base, expireAt: new Date('2026-08-31T23:59:59Z') }, now)).toBe(false);
    expect(isCmsContentPubliclyVisible({ ...base, expireAt: now }, now)).toBe(false);
    expect(isCmsContentPubliclyVisible({ ...base, archivedAt: now }, now)).toBe(false);
    expect(isCmsContentPubliclyVisible({ ...base, deletedAt: now }, now)).toBe(false);
    expect(isCmsContentPubliclyVisible({ ...base, status: 'draft' }, now)).toBe(false);
  });
});
