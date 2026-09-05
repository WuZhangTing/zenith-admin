import { keepPreviousData } from '@tanstack/react-query';
import { resourceKeyOf, type QueryOf } from '@zenith/shared/core';
import { iotWhitelistContract } from '@zenith/shared/iot';
import { contractKey, useApiMutation, useApiQuery } from '@/lib/contract-query';
import { iotProductKeys } from './iot-products';

// ─── 注册白名单 ───────────────────────────────────────────────────────────────
export type IotWhitelistListParams = NonNullable<QueryOf<typeof iotWhitelistContract.list>>;

export const iotWhitelistKeys = {
  all: [resourceKeyOf(iotWhitelistContract.basePath)] as const,
  lists: contractKey(iotWhitelistContract.list),
  list: (params: IotWhitelistListParams) => contractKey(iotWhitelistContract.list, { query: params }),
  stats: (productId?: number) => contractKey(iotWhitelistContract.stats, { query: { productId } }),
};

export function useIotWhitelistList(params: IotWhitelistListParams) {
  return useApiQuery(iotWhitelistContract.list, { query: params }, { placeholderData: keepPreviousData });
}

export function useIotWhitelistStats(productId?: number) {
  return useApiQuery(iotWhitelistContract.stats, { query: { productId } });
}

/** 批量导入：列表与统计（同一命名空间）一并失效 */
export function useImportIotWhitelist() {
  return useApiMutation(iotWhitelistContract.import, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: iotWhitelistKeys.all }),
  });
}

export function useDeleteIotWhitelistEntry() {
  return useApiMutation(iotWhitelistContract.remove, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: iotWhitelistKeys.all }),
  });
}

// ─── 产品注册密钥 ─────────────────────────────────────────────────────────────
/** 开启/重置注册密钥：明文仅本次返回；产品列表的开关状态需刷新 */
export function useResetIotRegistrationSecret() {
  return useApiMutation(iotWhitelistContract.resetRegistrationSecret, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: iotProductKeys.all }),
  });
}

export function useDisableIotRegistration() {
  return useApiMutation(iotWhitelistContract.disableRegistration, {
    invalidate: (qc) => void qc.invalidateQueries({ queryKey: iotProductKeys.all }),
  });
}
