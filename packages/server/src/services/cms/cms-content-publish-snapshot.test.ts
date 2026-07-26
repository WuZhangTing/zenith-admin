import { describe, expect, it } from 'vitest';
import { buildCmsContentSnapshotPaths } from './cms-content-publish-snapshot.service';

const AT = new Date(2026, 6, 5);
const content = (overrides: Record<string, unknown> = {}) => ({
  id: 7, slug: null, staticPath: null, publishedAt: AT, createdAt: AT, ...overrides,
} as Parameters<typeof buildCmsContentSnapshotPaths>[0]);

describe('CMS immutable content path snapshots', () => {
  it('retains old slug, channel and all prior body pages for deletion', () => {
    const oldPaths = buildCmsContentSnapshotPaths(
      content({ slug: 'old-slug' }), { path: 'old-channel', detailPathRule: 'none' }, 3);
    const nextPaths = buildCmsContentSnapshotPaths(
      content({ slug: 'new-slug' }), { path: 'new-channel', detailPathRule: 'none' }, 1);
    expect(oldPaths).toEqual([
      'old-channel/old-slug.html',
      'old-channel/old-slug_2.html',
      'old-channel/old-slug_3.html',
    ]);
    expect(nextPaths).toEqual(['new-channel/new-slug.html']);
  });

  it('captures archived directories so rule-based paths are also cleaned up', () => {
    expect(buildCmsContentSnapshotPaths(
      content({ slug: 'hello' }), { path: 'news', detailPathRule: 'year' }, 2,
    )).toEqual([
      'news/2026/hello.html',
      'news/2026/hello_2.html',
    ]);
  });

  it('honours custom staticPath over the channel archive rule', () => {
    expect(buildCmsContentSnapshotPaths(
      content({ staticPath: 'topic/special.html' }), { path: 'news', detailPathRule: 'date' }, 1,
    )).toEqual(['topic/special.html']);
  });
});
