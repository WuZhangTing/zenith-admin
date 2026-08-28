import { useQuery } from '@tanstack/react-query';
import type { TraceTimeline } from '@zenith/shared/platform';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const traceKeys = {
  all: ['trace'] as const,
  of: (traceId: string) => ['trace', traceId] as const,
};

/** 链路时间线（纯读；traceId 为空时不请求） */
export function useTraceTimeline(traceId: string | null) {
  return useQuery({
    queryKey: traceKeys.of(traceId ?? ''),
    queryFn: () => request.get<TraceTimeline>(`/api/trace/${encodeURIComponent(traceId!)}`).then(unwrap),
    enabled: Boolean(traceId),
  });
}
