import { useState } from 'react';
import { useAllTenants, useSwitchTenant } from '@/hooks/queries/tenants';

// ─── 租户切换（仅平台管理员） ─────────────────────────────────────────────
export function useTenantSwitch(isPlatformAdmin: boolean | undefined) {
  const [viewingTenantId, setViewingTenantId] = useState<number | null>(null);
  const { data: tenants } = useAllTenants({ enabled: !!isPlatformAdmin });
  const switchMutation = useSwitchTenant();

  const tenantList = (tenants ?? []).filter((t) => t.status === 'enabled');

  const handleSwitchTenant = async (tenantId: number | null) => {
    const data = await switchMutation.mutateAsync(tenantId);
    localStorage.setItem('zenith_token', data.accessToken);
    localStorage.setItem('zenith_refresh_token', data.refreshToken);
    setViewingTenantId(tenantId);
    globalThis.location.reload();
  };

  return { tenantList, viewingTenantId, handleSwitchTenant };
}
