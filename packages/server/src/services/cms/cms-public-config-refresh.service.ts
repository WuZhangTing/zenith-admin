import { randomUUID } from 'node:crypto';
import logger from '../../lib/logger';
import { db } from '../../db';
import { cmsSites } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { enqueueCmsPublishOutboxes, insertCmsPublishOutbox } from './cms-publish-outbox.service';
import { acquireCmsSitePublishLock, cmsSiteFencePayload } from './cms-site-publish-lock.service';

/** Public configuration is embedded in every rendered page; refresh site-wide. */
export async function refreshCmsPublicConfiguration(
  siteId: number,
  reason: string,
  eventKey: string,
): Promise<void> {
  // The caller's key is descriptive (usually an updatedAt timestamp), not a
  // durable idempotency token.  A mutation can legitimately happen twice in
  // one millisecond, so every committed mutation gets its own event nonce.
  const mutationEventKey = `${eventKey}:${randomUUID()}`;
  // Revision and outbox insertion are atomic; retry transient DB failures so
  // a post-commit configuration mutation still gets a durable refresh event.
  let task: Awaited<ReturnType<typeof insertCmsPublishOutbox>> | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3 && !task; attempt += 1) {
    try {
      task = await db.transaction(async (tx) => {
        await acquireCmsSitePublishLock(tx, siteId);
        const [site] = await tx.select().from(cmsSites).where(eq(cmsSites.id, siteId)).for('update').limit(1);
        if (!site) throw new Error(`CMS site #${siteId} does not exist`);
        return insertCmsPublishOutbox(tx, {
          siteId,
          targetType: 'site',
          ...await cmsSiteFencePayload(tx, site),
          reason,
        }, `public-config:${siteId}:${mutationEventKey}`);
      });
    } catch (error) {
      lastError = error;
      logger.warn(`[CMS] ${reason} 后站点发布任务提交失败 site=${siteId} attempt=${attempt}`, error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  if (!task) {
    logger.error(`[CMS] ${reason} 公开刷新任务最终提交失败 site=${siteId}`);
    throw lastError instanceof Error ? lastError : new Error(`[CMS] ${reason} 公开刷新任务提交失败`);
  }
  await enqueueCmsPublishOutboxes([task], reason);
}
