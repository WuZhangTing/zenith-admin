import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChannelAnalysisDimension, ChannelAnalysisResult, EnsureShortLinkInput, ShortLink, ShortLinkStats } from '@zenith/shared/short-link';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface ShortLinkListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  bizType?: string;
  startTime?: string;
  endTime?: string;
}

export const {
  keys: shortLinkKeys,
  useList: useShortLinkList,
  useDetail: useShortLinkDetail,
  useSave: useSaveShortLink,
  useDelete: useDeleteShortLinks,
} = createCrudQueries<ShortLink, ShortLinkListParams, Partial<ShortLink>>({
  resource: 'short-links',
});

/** 批量启用/禁用：影响列表与被操作详情，精确失效两者 */
export function useBatchUpdateShortLinkStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: 'enabled' | 'disabled' }) =>
      request.put<null>('/api/short-links/batch/status', { ids, status }).then(unwrap),
    onSuccess: (_data, { ids }) => {
      void qc.invalidateQueries({ queryKey: shortLinkKeys.lists });
      for (const id of ids) void qc.invalidateQueries({ queryKey: shortLinkKeys.detail(id) });
    },
  });
}

/** 业务对象幂等取短链（payment-link/CMS 等页面嵌入）：可能新建记录，失效列表 */
export function useEnsureShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnsureShortLinkInput) =>
      request.post<ShortLink>('/api/short-links/ensure', input).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: shortLinkKeys.lists });
    },
  });
}

/** 访问统计是昂贵派生查询，单独命名空间，避免被列表增删改连坐失效 */
export const shortLinkStatsKeys = {
  all: ['short-link-stats'] as const,
  stats: (id: number, days: number) => ['short-link-stats', id, { days }] as const,
};

export function useShortLinkStats(id: number | null, days: number) {
  return useQuery({
    queryKey: shortLinkStatsKeys.stats(id ?? 0, days),
    queryFn: () => request.get<ShortLinkStats>(`/api/short-links/${id}/stats${toQueryString({ days })}`).then(unwrap),
    enabled: id !== null,
  });
}

/** 渠道推广分析：独立命名空间的纯读聚合，不与短链列表互相失效 */
export interface ChannelAnalysisParams {
  dimension: ChannelAnalysisDimension;
  days: number;
  convEvent?: string;
}

export const channelAnalysisKeys = {
  all: ['channel-analysis'] as const,
  result: (params: ChannelAnalysisParams) => ['channel-analysis', params] as const,
};

export function useChannelAnalysis(params: ChannelAnalysisParams) {
  return useQuery({
    queryKey: channelAnalysisKeys.result(params),
    queryFn: () => request.get<ChannelAnalysisResult>(`/api/growth/channel-analysis${toQueryString(params)}`).then(unwrap),
  });
}
