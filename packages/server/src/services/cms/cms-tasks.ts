import { registerTaskHandler } from '../../lib/task-center';
import { buildSiteStatic, ensureCmsStaticBuildAccess } from './cms-static.service';
import { rebuildSearchIndex } from './cms-search.service';
import { registerCmsDeadlinkTaskHandler } from './cms-deadlink.service';
import { registerCmsCollectTaskHandler } from './cms-collect.service';
import { isCmsPlatformAdmin } from './cms-access';
import { assertAllCmsSiteChannelsAccess } from './cms-channels.service';
import { registerCmsResourceTaskHandler } from './cms-resource-tasks';
import { registerCmsPublishingTaskHandler } from './cms-publishing.service';
import { registerCmsStage4TaskHandlers } from './cms-stage4-tasks';
import { registerCmsDistributionTaskHandler } from './cms-distributions.service';
import { registerCmsWebhookTaskHandler } from './cms-webhook.service';
import { registerCmsWidgetTaskHandlers } from './cms-widget-tasks';

/** CMS 任务中心 handler 注册（index.ts 启动流程中、registerSystemTasks 之前调用） */
export function registerCmsTaskHandlers(): void {
  registerCmsDeadlinkTaskHandler();
  registerCmsCollectTaskHandler();
  registerCmsResourceTaskHandler();
  registerCmsPublishingTaskHandler();
  registerCmsStage4TaskHandlers();
  registerCmsDistributionTaskHandler();
  registerCmsWebhookTaskHandler();
  registerCmsWidgetTaskHandlers();
  registerTaskHandler({
    taskType: 'cms-static-build',
    title: 'CMS 全站静态化',
    module: 'CMS内容管理',
    allowConcurrent: false,
    maxAttempts: 1,
    async run(ctx) {
      const payload = ctx.payload as { siteId?: number };
      const siteId = Number(payload.siteId);
      if (!siteId) throw new Error('缺少 siteId 参数');
      await ensureCmsStaticBuildAccess(siteId);
      const result = await buildSiteStatic(siteId, async (p) => {
        const { cancelRequested } = await ctx.progress({
          processed: p.processed,
          total: p.total,
          note: p.note,
          checkpoint: { ...p.checkpoint },
        });
        return cancelRequested;
      }, { resumeAfterKey: typeof ctx.checkpoint?.lastKey === 'string' ? ctx.checkpoint.lastKey : null });
      return { pages: result.pages, pruned: result.pruned };
    },
  });

  // 主题代码变更自动重建（cms-theme-watch.service 检测指纹变化后提交）：单任务串行重建多站点
  registerTaskHandler({
    taskType: 'cms-theme-rebuild',
    title: 'CMS 主题变更重建',
    module: 'CMS内容管理',
    allowConcurrent: false,
    maxAttempts: 1,
    async run(ctx) {
      const siteIds = [...new Set(((ctx.payload as { siteIds?: number[] })?.siteIds ?? [])
        .filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
      if (siteIds.length === 0) throw new Error('缺少 siteIds 参数');
      let pages = 0;
      let pruned = 0;
      const lastSiteId = Number(ctx.checkpoint?.lastSiteId ?? 0);
      let completedSiteId = lastSiteId;
      let completed = siteIds.filter((id) => id <= lastSiteId).length;
      for (const siteId of siteIds) {
        if (siteId <= lastSiteId) continue;
        await ensureCmsStaticBuildAccess(siteId);
        const resumeAfterKey = Number(ctx.checkpoint?.currentSiteId) === siteId && typeof ctx.checkpoint?.lastKey === 'string'
          ? ctx.checkpoint.lastKey
          : null;
        const result = await buildSiteStatic(siteId, async (p) => {
          const { cancelRequested } = await ctx.progress({
            processed: completed,
            total: siteIds.length,
            note: `站点 ${completed + 1}/${siteIds.length}：${p.note}`,
            checkpoint: {
              phase: 'legacy-theme-site',
              lastSiteId: completedSiteId,
              currentSiteId: siteId,
              lastKey: p.checkpoint.lastKey,
            },
          });
          return cancelRequested;
        }, { resumeAfterKey });
        pages += result.pages;
        pruned += result.pruned;
        completed += 1;
        completedSiteId = siteId;
        const { cancelRequested } = await ctx.progress({
          processed: completed,
          total: siteIds.length,
          note: `站点 ${completed}/${siteIds.length} 完成`,
          checkpoint: { phase: 'legacy-theme-site', lastSiteId: siteId, currentSiteId: null, lastKey: null },
        });
        if (cancelRequested) return { pages, pruned, sites: completed };
      }
      return { pages, pruned, sites: siteIds.length };
    },
  });

  registerTaskHandler({
    taskType: 'cms-search-reindex',
    title: 'CMS 检索索引重建',
    module: 'CMS内容管理',
    allowConcurrent: false,
    maxAttempts: 1,
    async run(ctx) {
      const payload = ctx.payload as { siteId?: number | null };
      const siteId = payload.siteId ?? null;
      if (siteId) await assertAllCmsSiteChannelsAccess(siteId);
      else if (!isCmsPlatformAdmin()) throw new Error('非平台管理员不可重建全部 CMS 索引');
      const startAfterId = Number(ctx.checkpoint?.lastId ?? 0);
      const processedBefore = Number(ctx.checkpoint?.processed ?? 0);
      const processed = await rebuildSearchIndex({
        siteId,
        startAfterId,
        onProgress: async (batchProcessed, total, lastId) => {
          const { cancelRequested } = await ctx.progress({
            processed: processedBefore + batchProcessed,
            total,
            note: `已重建 ${processedBefore + batchProcessed}/${total} 条`,
            checkpoint: { lastId, processed: processedBefore + batchProcessed },
          });
          return cancelRequested;
        },
      });
      return { processed: processedBefore + processed };
    },
  });
}
