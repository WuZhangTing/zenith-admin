import { describe, expect, it } from 'vitest';
import { buildCmsContentSnapshotTargets } from './cms-content-publish-snapshot.service';

const channels = [
  { id: 1, siteId: 1, name: 'PC', code: 'pc', domain: null, uaRegex: null, isDefault: true },
  { id: 2, siteId: 1, name: 'H5', code: 'h5', domain: null, uaRegex: null, isDefault: false },
];

const AT = new Date(2026, 6, 5);
const content = (overrides: Record<string, unknown> = {}) => ({
  id: 7, slug: null, staticPath: null, publishedAt: AT, createdAt: AT, ...overrides,
} as Parameters<typeof buildCmsContentSnapshotTargets>[0]);

describe('CMS immutable content path snapshots', () => {
  it('retains old slug, channel and all prior body pages for deletion', () => {
    const oldTargets = buildCmsContentSnapshotTargets(
      content({ slug: 'old-slug' }), { path: 'old-channel', detailPathRule: 'none' }, 3, channels);
    const nextTargets = buildCmsContentSnapshotTargets(
      content({ slug: 'new-slug' }), { path: 'new-channel', detailPathRule: 'none' }, 1, channels);
    expect(oldTargets.flatMap((target) => target.paths)).toEqual([
      'old-channel/old-slug.html',
      'old-channel/old-slug_2.html',
      'old-channel/old-slug_3.html',
      '__h5/old-channel/old-slug.html',
      '__h5/old-channel/old-slug_2.html',
      '__h5/old-channel/old-slug_3.html',
    ]);
    expect(nextTargets.flatMap((target) => target.paths)).toEqual([
      'new-channel/new-slug.html',
      '__h5/new-channel/new-slug.html',
    ]);
  });

  it('captures archived directories so rule-based paths are also cleaned up', () => {
    const targets = buildCmsContentSnapshotTargets(
      content({ slug: 'hello' }), { path: 'news', detailPathRule: 'year' }, 2, channels);
    expect(targets.flatMap((target) => target.paths)).toEqual([
      'news/2026/hello.html',
      'news/2026/hello_2.html',
      '__h5/news/2026/hello.html',
      '__h5/news/2026/hello_2.html',
    ]);
  });

  it('honours custom staticPath over the channel archive rule', () => {
    const targets = buildCmsContentSnapshotTargets(
      content({ staticPath: 'topic/special.html' }), { path: 'news', detailPathRule: 'date' }, 1, channels);
    expect(targets.flatMap((target) => target.paths)).toEqual([
      'topic/special.html',
      '__h5/topic/special.html',
    ]);
  });
});
