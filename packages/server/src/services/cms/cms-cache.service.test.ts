import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({
  incr: vi.fn(),
  scan: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../lib/redis', () => ({ default: redis }));

import { invalidateCmsSiteCaches } from './cms-cache.service';

describe('CMS public cache invalidation', () => {
  beforeEach(() => {
    redis.scan.mockReset();
    redis.incr.mockReset().mockResolvedValue(1);
    redis.del.mockReset().mockResolvedValue(3);
    redis.scan
      .mockResolvedValueOnce(['0', ['cms:page:3:/']])
      .mockResolvedValueOnce(['0', ['cms:sitemap:3']])
      .mockResolvedValueOnce(['0', ['cms:sitemap:rss:3:news']]);
  });

  it('clears page and metadata variants for the site', async () => {
    await invalidateCmsSiteCaches(3, ['news/1.html']);

    expect(redis.scan).toHaveBeenCalledTimes(3);
    expect(redis.del).toHaveBeenCalledOnce();
    const keys = redis.del.mock.calls[0] as string[];
    expect(keys.some((key) => key.includes('cms:page:3:news/1.html'))).toBe(true);
    expect(keys).toContain('cms:page:3:/');
    expect(keys).toContain('cms:sitemap:3');
    expect(keys).toContain('cms:sitemap:rss:3:news');
  });

  it('does not reject a committed mutation when Redis is unavailable', async () => {
    redis.scan.mockReset().mockRejectedValue(new Error('redis unavailable'));
    await expect(invalidateCmsSiteCaches(3)).resolves.toBeUndefined();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
