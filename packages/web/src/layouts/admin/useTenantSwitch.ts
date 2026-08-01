import { useEffect, useState } from 'react';
import type { Tenant } from '@zenith/shared/identity';
import { request } from '@/utils/request';

// ─── 租户切换（仅平台管理员） ─────────────────────────────────────────────
export function useTenantSwitch(isPlatformAdmin: boolean | undefined) {
  const [tenantList, setTenantList] = useState<Tenant[]>([]);
  const [viewingTenantId, setViewingTenantId] = useState<number | null>(null);

  useEffect(() => {
    if (isPlatformAdmin) {
      request.get<Tenant[]>('/api/tenants/all', { silent: true }).then((res) => {
        if (res.code === 0 && res.data) setTenantList(res.data.filter((t) => t.status === 'enabled'));
      });
    }
  }, [isPlatformAdmin]);

  const handleSwitchTenant = async (tenantId: number | null) => {
    const res = await request.post<{ accessToken: string; refreshToken: string }>('/api/auth/switch-tenant', { tenantId });
    if (res.code === 0 && res.data) {
      localStorage.setItem('zenith_token', res.data.accessToken);
      localStorage.setItem('zenith_refresh_token', res.data.refreshToken);
      setViewingTenantId(tenantId);
      globalThis.location.reload();
    }
  };

  return { tenantList, viewingTenantId, handleSwitchTenant };
}
