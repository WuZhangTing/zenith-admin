/**
 * CMS 前台页面缓存（dynamic 模式的 Redis HTML 缓存）失效。
 *
 * dynamic 模式下渲染结果按 `cms:page:{siteId}:{path}` 缓存，TTL 按页面类型分级
 * （首页 300s / 列表 180s / 详情 600s）。站点级运营内容（碎片等）改动后若不主动清理，
 * 前台最长要等 10 分钟才变化——「应急公告」「合规文案」这类用法直接不成立。
 */
import redis from '../../lib/redis';
import { config } from '../../config';
import logger from '../../lib/logger';

export const CMS_PAGE_CACHE_PREFIX = `${config.redis.keyPrefix}cms:page:`;

/**
 * 清空指定站点的全部页面缓存。
 *
 * 用 SCAN 分批删除而非 KEYS，避免大 key 空间下阻塞 Redis。
 * 缓存清理失败不应阻断业务写入（最坏结果只是多等一个 TTL），因此仅记录日志。
 */
export async function invalidateCmsSitePageCache(siteId: number): Promise<number> {
  let cursor = '0';
  let removed = 0;
  try {
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${CMS_PAGE_CACHE_PREFIX}${siteId}:*`, 'COUNT', 200);
      cursor = next;
      if (keys.length > 0) {
        await redis.del(...keys);
        removed += keys.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.error(`[cms-page-cache] 站点 #${siteId} 页面缓存清理失败，将等待 TTL 自然过期`, err);
  }
  return removed;
}
