import { and, eq, inArray } from 'drizzle-orm';
import type { AsyncTask, CmsWidgetSourceType } from '@zenith/shared';
import { db } from '../../db';
import { cmsWidgetRefs } from '../../db/schema';
import { config } from '../../config';
import redis from '../../lib/redis';
import logger from '../../lib/logger';
import { currentUserOrNull, runWithCurrentUser } from '../../lib/context';
import { hasPermission } from '../../lib/context';
import {
  mapAsyncTask,
  registerTaskHandler,
  submitAsyncTask,
} from '../../lib/task-center';
import { customPagePath } from './cms-urls';
import {
  refreshCustomPageStatic,
  refreshHomeStatic,
} from './cms-static.service';
import { triggerCdnPurge } from './cms-cdn.service';
import {
  deleteCmsWidget,
  findPublishedWidgetIdsAffectedByChannels,
  findPublishedWidgetIdsBySource,
  listCmsWidgetUsageTargets,
  offlineCmsWidget,
  publishCmsWidget,
} from './cms-widgets.service';
import { resolveEffectiveCmsSiteRow } from './cms-site-inheritance.service';

const SYSTEM_USER = { userId: 1, username: 'admin', roles: ['super_admin'], tenantId: null };
const PAGE_CACHE_PREFIX = `${config.redis.keyPrefix}cms:page:`;

async function clearCmsPageCache(siteId: number, paths: readonly string[]): Promise<void> {
  const keys = [...new Set(paths)].map((path) => `${PAGE_CACHE_PREFIX}${siteId}:${path}`);
  if (keys.length > 0) await redis.del(...keys).catch((error) => {
    logger.warn(`[CMS] 页面部件 Redis 页面缓存清理失败: ${error instanceof Error ? error.message : error}`);
  });
}

export async function refreshCmsWidgetTargets(
  widgetIds: number[],
  homeSiteIds: number[] = [],
  onProgress?: (processed: number, total: number, note: string) => Promise<boolean>,
): Promise<{ pages: number; homes: number }> {
  const { refs, pages, sites } = await listCmsWidgetUsageTargets(widgetIds);
  const pageRefIds = new Set(refs.filter((ref) => ref.ownerType === 'page').map((ref) => ref.ownerId));
  const targetPages = pages.filter((page) => pageRefIds.has(page.id) && page.status === 'enabled');
  const targetHomeSiteIds = new Set([
    ...homeSiteIds,
    ...refs.filter((ref) => ref.ownerType === 'theme_slot' && ref.field === 'home.sidebar').map((ref) => ref.siteId),
    ...targetPages.filter((page) => page.isHome).map((page) => page.siteId),
  ]);
  const siteById = new Map(sites.map((site) => [site.id, site]));
  for (const siteId of targetHomeSiteIds) {
    if (!siteById.has(siteId)) {
      const site = await resolveEffectiveCmsSiteRow(siteId).catch(() => null);
      if (site) siteById.set(siteId, site);
    }
  }

  const total = targetPages.length + targetHomeSiteIds.size;
  let processed = 0;
  let refreshedPages = 0;
  let refreshedHomes = 0;
  for (const page of targetPages) {
    const site = await resolveEffectiveCmsSiteRow(page.siteId).catch(() => null);
    if (!site) continue;
    await refreshCustomPageStatic({
      siteId: page.siteId,
      slug: page.slug,
      isHome: page.isHome,
    });
    const paths = [customPagePath(page), ...(page.isHome ? ['', 'index.html'] : [])];
    await clearCmsPageCache(page.siteId, paths);
    if (site.staticMode === 'dynamic') triggerCdnPurge(site, paths);
    refreshedPages += 1;
    processed += 1;
    if (await onProgress?.(processed, total, `已刷新页面 ${processed}/${total}`)) {
      return { pages: refreshedPages, homes: refreshedHomes };
    }
  }

  for (const siteId of targetHomeSiteIds) {
    const site = siteById.get(siteId) ?? await resolveEffectiveCmsSiteRow(siteId).catch(() => null);
    if (!site) continue;
    if (site.staticMode !== 'dynamic') await refreshHomeStatic(site);
    await clearCmsPageCache(siteId, ['', 'index.html']);
    triggerCdnPurge(site, ['']);
    refreshedHomes += 1;
    processed += 1;
    if (await onProgress?.(processed, total, `已刷新首页 ${processed}/${total}`)) {
      return { pages: refreshedPages, homes: refreshedHomes };
    }
  }
  return { pages: refreshedPages, homes: refreshedHomes };
}

async function submitRefreshTask(
  input: { widgetIds?: number[]; homeSiteIds?: number[] },
  options?: { enqueue?: boolean },
): Promise<AsyncTask | null> {
  const widgetIds = [...new Set(input.widgetIds ?? [])].filter((id) => Number.isInteger(id) && id > 0);
  const homeSiteIds = [...new Set(input.homeSiteIds ?? [])].filter((id) => Number.isInteger(id) && id > 0);
  if (widgetIds.length === 0 && homeSiteIds.length === 0) return null;
  const row = await submitAsyncTask({
    taskType: 'cms-widget-refresh',
    title: 'CMS 页面部件引用刷新',
    payload: { widgetIds, homeSiteIds },
    idempotencyKey: null,
  }, { enqueue: options?.enqueue });
  return mapAsyncTask(row);
}

export function submitCmsWidgetRefreshSideEffect(input: { widgetIds?: number[]; homeSiteIds?: number[] }): void {
  const actor = currentUserOrNull() ?? SYSTEM_USER;
  void runWithCurrentUser(actor, () => submitRefreshTask(input))
    .catch((error) => logger.error('[CMS] 页面部件引用刷新任务提交失败', error));
}

export function submitCmsWidgetSourceRefreshSideEffect(
  sourceType: Exclude<CmsWidgetSourceType, 'manual'>,
  sourceIds: number[],
): void {
  const actor = currentUserOrNull() ?? SYSTEM_USER;
  void runWithCurrentUser(actor, async () => {
    const widgetIds = await findPublishedWidgetIdsBySource(sourceType, sourceIds);
    await submitRefreshTask({ widgetIds });
  }).catch((error) => logger.error('[CMS] 页面部件实时来源刷新任务提交失败', error));
}

export function submitCmsWidgetChannelRefreshSideEffect(channelIds: number[]): void {
  const actor = currentUserOrNull() ?? SYSTEM_USER;
  void runWithCurrentUser(actor, async () => {
    const widgetIds = await findPublishedWidgetIdsAffectedByChannels(channelIds);
    await submitRefreshTask({ widgetIds });
  }).catch((error) => logger.error('[CMS] 页面部件栏目来源刷新任务提交失败', error));
}

export async function submitCmsWidgetBatchTask(input: {
  ids: number[];
  action: 'publish' | 'offline' | 'delete';
}) {
  const permission = `cms:widget:${input.action}`;
  if (!(await hasPermission(permission))) {
    throw new Error(`缺少 ${permission} 权限`);
  }
  const row = await submitAsyncTask({
    taskType: 'cms-widget-batch',
    title: `页面部件批量${input.action === 'publish' ? '发布' : input.action === 'offline' ? '下线' : '删除'}`,
    payload: {
      ids: [...new Set(input.ids)].sort((a, b) => a - b),
      action: input.action,
    },
    idempotencyKey: null,
  });
  return mapAsyncTask(row);
}

export function registerCmsWidgetTaskHandlers(): void {
  registerTaskHandler({
    taskType: 'cms-widget-refresh',
    title: 'CMS 页面部件引用刷新',
    module: 'CMS内容管理',
    description: '按页面部件反向引用定向刷新搭建页面、首页、Redis 页面缓存与 CDN。',
    allowConcurrent: true,
    maxAttempts: 3,
    retryDelayMs: 5000,
    async run(ctx) {
      const payload = ctx.payload as { widgetIds?: number[]; homeSiteIds?: number[] };
      return refreshCmsWidgetTargets(
        payload.widgetIds ?? [],
        payload.homeSiteIds ?? [],
        async (processed, total, note) => {
          const state = await ctx.progress({ processed, total, note, checkpoint: { processed } });
          return state.cancelRequested;
        },
      );
    },
  });

  registerTaskHandler({
    taskType: 'cms-widget-batch',
    title: 'CMS 页面部件批量操作',
    module: 'CMS内容管理',
    allowConcurrent: false,
    maxAttempts: 1,
    async run(ctx) {
      const payload = ctx.payload as { ids?: number[]; action?: 'publish' | 'offline' | 'delete' };
      const ids = [...new Set(payload.ids ?? [])].sort((a, b) => a - b);
      const action = payload.action;
      if (!action || ids.length === 0) throw new Error('缺少页面部件批量操作参数');
      const permission = `cms:widget:${action}`;
      if (!(await hasPermission(permission))) throw new Error(`任务创建者缺少 ${permission} 权限`);
      let processed = Number(ctx.checkpoint?.processed ?? 0);
      let succeeded = Number(ctx.checkpoint?.succeeded ?? 0);
      const changedIds: number[] = [];
      for (let index = processed; index < ids.length; index++) {
        const id = ids[index];
        try {
          if (action === 'publish') {
            await publishCmsWidget(id, { suppressRefresh: true });
            changedIds.push(id);
          } else if (action === 'offline') {
            await offlineCmsWidget(id, { suppressRefresh: true });
            changedIds.push(id);
          } else {
            await deleteCmsWidget(id);
          }
          succeeded += 1;
          await ctx.reportItems([{ key: `widget-${id}`, label: `页面部件 #${id}`, status: 'success', message: null }]);
        } catch (error) {
          await ctx.reportItems([{
            key: `widget-${id}`,
            label: `页面部件 #${id}`,
            status: 'failed',
            message: error instanceof Error ? error.message.slice(0, 200) : '操作失败',
          }]);
        }
        processed = index + 1;
        const state = await ctx.progress({
          processed,
          total: ids.length,
          failed: processed - succeeded,
          note: `已处理 ${processed}/${ids.length}`,
          checkpoint: { processed, succeeded },
        });
        if (state.cancelRequested) return { processed, succeeded };
      }
      if (changedIds.length > 0) await refreshCmsWidgetTargets(changedIds);
      return { processed, succeeded, failed: processed - succeeded };
    },
  });
}

export async function removeStaleCmsPageWidgetRefs(pageIds: number[]): Promise<void> {
  if (pageIds.length === 0) return;
  await db.delete(cmsWidgetRefs).where(and(
    eq(cmsWidgetRefs.ownerType, 'page'),
    inArray(cmsWidgetRefs.ownerId, pageIds),
  ));
}
