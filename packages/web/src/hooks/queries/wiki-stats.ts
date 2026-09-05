import { wikiSettingsContract, wikiStatsContract, type WikiSettings } from '@zenith/shared/wiki';
import { useApiMutation, useApiQuery } from '@/lib/contract-query';
import { wikiDocDetailPrefix } from './wiki-docs';
import { wikiGovernanceKeys, wikiSettingsKey, wikiStatsKeys } from './wiki-query-keys';

export { wikiSettingsKey, wikiStatsKeys } from './wiki-query-keys';

export function useWikiStatsOverview() {
  return useApiQuery(wikiStatsContract.overview);
}

export function useWikiHotDocs(limit = 10) {
  return useApiQuery(wikiStatsContract.hotDocs, { query: { limit } });
}

export function useWikiContributors(limit = 10) {
  return useApiQuery(wikiStatsContract.contributors, { query: { limit } });
}

export function useWikiStaleDocs(limit = 10) {
  return useApiQuery(wikiStatsContract.staleDocs, { query: { limit } });
}

export function useWikiOpsStats() {
  return useApiQuery(wikiStatsContract.ops);
}

export function useWikiSettings() {
  return useApiQuery(wikiSettingsContract.get);
}

/**
 * 保存设置：响应即最新设置，直接回填缓存；只有真正变化的开关才波及其消费者——
 * 评论开关影响文档详情的 commentsEnabled，审核积压时限影响治理「审核积压」清单与运营统计。
 */
export function useUpdateWikiSettings() {
  return useApiMutation(wikiSettingsContract.update, {
    invalidate: (qc, saved) => {
      const previous = qc.getQueryData<WikiSettings>(wikiSettingsKey);
      qc.setQueryData(wikiSettingsKey, saved);
      if (previous?.commentsEnabled !== saved.commentsEnabled) {
        void qc.invalidateQueries({ queryKey: wikiDocDetailPrefix });
      }
      if (previous?.pendingRemindHours !== saved.pendingRemindHours) {
        void qc.invalidateQueries({ queryKey: wikiGovernanceKeys.lists });
        void qc.invalidateQueries({ queryKey: wikiStatsKeys.ops });
      }
    },
  });
}
