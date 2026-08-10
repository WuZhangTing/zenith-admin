import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RetentionPolicy, RetentionPreview, UpdateRetentionPolicyInput } from '@zenith/shared/ops';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export const retentionKeys = {
  all: ['retention-policies'] as const,
  list: ['retention-policies', 'list'] as const,
  preview: (key: string) => ['retention-policies', 'preview', key] as const,
};

export function useRetentionPolicies() {
  return useQuery({
    queryKey: retentionKeys.list,
    queryFn: () => request.get<RetentionPolicy[]>('/api/retention-policies').then(unwrap),
  });
}

export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: string; input: UpdateRetentionPolicyInput }) =>
      request.put<RetentionPolicy>(`/api/retention-policies/${key}`, input).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: retentionKeys.all }),
  });
}

export function useRetentionPreview() {
  return useMutation({
    mutationFn: (key: string) =>
      request.get<RetentionPreview>(`/api/retention-policies/${key}/preview`).then(unwrap),
  });
}

export function useRunRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      request.post<{ key: string; deleted: number }>(`/api/retention-policies/${key}/run`).then(unwrap),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: retentionKeys.all }),
  });
}
