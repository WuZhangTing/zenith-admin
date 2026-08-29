import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export interface PortEntry {
  protocol: string;
  localAddress: string;
  localPort: number;
  state: string;
  pid: number | null;
  processName: string | null;
  serviceName: string | null;
}

export const portKeys = {
  all: ['ports'] as const,
  lists: ['ports', 'list'] as const,
  list: (hostId: number | null) => ['ports', 'list', hostId] as const,
};

function hostQuery(hostId: number | null): string {
  return hostId == null ? '' : `?hostId=${hostId}`;
}

export function usePortList(refetchInterval: number | false, hostId: number | null = null) {
  return useQuery({
    queryKey: portKeys.list(hostId),
    queryFn: () => request.get<PortEntry[]>(`/api/ports${hostQuery(hostId)}`, { silent: true }).then(unwrap),
    refetchInterval,
  });
}

export function useKillPortProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, hostId = null }: { pid: number; hostId?: number | null }) =>
      request.delete<null>(`/api/ports/${pid}${hostQuery(hostId)}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: portKeys.all }),
  });
}
