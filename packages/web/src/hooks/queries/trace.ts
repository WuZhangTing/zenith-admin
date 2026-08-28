import { useQuery } from '@tanstack/react-query';
import type { TraceFailureEntry, TraceNodeKind, TraceTimeline } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export const traceKeys = {
  all: ['trace'] as const,
  of: (traceId: string) => ['trace', traceId] as const,
  failures: (params: { days: number; kind: string }) => ['trace', 'failures', params] as const,
};

/** 链路时间线（纯读；traceId 为空时不请求） */
export function useTraceTimeline(traceId: string | null) {
  return useQuery({
    queryKey: traceKeys.of(traceId ?? ''),
    queryFn: () => request.get<TraceTimeline>(`/api/trace/${encodeURIComponent(traceId!)}`).then(unwrap),
    enabled: Boolean(traceId),
  });
}

/** 最近失败链路（排障入口） */
export function useRecentTraceFailures(days: number, kind: TraceNodeKind | '', enabled = true) {
  return useQuery({
    queryKey: traceKeys.failures({ days, kind }),
    queryFn: () => request.get<TraceFailureEntry[]>(`/api/trace/recent-failures${toQueryString({ days, kind: kind || undefined })}`).then(unwrap),
    enabled,
  });
}
