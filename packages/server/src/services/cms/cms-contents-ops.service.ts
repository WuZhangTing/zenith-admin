import { eq, and, inArray, isNull, isNotNull, lt, lte, or, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { cmsSites, cmsContents, cmsContentTags, cmsContentTombstones, cmsContentVersions, cmsTags, cmsCollectItems } from '../../db/schema';
import type { CmsContentRow } from '../../db/schema';
import { contentSearchVector } from './cms-search.service';
import { assertChannelAccess, assertChannelsAccess } from './cms-channels.service';
import { logContentOp, logContentOps } from './cms-content-op-logs.service';
import { assertSiteAccess, ensureCmsSiteExists } from './cms-sites.service';
import { hasPermission } from '../../lib/context';
import type { AsyncTask } from '@zenith/shared/tasks';
import { resolveCmsSiteOpsSettings } from './cms-site-settings';
import { assertCompleteCmsBatch } from './cms-access';
import {
  assertCmsContentUnlocked, assertCmsContentsUnlocked, assertNoLockedCmsMappedCopies,
} from './cms-content-lock.service';
import { bumpCmsTemplateRefsRevision, lockCmsSiteForMutation } from './cms-site-publish-lock.service';
import { captureCmsContentPublishSnapshot } from './cms-content-publish-snapshot.service';
import {
  adoptCmsResourcesIntoSite,
  deleteCmsResourceRefsForOwner,
  syncCmsResourceRefs,
} from './cms-resource-refs.service';
import { enqueueCmsPublishOutboxes, insertCmsSiteRefsRebuildOutbox } from './cms-publish-outbox.service';
import logger from '../../lib/logger';
import { sanitizeCmsHtml } from './cms-html-sanitizer';
import { assertCmsWidgetSourcesMutable } from './cms-widgets.service';
import { submitCmsWidgetSourceRefreshSideEffect } from './cms-widget-tasks';
import { enqueueCmsWebhookEvents, insertCmsContentWebhookOutbox } from './cms-webhook.service';
import { insertContentPublishOutbox, recalcTagContentCounts, ensureChannelForContent } from './cms-contents-internal';
import { ensureCmsContentExists, getCmsContent } from './cms-contents-query.service';
import { offlineCmsContent, publishCmsContent, rejectCmsContent, submitCmsContent } from './cms-contents-write.service';

// ─── 回收站 ───────────────────────────────────────────────────────────────────
async function assertBatchSiteAccess(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const unique = [...new Set(ids)];
  await assertCmsContentsUnlocked(unique);
  const rows = await db.select({
    id: cmsContents.id,
    siteId: cmsContents.siteId,
    channelId: cmsContents.channelId,
  }).from(cmsContents).where(inArray(cmsContents.id, unique));
  assertCompleteCmsBatch(unique, rows.map((row) => row.id), '内容');
  for (const siteId of new Set(rows.map((r) => r.siteId))) {
    await assertSiteAccess(siteId);
  }
  await assertChannelsAccess(rows.map((r) => r.channelId));
}

export async function recycleCmsContents(ids: number[]) {
  if (ids.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  await assertCmsWidgetSourcesMutable('content', ids);
  await assertNoLockedCmsMappedCopies(ids);
  const initial = await db.select({ id: cmsContents.id, siteId: cmsContents.siteId }).from(cmsContents)
    .where(and(inArray(cmsContents.id, ids), isNull(cmsContents.deletedAt)));
  const mutation = await db.transaction(async (tx) => {
    const sites = new Map<number, typeof cmsSites.$inferSelect>();
    for (const siteId of [...new Set(initial.map((row) => row.siteId))].sort((a, b) => a - b)) {
      sites.set(siteId, await lockCmsSiteForMutation(tx, siteId));
    }
    const locked = await tx.select().from(cmsContents)
      .where(and(inArray(cmsContents.id, ids), isNull(cmsContents.deletedAt), isNull(cmsContents.lockedAt)))
      .for('update');
    await assertCmsWidgetSourcesMutable('content', locked.map((row) => row.id), tx);
    const oldSnapshots = new Map<number, Awaited<ReturnType<typeof captureCmsContentPublishSnapshot>>>();
    for (const row of locked) {
      oldSnapshots.set(row.id, await captureCmsContentPublishSnapshot(tx, row, { includeExistingArtifacts: true }));
    }
    const rows = await tx.update(cmsContents)
      .set({ deletedAt: new Date(), status: 'offline', version: sql`${cmsContents.version} + 1` })
      .where(and(inArray(cmsContents.id, locked.map((row) => row.id)), isNull(cmsContents.deletedAt), isNull(cmsContents.lockedAt)))
      .returning();
    const refsTasks: AsyncTask[] = [];
    for (const siteId of new Set(rows.filter((row) => row.detailTemplate).map((row) => row.siteId))) {
      const revision = await bumpCmsTemplateRefsRevision(tx, siteId);
      const site = { ...sites.get(siteId)!, templateRefsRevision: revision };
      sites.set(siteId, site);
      refsTasks.push(await insertCmsSiteRefsRebuildOutbox(
        tx,
        site,
        '回收内容模板引用移除',
        `site:${siteId}:refs:${revision}`,
      ));
    }
    await logContentOps(tx, rows.map((row) => ({ id: row.id })), 'recycled');
    const tasks: AsyncTask[] = [];
    const webhookTasks: (AsyncTask | null)[] = [];
    for (const row of rows) {
      tasks.push(await insertContentPublishOutbox(
        tx,
        sites.get(row.siteId)!,
        row,
        'recycle',
        oldSnapshots.get(row.id)?.deletePaths ?? [],
        { build: false },
      ));
      webhookTasks.push(await insertCmsContentWebhookOutbox(tx, 'cms.content.recycled', row));
    }
    return { rows, tasks: [...tasks, ...refsTasks], webhookTasks };
  });
  await enqueueCmsPublishOutboxes(mutation.tasks, '内容批量回收');
  await enqueueCmsWebhookEvents(mutation.webhookTasks);
  for (const row of mutation.rows) {
    void import('./cms-distributions.service')
      .then(({ submitCmsMappingDistributionSideEffects }) => submitCmsMappingDistributionSideEffects(row.id))
      .catch((error) => logger.warn(`[cms-distribution] 内容 #${row.id} 回收后的映射任务提交失败`, error));
  }
  return mutation.rows.length;
}

export async function restoreCmsContents(ids: number[]) {
  if (ids.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  const initial = await db.select({ siteId: cmsContents.siteId }).from(cmsContents).where(inArray(cmsContents.id, ids));
  const mutation = await db.transaction(async (tx) => {
    const sites = new Map<number, typeof cmsSites.$inferSelect>();
    for (const siteId of [...new Set(initial.map((row) => row.siteId))].sort((a, b) => a - b)) {
      sites.set(siteId, await lockCmsSiteForMutation(tx, siteId));
    }
    const rows = await tx.update(cmsContents)
      .set({ deletedAt: null, status: 'draft' })
      .where(and(inArray(cmsContents.id, ids), isNotNull(cmsContents.deletedAt), isNull(cmsContents.lockedAt)))
      .returning();
    const tasks: AsyncTask[] = [];
    for (const siteId of new Set(rows.filter((row) => row.detailTemplate).map((row) => row.siteId))) {
      const revision = await bumpCmsTemplateRefsRevision(tx, siteId);
      tasks.push(await insertCmsSiteRefsRebuildOutbox(
        tx,
        { ...sites.get(siteId)!, templateRefsRevision: revision },
        '恢复内容模板引用',
        `site:${siteId}:refs:${revision}`,
      ));
    }
    await logContentOps(tx, rows.map((row) => ({ id: row.id })), 'restored');
    return { count: rows.length, tasks };
  });
  await enqueueCmsPublishOutboxes(mutation.tasks, '内容恢复');
  return mutation.count;
}

/** 彻底删除（仅限回收站中的内容）；被映射引用的正文先物化到映射行，避免映射内容失源 */
export async function purgeCmsContents(ids: number[], options?: { skipAccessCheck?: boolean }) {
  if (ids.length === 0) return 0;
  if (options?.skipAccessCheck) await assertCmsContentsUnlocked(ids);
  else await assertBatchSiteAccess(ids);
  await assertCmsWidgetSourcesMutable('content', ids);
  const targets = await db.select().from(cmsContents)
    .where(and(inArray(cmsContents.id, ids), isNotNull(cmsContents.deletedAt), isNull(cmsContents.lockedAt)));
  if (targets.length === 0) return 0;
  const targetIds = targets.map((t) => t.id);
  const mutation = await db.transaction(async (tx) => {
    const sites = new Map<number, typeof cmsSites.$inferSelect>();
    for (const siteId of [...new Set(targets.map((row) => row.siteId))].sort((a, b) => a - b)) {
      sites.set(siteId, await lockCmsSiteForMutation(tx, siteId));
    }
    const lockedTargets = await tx.select().from(cmsContents).where(and(
      inArray(cmsContents.id, targetIds),
      isNotNull(cmsContents.deletedAt),
      isNull(cmsContents.lockedAt),
    )).for('update');
    await assertCmsWidgetSourcesMutable('content', lockedTargets.map((row) => row.id), tx);
    const captured = new Map<number, Awaited<ReturnType<typeof captureCmsContentPublishSnapshot>>>();
    for (const row of lockedTargets) {
      captured.set(row.id, await captureCmsContentPublishSnapshot(tx, row, { includeExistingArtifacts: true }));
    }
    const lockedIds = lockedTargets.map((row) => row.id);
    if (lockedIds.length === 0) return { count: 0, tasks: [] as AsyncTask[], webhookTasks: [] as (AsyncTask | null)[] };
    // 物化：把被删来源的正文/扩展字段拷回映射行，映射行转为独立内容
    const mappedRows = await tx.select({ id: cmsContents.id, mappingSourceId: cmsContents.mappingSourceId, lockedAt: cmsContents.lockedAt, lockReason: cmsContents.lockReason })
      .from(cmsContents).where(inArray(cmsContents.mappingSourceId, lockedIds));
    const lockedMapped = mappedRows.find((row) => row.lockedAt);
    if (lockedMapped) throw new HTTPException(423, { message: `映射内容 #${lockedMapped.id} 已被持久锁定${lockedMapped.lockReason ? `：${lockedMapped.lockReason}` : ''}` });
    if (mappedRows.length > 0) {
      const sourceIds = [...new Set(mappedRows.map((m) => m.mappingSourceId!))];
      const sources = await tx.select({ id: cmsContents.id, body: cmsContents.body, extend: cmsContents.extend })
        .from(cmsContents).where(inArray(cmsContents.id, sourceIds));
      const srcById = new Map(sources.map((s) => [s.id, s]));
      for (const m of mappedRows) {
        const src = srcById.get(m.mappingSourceId!);
        const [materialized] = await tx.update(cmsContents)
          .set({ body: sanitizeCmsHtml(src?.body), extend: src?.extend ?? {}, mappingSourceId: null })
          .where(eq(cmsContents.id, m.id))
          .returning();
        // 物化后正文由本行自己持有，素材引用要从来源转移到映射行，否则来源删除后素材变孤立
        if (materialized) {
          await syncCmsResourceRefs(tx, 'content', materialized.id, materialized.siteId, materialized);
        }
      }
    }
    await tx.update(cmsCollectItems)
      .set({ contentId: null })
      .where(inArray(cmsCollectItems.contentId, lockedIds));
    const tagRows = await tx.select({ tagId: cmsContentTags.tagId }).from(cmsContentTags)
      .where(inArray(cmsContentTags.contentId, lockedIds));
    // 版本行随内容级联删除，但引用索引不是外键关系，需显式清理，否则素材永远判不出孤立
    const versionIds = await tx.select({ id: cmsContentVersions.id }).from(cmsContentVersions)
      .where(inArray(cmsContentVersions.contentId, lockedIds));
    await deleteCmsResourceRefsForOwner(tx, 'contentVersion', versionIds.map((row) => row.id));
    await deleteCmsResourceRefsForOwner(tx, 'content', lockedIds);
    // 墓碑：硬删除后行本身消失，Headless 增量同步只能靠它输出 op=delete，
    // 否则客户端按 updated_at 游标永远拉不到这条变更，本地缓存会残留已删内容
    await tx.insert(cmsContentTombstones)
      .values(lockedTargets.map((row) => ({ siteId: row.siteId, contentId: row.id })))
      .onConflictDoNothing();
    await tx.delete(cmsContents).where(inArray(cmsContents.id, lockedIds));
    await recalcTagContentCounts(tx, tagRows.map((t) => t.tagId));
    const refsTasks: AsyncTask[] = [];
    for (const siteId of new Set(lockedTargets.filter((row) => row.detailTemplate).map((row) => row.siteId))) {
      const revision = await bumpCmsTemplateRefsRevision(tx, siteId);
      const site = { ...sites.get(siteId)!, templateRefsRevision: revision };
      sites.set(siteId, site);
      refsTasks.push(await insertCmsSiteRefsRebuildOutbox(
        tx,
        site,
        '彻底删除内容模板引用',
        `site:${siteId}:refs:${revision}`,
      ));
    }
    const tasks: AsyncTask[] = [];
    const webhookTasks: (AsyncTask | null)[] = [];
    for (const row of lockedTargets) {
      const old = captured.get(row.id)!;
      tasks.push(await insertContentPublishOutbox(
        tx,
        sites.get(row.siteId)!,
        row,
        'purge',
        old.deletePaths,
        { build: false, purged: true, snapshot: old.snapshot },
      ));
      webhookTasks.push(await insertCmsContentWebhookOutbox(tx, 'cms.content.deleted', row));
    }
    return { count: lockedIds.length, tasks: [...tasks, ...refsTasks], webhookTasks };
  });
  await enqueueCmsPublishOutboxes(mutation.tasks, '内容彻底删除');
  await enqueueCmsWebhookEvents(mutation.webhookTasks);
  return mutation.count;
}

// ─── 归档（前台详情保留，不参与列表聚合；仅已发布/已下线内容可归档）──────────────
async function setCmsContentsArchived(ids: number[], archived: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  if (archived) {
    await assertNoLockedCmsMappedCopies(ids);
  }
  const initial = await db.select().from(cmsContents).where(inArray(cmsContents.id, ids));
  const mutation = await db.transaction(async (tx) => {
    const sites = new Map<number, typeof cmsSites.$inferSelect>();
    for (const siteId of [...new Set(initial.map((row) => row.siteId))].sort((a, b) => a - b)) {
      sites.set(siteId, await lockCmsSiteForMutation(tx, siteId));
    }
    const archivedCondition = archived ? isNull(cmsContents.archivedAt) : isNotNull(cmsContents.archivedAt);
    const locked = await tx.select().from(cmsContents).where(and(
      inArray(cmsContents.id, ids),
      isNull(cmsContents.deletedAt),
      archivedCondition,
      isNull(cmsContents.lockedAt),
      ...(archived ? [inArray(cmsContents.status, ['published', 'offline'])] : []),
    )).for('update');
    if (!locked.length) return { rows: [] as CmsContentRow[], tasks: [] as AsyncTask[] };
    const oldSnapshots = new Map<number, Awaited<ReturnType<typeof captureCmsContentPublishSnapshot>>>();
    for (const row of locked.filter((item) => item.status === 'published')) {
      oldSnapshots.set(row.id, await captureCmsContentPublishSnapshot(tx, row, { includeExistingArtifacts: true }));
    }
    const rows = await tx.update(cmsContents)
      .set({ archivedAt: archived ? new Date() : null, version: sql`${cmsContents.version} + 1` })
      .where(inArray(cmsContents.id, locked.map((row) => row.id)))
      .returning();
    await logContentOps(tx, rows.map((row) => ({ id: row.id })), archived ? 'archived' : 'unarchived');
    const tasks: AsyncTask[] = [];
    for (const row of rows.filter((item) => oldSnapshots.has(item.id))) {
      tasks.push(await insertContentPublishOutbox(
        tx,
        sites.get(row.siteId)!,
        row,
        archived ? 'archive' : 'unarchive',
        oldSnapshots.get(row.id)!.deletePaths,
        { build: true },
      ));
    }
    return { rows, tasks };
  });
  await enqueueCmsPublishOutboxes(mutation.tasks, archived ? '内容归档' : '内容取消归档');
  for (const row of mutation.rows) {
    void import('./cms-distributions.service')
      .then(({ submitCmsMappingDistributionSideEffects }) => submitCmsMappingDistributionSideEffects(row.id))
      .catch((error) => logger.warn(`[cms-distribution] 内容 #${row.id} 归档状态变更后的映射任务提交失败`, error));
  }
  return mutation.rows.length;
}

export async function archiveCmsContents(ids: number[]) {
  return setCmsContentsArchived(ids, true);
}

export async function unarchiveCmsContents(ids: number[]) {
  return setCmsContentsArchived(ids, false);
}

export function canAutoOfflineCmsContent(
  row: Pick<CmsContentRow, 'status' | 'expireAt' | 'deletedAt' | 'lockedAt'>,
  now: Date,
): boolean {
  return row.status === 'published'
    && row.expireAt !== null
    && row.expireAt.getTime() <= now.getTime()
    && row.deletedAt === null
    && row.lockedAt === null;
}

/** 过期下线：被已发布页面部件引用的内容保持线上，并显式返回阻塞清单供调度日志告警。 */
export async function offlineExpiredCmsContents(now = new Date()): Promise<{ offlined: number[]; blocked: number[] }> {
  const rows = await db.select({ id: cmsContents.id }).from(cmsContents).where(and(
      isNotNull(cmsContents.expireAt),
      lte(cmsContents.expireAt, now),
      eq(cmsContents.status, 'published'),
      isNull(cmsContents.deletedAt),
      isNull(cmsContents.lockedAt),
    ));
  const completed: number[] = [];
  const blocked: number[] = [];
  for (const row of rows) {
    try {
      await offlineCmsContent(row.id, { skipAccessCheck: true, expireAtBefore: now });
      completed.push(row.id);
    } catch (error) {
      if (!(error instanceof HTTPException) || error.status !== 409) throw error;
      blocked.push(row.id);
      logger.warn(`[CMS] 内容 #${row.id} 已到期但下线被阻止：${error.message}`);
    }
  }
  return { offlined: completed, blocked };
}

/** 置顶到期自动取消：topExpireAt 到期的置顶内容取消置顶；返回受影响内容 id（供静态刷新） */
export async function cancelExpiredTopContents(now = new Date()): Promise<number[]> {
  const initial = await db.select().from(cmsContents).where(and(
      eq(cmsContents.isTop, true),
      isNotNull(cmsContents.topExpireAt),
      lte(cmsContents.topExpireAt, now),
      isNull(cmsContents.deletedAt),
      isNull(cmsContents.lockedAt),
    ));
  if (!initial.length) return [];
  const mutation = await db.transaction(async (tx) => {
    const sites = new Map<number, typeof cmsSites.$inferSelect>();
    for (const siteId of [...new Set(initial.map((row) => row.siteId))].sort((a, b) => a - b)) {
      sites.set(siteId, await lockCmsSiteForMutation(tx, siteId));
    }
    const locked = await tx.select().from(cmsContents).where(and(
      inArray(cmsContents.id, initial.map((row) => row.id)),
      eq(cmsContents.isTop, true),
      isNotNull(cmsContents.topExpireAt),
      lte(cmsContents.topExpireAt, now),
      isNull(cmsContents.deletedAt),
      isNull(cmsContents.lockedAt),
    )).for('update');
    if (!locked.length) return { rows: [] as CmsContentRow[], tasks: [] as AsyncTask[] };
    const oldSnapshots = new Map<number, Awaited<ReturnType<typeof captureCmsContentPublishSnapshot>>>();
    for (const row of locked.filter((item) => item.status === 'published')) {
      oldSnapshots.set(row.id, await captureCmsContentPublishSnapshot(tx, row, { includeExistingArtifacts: true }));
    }
    const rows = await tx.update(cmsContents)
      .set({ isTop: false, topWeight: 0, topExpireAt: null, version: sql`${cmsContents.version} + 1` })
      .where(inArray(cmsContents.id, locked.map((row) => row.id)))
      .returning();
    await logContentOps(tx, rows.map((row) => ({ id: row.id })), 'updated', '置顶到期自动取消');
    const tasks: AsyncTask[] = [];
    for (const row of rows.filter((item) => oldSnapshots.has(item.id))) {
      tasks.push(await insertContentPublishOutbox(
        tx,
        sites.get(row.siteId)!,
        row,
        'top-expired',
        oldSnapshots.get(row.id)!.deletePaths,
        { build: true },
      ));
    }
    return { rows, tasks };
  });
  await enqueueCmsPublishOutboxes(mutation.tasks, '内容置顶到期');
  return mutation.rows.map((row) => row.id);
}

// ═══ P3 Batch1 ════════════════════════════════════════════════════════════════

/** 批量移动栏目（目标须为本站点列表栏目；重算 modelId；事务保证读写一致） */
export async function batchMoveCmsContents(ids: number[], channelId: number): Promise<number> {
  if (ids.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  await assertChannelAccess(channelId);
  const mutation = await db.transaction(async (tx) => {
    const rows = await tx.select().from(cmsContents).where(inArray(cmsContents.id, ids));
    assertCompleteCmsBatch(ids, rows.map((row) => row.id), '内容');
    const siteIds = new Set(rows.map((r) => r.siteId));
    if (siteIds.size > 1) throw new HTTPException(400, { message: '仅支持同站点内容批量移动' });
    const siteId = [...siteIds][0];
    if (siteId === undefined) return 0;
    let site = await lockCmsSiteForMutation(tx, siteId);
    const oldSnapshots = new Map<number, Awaited<ReturnType<typeof captureCmsContentPublishSnapshot>>>();
    for (const row of rows.filter((item) => item.status === 'published')) {
      oldSnapshots.set(row.id, await captureCmsContentPublishSnapshot(tx, row, { includeExistingArtifacts: true }));
    }
    const channel = await ensureChannelForContent(siteId, channelId);
    const updated = await tx.update(cmsContents)
      .set({ channelId, modelId: channel.modelId ?? null, version: sql`${cmsContents.version} + 1` })
      .where(and(inArray(cmsContents.id, rows.map((r) => r.id)), isNull(cmsContents.lockedAt)))
      .returning();
    const revision = await bumpCmsTemplateRefsRevision(tx, siteId);
    site = { ...site, templateRefsRevision: revision };
    await logContentOps(tx, updated.map((row) => ({ id: row.id })), 'moved', `移动到栏目「${channel.name}」`);
    const tasks: AsyncTask[] = [];
    for (const row of updated.filter((item) => oldSnapshots.has(item.id))) {
      const old = oldSnapshots.get(row.id)!;
      tasks.push(await insertContentPublishOutbox(tx, site, row, 'move', old.deletePaths, {
        build: true,
        refreshChannelIds: [old.snapshot.channelId, row.channelId],
      }));
    }
    tasks.push(await insertCmsSiteRefsRebuildOutbox(
      tx,
      site,
      '内容跨栏目模板继承更新',
      `site:${siteId}:refs:${revision}`,
    ));
    return { count: updated.length, tasks };
  });
  if (typeof mutation === 'number') return mutation;
  await enqueueCmsPublishOutboxes(mutation.tasks, '内容批量移动');
  submitCmsWidgetSourceRefreshSideEffect('content', ids);
  return mutation.count;
}

/** 批量设置属性（置顶/推荐/热门，仅更新传入的字段） */
export async function batchSetCmsContentFlags(ids: number[], flags: { isTop?: boolean; isRecommend?: boolean; isHot?: boolean; isOriginal?: boolean }): Promise<number> {
  if (ids.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  const patch: Record<string, boolean> = {};
  if (flags.isTop !== undefined) patch.isTop = flags.isTop;
  if (flags.isRecommend !== undefined) patch.isRecommend = flags.isRecommend;
  if (flags.isHot !== undefined) patch.isHot = flags.isHot;
  if (flags.isOriginal !== undefined) patch.isOriginal = flags.isOriginal;
  if (Object.keys(patch).length === 0) return 0;
  const updated = await db.update(cmsContents).set(patch)
    .where(and(inArray(cmsContents.id, ids), isNull(cmsContents.deletedAt), isNull(cmsContents.lockedAt)))
    .returning({ id: cmsContents.id });
  return updated.length;
}

/** 批量状态操作的动作 → 所需权限（与单条操作一致） */
const CMS_BATCH_STATUS_PERMISSIONS: Record<'submit' | 'publish' | 'reject' | 'offline', string> = {
  submit: 'cms:content:update',
  publish: 'cms:content:publish',
  offline: 'cms:content:publish',
  reject: 'cms:content:audit',
};

/**
 * 批量状态流转（提审/发布/驳回/下线）。
 * 逐条复用单内容管道（各自独立事务与状态机校验），返回部分成功明细，
 * 单条失败不中断整批。
 */
export async function batchTransitionCmsContents(
  ids: number[],
  action: 'submit' | 'publish' | 'reject' | 'offline',
  reason?: string,
): Promise<{ okIds: number[]; failed: { id: number; reason: string }[] }> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { okIds: [], failed: [] };
  if (!(await hasPermission(CMS_BATCH_STATUS_PERMISSIONS[action]))) {
    throw new HTTPException(403, { message: '权限不足' });
  }
  const okIds: number[] = [];
  const failed: { id: number; reason: string }[] = [];
  for (const id of unique) {
    try {
      if (action === 'submit') await submitCmsContent(id);
      else if (action === 'publish') await publishCmsContent(id);
      else if (action === 'reject') await rejectCmsContent(id, reason?.trim() || '批量驳回');
      else await offlineCmsContent(id);
      okIds.push(id);
    } catch (err) {
      const message = err instanceof HTTPException ? err.message : '操作失败';
      failed.push({ id, reason: message });
      if (!(err instanceof HTTPException)) logger.warn(`[cms] 批量${action} 内容 #${id} 失败`, err);
    }
  }
  return { okIds, failed };
}

/** 单条批量 INSERT 的最大行数（每行 2 个绑定参数，远低于 PG 的 65535 上限） */
const TAG_BINDING_CHUNK = 5000;

/** 批量追加标签（跳过已存在的绑定，重算计数） */
export async function batchAddCmsContentTags(ids: number[], tagIds: number[]): Promise<number> {
  if (ids.length === 0 || tagIds.length === 0) return 0;
  await assertBatchSiteAccess(ids);
  const rows = await db.select({
    id: cmsContents.id,
    siteId: cmsContents.siteId,
  }).from(cmsContents).where(inArray(cmsContents.id, ids));
  assertCompleteCmsBatch(ids, rows.map((row) => row.id), '内容');
  await db.transaction(async (tx) => {
    // 合法标签只取决于内容所属站点，批量内容通常同站；一次按站点取回，
    // 替代「每条内容重查一遍同一批标签」
    const siteIds = [...new Set(rows.map((row) => row.siteId))];
    const tagRows = await tx.select({ id: cmsTags.id, siteId: cmsTags.siteId }).from(cmsTags)
      .where(and(inArray(cmsTags.id, tagIds), inArray(cmsTags.siteId, siteIds)));
    const tagIdsBySite = new Map<number, number[]>();
    for (const tag of tagRows) {
      const list = tagIdsBySite.get(tag.siteId);
      if (list) list.push(tag.id);
      else tagIdsBySite.set(tag.siteId, [tag.id]);
    }
    // 校验口径不变：标签必须在该内容所属站点下全部存在，缺一即整批 404
    for (const siteId of siteIds) {
      assertCompleteCmsBatch(tagIds, tagIdsBySite.get(siteId) ?? [], '标签');
    }
    const bindings = rows.flatMap((row) => (tagIdsBySite.get(row.siteId) ?? []).map((tagId) => ({ contentId: row.id, tagId })));
    // 分片插入：单条语句每行 2 个绑定参数，而 ids / tagIds 在路由 schema 上没有上限，
    // 内容数 × 标签数很容易越过 PG 的 65535 参数上限
    for (let i = 0; i < bindings.length; i += TAG_BINDING_CHUNK) {
      await tx.insert(cmsContentTags).values(bindings.slice(i, i + TAG_BINDING_CHUNK)).onConflictDoNothing();
    }
    await recalcTagContentCounts(tx, tagIds);
  });
  return rows.length;
}

/**
 * 复制内容为草稿（标题加后缀，slug / staticPath 置空避免唯一冲突，标签一并复制）。
 * `targetChannelId` 可指定复制到**本站其他栏目**（跨站复制走 distributeCmsContents）。
 */
export async function duplicateCmsContent(id: number, targetChannelId?: number) {
  const current = await ensureCmsContentExists(id);
  await assertSiteAccess(current.siteId);
  await assertChannelAccess(current.channelId);
  assertCmsContentUnlocked(current);
  // 目标栏目：默认原栏目；指定时校验属于同站点、可投放且有写权限
  let channelId = current.channelId;
  let modelId = current.modelId;
  if (targetChannelId !== undefined && targetChannelId !== current.channelId) {
    await assertChannelAccess(targetChannelId);
    const target = await ensureChannelForContent(current.siteId, targetChannelId);
    channelId = target.id;
    // 换栏目即换模型：扩展字段按目标栏目模型重新解释，避免残留异构字段
    modelId = target.modelId ?? null;
  }
  const tagRows = await db.select({ tagId: cmsContentTags.tagId }).from(cmsContentTags).where(and(
    eq(cmsContentTags.contentId, id),
  ));
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(cmsContents).values({
      siteId: current.siteId,
      channelId,
      modelId,
      contentType: current.contentType,
      mediaData: current.mediaData ?? {},
      title: `${current.title}（副本）`.slice(0, 255),
      titleStyle: current.titleStyle ?? {},
      subTitle: current.subTitle,
      shortTitle: current.shortTitle,
      slug: null,
      staticPath: null,
      summary: current.summary,
      coverImage: current.coverImage,
      author: current.author,
      editor: current.editor,
      source: current.source,
      sourceUrl: current.sourceUrl,
      isOriginal: current.isOriginal,
      body: current.body,
      attachments: current.attachments ?? [],
      extend: current.extend ?? {},
      externalLink: current.externalLink,
      isTop: false,
      isRecommend: current.isRecommend,
      isHot: current.isHot,
      status: 'draft',
      sort: current.sort,
      seoTitle: current.seoTitle,
      seoKeywords: current.seoKeywords,
      seoDescription: current.seoDescription,
      searchVector: contentSearchVector(current.siteId, { ...current, title: `${current.title}（副本）` }),
    }).returning();
    if (tagRows.length > 0) {
      await tx.insert(cmsContentTags).values(tagRows.map((t) => ({
        contentId: created.id,
        tagId: t.tagId,
      })));
      await recalcTagContentCounts(tx, tagRows.map((t) => t.tagId));
    }
    await logContentOp(tx, created.id, 'created', channelId === current.channelId
      ? `复制自内容 #${current.id}`
      : `复制自内容 #${current.id}（跨栏目）`);
    await syncCmsResourceRefs(tx, 'content', created.id, created.siteId, created);
    return created;
  });
  return getCmsContent(row.id);
}

/**
 * 站群内容分发：把内容分发到目标站点栏目（草稿，标签不跨站复制；事务保证全部成功或回滚）。
 * - copy（独立复制，默认）：完整拷贝正文/扩展字段，分发后独立编辑，仅在操作日志记录来源
 * - mapping（映射）：仅拷贝标题等元数据，正文/扩展字段运行时透传来源内容，源改动即时生效；
 *   映射行禁止独立编辑正文；来源被彻底删除时自动物化为独立内容
 */
export async function distributeCmsContents(ids: number[], targetSiteId: number, targetChannelId: number, mode: 'copy' | 'mapping' = 'copy'): Promise<number> {
  if (ids.length === 0) return 0;
  if (!(await hasPermission('cms:distribution:run')) || !(await hasPermission('cms:content:create'))) {
    throw new HTTPException(403, { message: '内容分发需要 cms:distribution:run 与 cms:content:create 权限' });
  }
  await assertBatchSiteAccess(ids);
  await assertSiteAccess(targetSiteId);
  await assertChannelAccess(targetChannelId);
  await ensureCmsSiteExists(targetSiteId);
  const channel = await ensureChannelForContent(targetSiteId, targetChannelId);
  const rows = await db.select().from(cmsContents).where(inArray(cmsContents.id, ids));
  assertCompleteCmsBatch(ids, rows.map((row) => row.id), '内容');
  const disallowed = rows.find((row) => row.status !== 'published' || row.deletedAt || row.archivedAt);
  if (disallowed) {
    throw new HTTPException(400, { message: `内容 #${disallowed.id} 不是可分发的已发布内容` });
  }
  return db.transaction(async (tx) => {
    let copied = 0;
    for (const current of rows) {
      if (current.siteId === targetSiteId) continue; // 同站分发无意义，跳过
      // 映射的映射仍指向原始来源，避免形成解析链
      const mappingSourceId = mode === 'mapping' ? (current.mappingSourceId ?? current.id) : null;
      // 跨站复制：素材登记到目标站并改写句柄，避免来源站删除后目标站整片断图
      const media = await adoptCmsResourcesIntoSite(tx, targetSiteId, {
        coverImage: current.coverImage,
        mediaData: current.mediaData ?? {},
        body: mode === 'mapping' ? null : sanitizeCmsHtml(current.body),
        extend: mode === 'mapping' ? {} : (current.extend ?? {}),
        externalLink: current.externalLink,
        sourceUrl: current.sourceUrl,
      });
      const [created] = await tx.insert(cmsContents).values({
        siteId: targetSiteId,
        channelId: targetChannelId,
        modelId: channel.modelId ?? null,
        contentType: current.contentType,
        mediaData: media.mediaData,
        title: current.title,
        subTitle: current.subTitle,
        shortTitle: current.shortTitle,
        slug: null,
        summary: current.summary,
        coverImage: media.coverImage,
        author: current.author,
        editor: current.editor,
        source: current.source,
        sourceUrl: media.sourceUrl,
        isOriginal: current.isOriginal,
        body: media.body,
        extend: media.extend,
        externalLink: media.externalLink,
        mappingSourceId,
        status: 'draft',
        seoTitle: current.seoTitle,
        seoKeywords: current.seoKeywords,
        seoDescription: current.seoDescription,
        // 映射行也按来源正文建检索向量，站内搜索可命中
        searchVector: contentSearchVector(targetSiteId, current),
      }).returning();
      await logContentOp(tx, created.id, 'created', mode === 'mapping' ? `映射自内容 #${current.id}` : `站群分发复制自内容 #${current.id}`);
      await syncCmsResourceRefs(tx, 'content', created.id, created.siteId, created);
      copied += 1;
    }
    return copied;
  });
}

/**
 * 回收站自动清理：按各站点的 `settings.recycleKeepDays` 彻底删除超期内容（系统周期任务调用）。
 * `recycleKeepDays = 0` 表示该站点永久保留，跳过清理。
 */
export async function cleanupCmsRecycleBin(): Promise<number> {
  const sites = await db.select({ id: cmsSites.id, settings: cmsSites.settings }).from(cmsSites);
  const now = Date.now();
  // 按保留天数分组：站点绝大多数沿用同一份默认配置，分组后通常只剩一条 OR 分支，
  // 替代「每个站点各扫一次回收站」
  const siteIdsByKeepDays = new Map<number, number[]>();
  for (const site of sites) {
    const keepDays = resolveCmsSiteOpsSettings(site.settings).recycleKeepDays;
    if (keepDays <= 0) continue;
    const list = siteIdsByKeepDays.get(keepDays);
    if (list) list.push(site.id);
    else siteIdsByKeepDays.set(keepDays, [site.id]);
  }
  if (siteIdsByKeepDays.size === 0) return 0;
  const expiredInGroup = [...siteIdsByKeepDays].map(([keepDays, siteIds]) => and(
    inArray(cmsContents.siteId, siteIds),
    lt(cmsContents.deletedAt, new Date(now - keepDays * 24 * 60 * 60 * 1000)),
  ));
  const rows = await db.select({ id: cmsContents.id }).from(cmsContents).where(and(
    isNotNull(cmsContents.deletedAt),
    isNull(cmsContents.lockedAt),
    or(...expiredInGroup),
  ));
  if (rows.length === 0) return 0;
  return purgeCmsContents(rows.map((r) => r.id), { skipAccessCheck: true });
}
