import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LicenseEventItem, LicenseInfo, LicenseEffectiveState, LicenseInstallationInfo } from '@zenith/shared/licensing';
import { request } from '@/utils/request';
import { unwrap, toQueryString } from '@/lib/query';
import type { PaginatedResponse } from '@zenith/shared/core';

export interface LicensingStatusData {
  installation: LicenseInstallationInfo;
  license: LicenseInfo | null;
  effective: LicenseEffectiveState;
  usingTestKey: boolean;
}

export const licensingKeys = {
  all: ['licensing'] as const,
  status: ['licensing', 'status'] as const,
  events: ['licensing', 'events'] as const,
  eventList: (params: { page: number; pageSize: number }) => ['licensing', 'events', params] as const,
};

export function useLicensingStatus() {
  return useQuery({
    queryKey: licensingKeys.status,
    queryFn: () => request.get<LicensingStatusData>('/api/licensing/status').then(unwrap),
  });
}

export function useLicenseEvents(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: licensingKeys.eventList(params),
    queryFn: () => request.get<PaginatedResponse<LicenseEventItem>>(`/api/licensing/events${toQueryString(params)}`).then(unwrap),
    placeholderData: (prev) => prev,
  });
}

/** 激活成功后整域失效：状态、事件都会变化 */
export function useActivateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: string) => request.post<LicenseInfo>('/api/licensing/activate', { envelope }).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: licensingKeys.all });
    },
  });
}

export function useDeactivateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request.post<null>('/api/licensing/deactivate').then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: licensingKeys.all });
    },
  });
}
