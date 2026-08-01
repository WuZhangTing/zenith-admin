import { Select } from '@douyinfe/semi-ui';
import { Building2 } from 'lucide-react';
import type { Tenant } from '@zenith/shared/identity';

// 平台视角租户切换（仅平台管理员且有可用租户时由父级条件渲染）
export function TenantSwitcher({
  tenantList,
  viewingTenantId,
  handleSwitchTenant,
}: Readonly<{
  tenantList: Tenant[];
  viewingTenantId: number | null;
  handleSwitchTenant: (tenantId: number | null) => Promise<void>;
}>) {
  return (
    <>
      <Select
        prefix={<Building2 size={14} />}
        placeholder="平台视角"
        value={viewingTenantId ?? undefined}
        onChange={(v) => handleSwitchTenant((v as number) ?? null)}
        style={{ width: 180 }}
        showClear
        onClear={() => handleSwitchTenant(null)}
        optionList={tenantList.map((t) => ({ value: t.id, label: t.name }))}
        size="small"
      />
      <div style={{ width: 1, height: 16, backgroundColor: 'var(--color-border)', margin: '0 4px' }} />
    </>
  );
}
