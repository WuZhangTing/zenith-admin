import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IotWhitelistEntry } from '@zenith/shared/iot';
import type { PaginatedResponse } from '@zenith/shared/core';
import { request } from '@/utils/request';
import { toQueryString, unwrap } from '@/lib/query';
import type { CrudListParams } from '@/lib/crud-queries';
import { iotProductKeys } from './iot-products';

// ─── 注册白名单 ───────────────────────────────────────────────────────────────
export interface IotWhitelistListParams extends CrudListParams {
  keyword?: string;
  productId?: number;
  used?: boolean;
}

export const iotWhitelistKeys = {
  all: ['iot-whitelist'] as const,
  lists: ['iot-whitelist', 'list'] as const,
  list: (params: IotWhitelistListParams) => ['iot-whitelist', 'list', params] as const,
  stats: (productId?: number) => ['iot-whitelist', 'stats', productId ?? 0] as const,
};

export function useIotWhitelistList(params: IotWhitelistListParams) {
  return useQuery({
    queryKey: iotWhitelistKeys.list(params),
    queryFn: () => request.get<PaginatedResponse<IotWhitelistEntry>>(`/api/iot/whitelist${toQueryString(params)}`).then(unwrap),
    placeholderData: keepPreviousData,
  });
}

export function useIotWhitelistStats(productId?: number) {
  return useQuery({
    queryKey: iotWhitelistKeys.stats(productId),
    queryFn: () => request.get<{ total: number; used: number }>(`/api/iot/whitelist/stats${toQueryString({ productId })}`).then(unwrap),
  });
}

export interface ImportWhitelistInput {
  productId: number;
  sns: string[];
  remark?: string | null;
}

export function useImportIotWhitelist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ImportWhitelistInput) =>
      request.post<{ total: number; inserted: number; skipped: number }>('/api/iot/whitelist', values).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotWhitelistKeys.all });
    },
  });
}

export function useDeleteIotWhitelistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request.delete<null>(`/api/iot/whitelist/${id}`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotWhitelistKeys.all });
    },
  });
}

// ─── 产品注册密钥 ─────────────────────────────────────────────────────────────
/** 开启/重置注册密钥：明文仅本次返回；产品列表的开关状态需刷新 */
export function useResetIotRegistrationSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) =>
      request.post<{ registrationSecret: string }>(`/api/iot/whitelist/products/${productId}/registration-secret`, {}).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotProductKeys.all });
    },
  });
}

export function useDisableIotRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) =>
      request.delete<null>(`/api/iot/whitelist/products/${productId}/registration-secret`).then(unwrap),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iotProductKeys.all });
    },
  });
}
