import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tenants, tenantPackages, tenantPackageFeatures } from '../db/schema';
import { config } from '../config';

/**
 * 返回指定租户「套餐功能集」。
 *
 * 返回 `null` 表示**不限制**（调用方应放行全部功能），命中以下任一条件即视为不限制：
 *  - 多租户模式关闭（`MULTI_TENANT_MODE=false`，默认）
 *  - `tenantId` 为空（平台级 / 平台超管未切换租户视角）
 *  - 该租户未绑定套餐（`packageId` 为空）
 *
 * 仅当多租户开启、且租户绑定了套餐时，才返回该套餐分配的功能 key 集合：
 *  - 套餐被**禁用**时返回空集（fail-closed：全部可授权功能关闭，核心能力不受影响——
 *    核心菜单 featureKey 为 null，不参与交集）
 */
export async function getTenantPackageFeatureSet(tenantId: number | null | undefined): Promise<Set<string> | null> {
  if (!config.multiTenantMode) return null;
  if (tenantId == null) return null;

  const [tenant] = await db
    .select({ packageId: tenants.packageId })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant || tenant.packageId == null) return null;

  const [pkg] = await db
    .select({ status: tenantPackages.status })
    .from(tenantPackages)
    .where(eq(tenantPackages.id, tenant.packageId))
    .limit(1);
  if (!pkg) return null;
  if (pkg.status === 'disabled') return new Set();

  const rows = await db
    .select({ featureKey: tenantPackageFeatures.featureKey })
    .from(tenantPackageFeatures)
    .where(eq(tenantPackageFeatures.packageId, tenant.packageId));
  return new Set(rows.map((r) => r.featureKey));
}
