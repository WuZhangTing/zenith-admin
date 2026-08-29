import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOpsHostInput, OpsHost, UpdateOpsHostInput } from '@zenith/shared/ops';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const opsHostKeys = {
  all: ['ops-hosts'] as const,
  list: ['ops-hosts', 'list'] as const,
  detail: (id: number) => ['ops-hosts', 'detail', id] as const,
};

export function useOpsHosts(enabled = true) {
  return useQuery({
    queryKey: opsHostKeys.list,
    queryFn: () => request.get<OpsHost[]>('/api/ops-hosts').then(unwrap),
    enabled,
  });
}

export function useOpsHost(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: opsHostKeys.detail(id ?? 0),
    queryFn: () => request.get<OpsHost>(`/api/ops-hosts/${id}`).then(unwrap),
    enabled: enabled && id != null,
  });
}

export function useSaveOpsHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: number; values: CreateOpsHostInput | UpdateOpsHostInput }) =>
      (input.id
        ? request.put<OpsHost>(`/api/ops-hosts/${input.id}`, input.values)
        : request.post<OpsHost>('/api/ops-hosts', input.values)).then(unwrap),
    onSuccess: (saved) => {
      qc.setQueryData(opsHostKeys.detail(saved.id), saved);
      void qc.invalidateQueries({ queryKey: opsHostKeys.list });
    },
  });
}

export function useDeleteOpsHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete(`/api/ops-hosts/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: opsHostKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: opsHostKeys.list });
    },
  });
}

export function useTestOpsHost() {
  return useMutation({
    mutationFn: (id: number) =>
      request.post<{ ok: boolean; message: string; latencyMs: number | null }>(
        `/api/ops-hosts/${id}/test`,
      ).then(unwrap),
  });
}

export function useProbeOpsHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post<OpsHost>(`/api/ops-hosts/${id}/probe`).then(unwrap),
    onSuccess: (saved) => {
      qc.setQueryData(opsHostKeys.detail(saved.id), saved);
      void qc.invalidateQueries({ queryKey: opsHostKeys.list });
    },
  });
}

export function useProbeAllOpsHosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<OpsHost[]>('/api/ops-hosts/probe-all').then(unwrap),
    onSuccess: (list) => qc.setQueryData(opsHostKeys.list, list),
  });
}

export function useResetOpsHostKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.post(`/api/ops-hosts/${id}/reset-host-key`).then(unwrap),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: opsHostKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: opsHostKeys.list });
    },
  });
}

export function useImportOpsHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profileId: number) =>
      request.post<OpsHost>(`/api/ops-hosts/import-ssh-profile/${profileId}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsHostKeys.list }),
  });
}
