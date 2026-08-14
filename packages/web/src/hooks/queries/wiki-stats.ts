import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UpdateWikiSettingsInput,
  WikiContributor,
  WikiHotDoc,
  WikiOpsStats,
  WikiSettings,
  WikiStaleDoc,
  WikiStatsOverview,
} from '@zenith/shared/wiki';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';
import { wikiDocDetailPrefix } from './wiki-docs';
import { wikiGovernanceKeys, wikiSettingsKey, wikiStatsKeys } from './wiki-query-keys';

export { wikiSettingsKey, wikiStatsKeys } from './wiki-query-keys';

export function useWikiStatsOverview() {
  return useQuery({
    queryKey: wikiStatsKeys.overview,
    queryFn: () => request.get<WikiStatsOverview>('/api/wiki/stats/overview').then(unwrap),
  });
}

export function useWikiHotDocs(limit = 10) {
  return useQuery({
    queryKey: [...wikiStatsKeys.hotDocs, limit],
    queryFn: () => request.get<WikiHotDoc[]>(`/api/wiki/stats/hot-docs?limit=${limit}`).then(unwrap),
  });
}

export function useWikiContributors(limit = 10) {
  return useQuery({
    queryKey: [...wikiStatsKeys.contributors, limit],
    queryFn: () => request.get<WikiContributor[]>(`/api/wiki/stats/contributors?limit=${limit}`).then(unwrap),
  });
}

export function useWikiStaleDocs(limit = 10) {
  return useQuery({
    queryKey: [...wikiStatsKeys.staleDocs, limit],
    queryFn: () => request.get<WikiStaleDoc[]>(`/api/wiki/stats/stale-docs?limit=${limit}`).then(unwrap),
  });
}

export function useWikiOpsStats() {
  return useQuery({
    queryKey: wikiStatsKeys.ops,
    queryFn: () => request.get<WikiOpsStats>('/api/wiki/stats/ops').then(unwrap),
  });
}

export function useWikiSettings() {
  return useQuery({
    queryKey: wikiSettingsKey,
    queryFn: () => request.get<WikiSettings>('/api/wiki/settings').then(unwrap),
  });
}

export function useUpdateWikiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateWikiSettingsInput) =>
      request.put<WikiSettings>('/api/wiki/settings', data).then(unwrap),
    onSuccess: (saved) => {
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
