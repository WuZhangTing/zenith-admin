import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export interface ServiceInfo {
  name: string;
  description: string;
  loadState: string;
  activeState: string;
  subState: string;
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'enable' | 'disable' | 'mask' | 'unmask';

export const serviceKeys = {
  all: ['services'] as const,
  lists: ['services', 'list'] as const,
  list: (hostId: number | null) => ['services', 'list', hostId] as const,
  logs: (name: string | undefined, hostId: number | null) => ['services', 'logs', hostId, name] as const,
};

function hostQuery(hostId: number | null): string {
  return hostId == null ? '' : `?hostId=${hostId}`;
}

export function useServiceList(hostId: number | null = null) {
  return useQuery({
    queryKey: serviceKeys.list(hostId),
    queryFn: async () => {
      const check = await request.get<{ available: boolean }>(`/api/systemd/check${hostQuery(hostId)}`, { silent: true }).then(unwrap);
      if (!check.available) return { available: false, services: [] as ServiceInfo[] };
      const services = await request.get<ServiceInfo[]>(`/api/systemd/${hostQuery(hostId)}`).then(unwrap);
      return { available: true, services };
    },
  });
}

export function useServiceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, action, hostId = null }: { name: string; action: ServiceAction; hostId?: number | null }) =>
      request.post<null>(`/api/systemd/${name}/${action}${hostQuery(hostId)}`, {}).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: serviceKeys.all }),
  });
}

export function useServiceLogs() {
  return useMutation({
    mutationFn: ({ name, hostId = null }: { name: string; hostId?: number | null }) =>
      request.get<{ logs: string }>(`/api/systemd/${name}/logs${hostQuery(hostId)}`).then(unwrap),
  });
}
