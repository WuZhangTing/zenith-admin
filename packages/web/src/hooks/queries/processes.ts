import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProcessInfo, ProcessListResponse } from '@zenith/shared/ops';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const processKeys = {
  all: ['processes'] as const,
  list: (hostId: number | null) => ['processes', 'list', hostId] as const,
  detail: (pid: number | undefined, hostId: number | null) => ['processes', 'detail', hostId, pid] as const,
};

function hostQuery(hostId: number | null): string {
  return hostId == null ? '' : `?hostId=${hostId}`;
}

export function useProcessList(hostId: number | null, enabled = true) {
  return useQuery({
    queryKey: processKeys.list(hostId),
    queryFn: () => request.get<ProcessListResponse>(`/api/processes${hostQuery(hostId)}`, { silent: true }).then(unwrap),
    enabled,
    refetchInterval: hostId == null ? false : 5000,
  });
}

export function useProcessDetail(pid: number | undefined, enabled = true, hostId: number | null = null) {
  return useQuery({
    queryKey: processKeys.detail(pid, hostId),
    queryFn: () => request.get<ProcessInfo>(`/api/processes/${pid}${hostQuery(hostId)}`).then(unwrap),
    enabled: enabled && pid !== undefined,
  });
}

export function useKillProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, signal, hostId = null }: { pid: number; signal: string; hostId?: number | null }) =>
      request.delete<null>(`/api/processes/${pid}${hostQuery(hostId)}`, { signal }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
  });
}

export function useSetProcessPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, values, hostId = null }: { pid: number; values: Record<string, unknown>; hostId?: number | null }) =>
      request.put<null>(`/api/processes/${pid}/priority${hostQuery(hostId)}`, values).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: processKeys.all }),
  });
}
