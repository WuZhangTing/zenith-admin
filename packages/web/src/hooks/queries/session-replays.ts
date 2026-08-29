import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { ReplaySession, ReplaySessionDetail } from '@zenith/shared/analytics';
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
}

export const replayKeys = {
  all: ['session-replays'] as const,
  lists: ['session-replays', 'list'] as const,
  list: (params: ReplayListParams) => ['session-replays', 'list', params] as const,
  detail: (id: string) => ['session-replays', 'detail', id] as const,
};

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
