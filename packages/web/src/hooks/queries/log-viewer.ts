import { useQuery } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';

export interface LogViewerContentParams {
  path: string;
  lines: number;
  hostId?: number;
}

export const logViewerKeys = {
  all: ['log-viewer'] as const,
  content: (params: LogViewerContentParams) => ['log-viewer', 'content', params] as const,
  roots: (hostId?: number) => ['log-viewer', 'roots', hostId ?? null] as const,
};

export function useLogViewerContent(params: LogViewerContentParams, enabled = true) {
  return useQuery({
    queryKey: logViewerKeys.content(params),
    queryFn: () => request.get<{ content: string }>(`/api/log-viewer/content${toQueryString(params)}`).then(unwrap),
    enabled: enabled && !!params.path,
  });
}

/** 服务端允许读取的日志目录白名单（本机为应用日志目录 + LOG_VIEWER_ROOTS，远端为 LOG_VIEWER_ROOTS） */
export function useLogViewerRoots(hostId?: number) {
  return useQuery({
    queryKey: logViewerKeys.roots(hostId),
    queryFn: () => request.get<{ roots: string[] }>(`/api/log-viewer/roots${toQueryString(hostId == null ? {} : { hostId })}`).then(unwrap),
    staleTime: 5 * 60_000,
  });
}
