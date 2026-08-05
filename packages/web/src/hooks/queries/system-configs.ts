import { useQuery } from '@tanstack/react-query';
import type { SystemConfig } from '@zenith/shared/platform';
import { LOOKUP_STALE_TIME, unwrap } from '@/lib/query';
import { request } from '@/utils/request';
import { createCrudQueries, type CrudListParams } from '@/lib/crud-queries';
import type { PasswordPolicy } from '@/utils/password-policy';

export interface SystemConfigListParams extends CrudListParams {
  keyword?: string;
  configType?: string;
}

/** 密码策略与公开配置都是配置表派生的读视图，任一条配置增删改都可能影响它们 */
const PASSWORD_POLICY_KEY = ['system-configs', 'password-policy'] as const;
const PUBLIC_PREFIX = ['system-configs', 'public'] as const;

function invalidateDerivedViews(qc: import('@tanstack/react-query').QueryClient) {
  void qc.invalidateQueries({ queryKey: PASSWORD_POLICY_KEY });
  void qc.invalidateQueries({ queryKey: PUBLIC_PREFIX });
}

const crud = createCrudQueries<SystemConfig, SystemConfigListParams>({
  resource: 'system-configs',
  // 服务端未提供 DELETE /batch
  deleteMode: 'single',
  onSaved: (qc) => invalidateDerivedViews(qc),
  onDeleted: (qc) => invalidateDerivedViews(qc),
});

export const systemConfigKeys = {
  ...crud.keys,
  passwordPolicy: PASSWORD_POLICY_KEY,
  publicPrefix: PUBLIC_PREFIX,
  publicConfig: (key: string) => ['system-configs', 'public', key] as const,
};

export const useSystemConfigList = crud.useList;
export const useSystemConfigDetail = crud.useDetail;
export const useSaveSystemConfig = crud.useSave;
export const useDeleteSystemConfigs = crud.useDelete;

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
