import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { SystemConfig } from '@zenith/shared/platform';
import { LOOKUP_STALE_TIME, toQueryString, unwrap } from '@/lib/query';
import { request } from '@/utils/request';
import type { PasswordPolicy } from '@/utils/password-policy';

export interface SystemConfigListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  configType?: string;
}

export const systemConfigKeys = {
  all: ['system-configs'] as const,
  lists: ['system-configs', 'list'] as const,
  list: (params: SystemConfigListParams) => ['system-configs', 'list', params] as const,
  detail: (id: number | undefined) => ['system-configs', 'detail', id] as const,
  passwordPolicy: ['system-configs', 'password-policy'] as const,
  publicPrefix: ['system-configs', 'public'] as const,
  publicConfig: (key: string) => ['system-configs', 'public', key] as const,
};

export function useSystemConfigList(params: SystemConfigListParams) {
  return useQuery({
    queryKey: systemConfigKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<SystemConfig>>(`/api/system-configs${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useSystemConfigDetail(id: number | undefined, enabled = true) {
  return useQuery({
    queryKey: systemConfigKeys.detail(id),
    queryFn: () => request.get<SystemConfig>(`/api/system-configs/${id}`).then(unwrap),
    enabled: enabled && id !== undefined,
  });
}

export function useSaveSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: number; values: Partial<SystemConfig> }) =>
      (id === undefined
        ? request.post<SystemConfig>('/api/system-configs', values)
        : request.put<SystemConfig>(`/api/system-configs/${id}`, values)
      ).then(unwrap),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: systemConfigKeys.detail(saved.id) });
      void qc.invalidateQueries({ queryKey: systemConfigKeys.lists });
      // 密码策略与公开配置都是从同一张配置表派生出来的读视图，改任一条配置都可能影响它们
      void qc.invalidateQueries({ queryKey: systemConfigKeys.passwordPolicy });
      void qc.invalidateQueries({ queryKey: systemConfigKeys.publicPrefix });
    },
  });
}

export function useDeleteSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/system-configs/${id}`).then(unwrap),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: systemConfigKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: systemConfigKeys.lists });
      void qc.invalidateQueries({ queryKey: systemConfigKeys.passwordPolicy });
      void qc.invalidateQueries({ queryKey: systemConfigKeys.publicPrefix });
    },
  });
}

export function useSystemPasswordPolicy() {
  return useQuery({
    queryKey: systemConfigKeys.passwordPolicy,
    queryFn: () => request.get<PasswordPolicy>('/api/system-configs/password-policy').then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export interface PublicConfig {
  configKey: string;
  configValue: string | null;
  configType: 'string' | 'number' | 'boolean' | 'json';
}

/** 公开读取单项系统配置（无需权限，用于全局开关类配置） */
export function usePublicConfig(key: string) {
  return useQuery({
    queryKey: systemConfigKeys.publicConfig(key),
    queryFn: () => request.get<PublicConfig>(`/api/system-configs/public/${key}`, { silent: true }).then(unwrap),
    staleTime: LOOKUP_STALE_TIME,
  });
}
