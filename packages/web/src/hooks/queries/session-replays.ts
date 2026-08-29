import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { ReplaySession, ReplaySessionDetail, ReplayStorageStats } from '@zenith/shared/analytics';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface ReplayListParams {
  page: number;
  pageSize: number;
  status?: string;
  mode?: string;
  triggerType?: string;
  keyword?: string;
  hasError?: boolean;
  source?: string;
  pagePath?: string;
  clickLabel?: string;
}

export const replayKeys = {
  all: ['session-replays'] as const,
  lists: ['session-replays', 'list'] as const,
  list: (params: ReplayListParams) => ['session-replays', 'list', params] as const,
  detail: (id: string) => ['session-replays', 'detail', id] as const,
  stats: ['session-replays', 'stats'] as const,
};

/** 存储统计（容量看板） */
export function useReplayStorageStats() {
  return useQuery({
    queryKey: replayKeys.stats,
    queryFn: () => request.get<ReplayStorageStats>('/api/session-replays/stats', { silent: true }).then(unwrap),
    staleTime: 30_000,
  });
}

/** 有点击热力数据的页面清单 */
export function useHeatmapPages(days: number, enabled = true) {
  return useQuery({
    queryKey: ['session-replays', 'heatmap-pages', days] as const,
    queryFn: () => request.get<string[]>(`/api/session-replays/heatmap/pages?days=${days}`).then(unwrap),
    enabled,
    staleTime: 60_000,
  });
}

export interface HeatmapData {
  points: Array<{ x: number; y: number; count: number }>;
  total: number;
}

/** 页面点击热力聚合 */
export function useClickHeatmap(pagePath: string, days: number, enabled = true) {
  return useQuery({
    queryKey: ['session-replays', 'heatmap', pagePath, days] as const,
    queryFn: () => request.get<HeatmapData>(`/api/session-replays/heatmap?pagePath=${encodeURIComponent(pagePath)}&days=${days}`).then(unwrap),
    enabled: enabled && pagePath !== '',
  });
}

export function useReplayList(params: ReplayListParams) {
  return useQuery({
    queryKey: replayKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<ReplaySession>>(`/api/session-replays${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useReplayDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: replayKeys.detail(id ?? ''),
    queryFn: () => request.get<ReplaySessionDetail>(`/api/session-replays/${id}`).then(unwrap),
    enabled: enabled && id !== null,
    // recording 会话自动追流：3s 轮询拿新分片清单，终态停止
    refetchInterval: (query) => (query.state.data?.status === 'recording' ? 3000 : false),
  });
}

export function useBatchDeleteReplays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => request.delete('/api/session-replays/batch', { ids }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: replayKeys.lists });
    },
  });
}

/** 拉取回放分片事件（服务端 gzip 透传，浏览器自动解压） */
export async function fetchReplaySegmentEvents(replayId: string, seq: number): Promise<unknown[]> {
  const blob = await request.getBlob(`/api/session-replays/${replayId}/segments/${seq}/data`);
  if (!blob) return [];
  try {
    const events = JSON.parse(await blob.text()) as unknown[];
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}
