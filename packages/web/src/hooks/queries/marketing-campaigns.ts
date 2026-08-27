import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MarketingCampaign, MarketingParticipation, MarketingPrize, SaveMarketingPrizeInput } from '@zenith/shared/marketing';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';

export interface MarketingCampaignListParams extends CrudListParams {
  keyword?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
}

export const {
  keys: marketingCampaignKeys,
  useList: useMarketingCampaignList,
  useDetail: useMarketingCampaignDetail,
  useSave: useSaveMarketingCampaign,
  useDelete: useDeleteMarketingCampaigns,
} = createCrudQueries<MarketingCampaign, MarketingCampaignListParams, Partial<MarketingCampaign>>({
  resource: 'marketing-campaigns',
  path: '/api/marketing/campaigns',
  deleteMode: 'single',
});

/** 发布/结束：状态与统计都变化，失效列表与详情 */
function useLifecycleMutation(action: 'publish' | 'end') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<MarketingCampaign>(`/api/marketing/campaigns/${id}/${action}`, {}).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: marketingCampaignKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: marketingCampaignKeys.lists });
    },
  });
}

export function usePublishMarketingCampaign() {
  return useLifecycleMutation('publish');
}

export function useEndMarketingCampaign() {
  return useLifecycleMutation('end');
}

/** 奖品是独立生命周期的子资源，另起命名空间，避免被活动列表失效连坐 */
export const marketingPrizeKeys = {
  all: ['marketing-prizes'] as const,
  of: (campaignId: number) => ['marketing-prizes', campaignId] as const,
};

export function useMarketingPrizes(campaignId: number | null) {
  return useQuery({
    queryKey: marketingPrizeKeys.of(campaignId ?? 0),
    queryFn: () => request.get<MarketingPrize[]>(`/api/marketing/campaigns/${campaignId}/prizes`).then(unwrap),
    enabled: campaignId !== null,
  });
}

/** 保存奖品：只影响该活动的奖品列表（活动列表不展示奖品数） */
export function useSaveMarketingPrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, prizeId, values }: { campaignId: number; prizeId: number | null; values: SaveMarketingPrizeInput }) =>
      (prizeId === null
        ? request.post<MarketingPrize>(`/api/marketing/campaigns/${campaignId}/prizes`, values)
        : request.put<MarketingPrize>(`/api/marketing/campaigns/${campaignId}/prizes/${prizeId}`, values)
      ).then(unwrap),
    onSuccess: (_saved, { campaignId }) => {
      void qc.invalidateQueries({ queryKey: marketingPrizeKeys.of(campaignId) });
    },
  });
}

export function useDeleteMarketingPrize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, prizeId }: { campaignId: number; prizeId: number }) =>
      request.delete<null>(`/api/marketing/campaigns/${campaignId}/prizes/${prizeId}`).then(unwrap),
    onSuccess: (_data, { campaignId }) => {
      void qc.invalidateQueries({ queryKey: marketingPrizeKeys.of(campaignId) });
    },
  });
}

/** 参与记录：纯读分页，独立命名空间 */
export interface MarketingParticipationParams extends CrudListParams {
  wonOnly?: boolean;
}

export const marketingParticipationKeys = {
  all: ['marketing-participations'] as const,
  of: (campaignId: number, params: MarketingParticipationParams) => ['marketing-participations', campaignId, params] as const,
};

export function useMarketingParticipations(campaignId: number | null, params: MarketingParticipationParams) {
  return useQuery({
    queryKey: marketingParticipationKeys.of(campaignId ?? 0, params),
    queryFn: () => request.get<{ list: MarketingParticipation[]; total: number; page: number; pageSize: number }>(
      `/api/marketing/campaigns/${campaignId}/participations${toQueryString(params)}`,
    ).then(unwrap),
    enabled: campaignId !== null,
  });
}
