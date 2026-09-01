import { config } from '../../config';
import redis from '../../lib/redis';
import logger from '../../lib/logger';

const PAGE_CACHE_PREFIX = `${config.redis.keyPrefix}cms:page:`;
const META_CACHE_PREFIX = `${config.redis.keyPrefix}cms:sitemap:`;

function pageKey(siteId: number, path: string): string {
  return `${PAGE_CACHE_PREFIX}${siteId}:${path.replace(/^\/+/, '')}`;
}

async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '500');
    cursor = String(next);
    if (Array.isArray(batch)) keys.push(...batch.map(String));
  } while (cursor !== '0');
  return keys;
}

/**
 * Invalidate all public CMS cache variants for a site.
 *
 * Static file generation and cache invalidation are separate concerns: dynamic
 * sites still need this call, and metadata endpoints share the same invalidation
 * boundary as HTML pages. Redis failures are logged and never make a committed
 * content mutation fail.
 */
export async function invalidateCmsSiteCaches(siteId: number, paths: readonly string[] = []): Promise<void> {
  if (!Number.isInteger(siteId) || siteId <= 0) return;
  try {
    const exact = paths.map((path) => pageKey(siteId, path));
    const [pageKeys, metaKeys] = await Promise.all([
      scanKeys(`${PAGE_CACHE_PREFIX}${siteId}:*`),
      scanKeys(`${META_CACHE_PREFIX}${siteId}*`),
    ]);
    const keys = [...new Set([...exact, ...pageKeys, ...metaKeys])];
    if (keys.length > 0) await redis.del(...keys);
  } catch (error) {
    logger.warn(`[CMS] 站点 ${siteId} 缓存失效失败`, error);
  }
}
