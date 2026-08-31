import type { SQL } from 'drizzle-orm';
import { eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { config } from '../config';
import type { JwtPayload } from '../middleware/auth';

const SUPER_ADMIN_CODE = 'super_admin';

/** Check if the current user is a platform super admin (tenantId is null) */
export function isPlatformAdmin(user: JwtPayload): boolean {
  return user.roles.includes(SUPER_ADMIN_CODE) && user.tenantId === null;
}

/** Get the effective tenant ID (viewingTenantId takes priority for super admin) */
export function getEffectiveTenantId(user: JwtPayload): number | null {
  if (!config.multiTenantMode) return null;
  if (isPlatformAdmin(user) && user.viewingTenantId !== undefined) {
    return user.viewingTenantId;
  }
  return user.tenantId;
}

/**
 * Return the concrete tenant scope for data operations.
 *
 * Platform super-admins use both an omitted `viewingTenantId` (fresh login)
 * and an explicit `null` (the switch-tenant endpoint's "platform view") to
 * mean "all tenants"; both therefore return `undefined`. A concrete number
 * means that tenant view. For non-platform users, `null` remains the explicit
 * tenant-less/global scope.
 */
export function getTenantScopeId(user: JwtPayload): number | null | undefined {
  if (!config.multiTenantMode) return undefined;
  if (isPlatformAdmin(user)) return user.viewingTenantId ?? undefined;
  return user.tenantId ?? null;
}

/** Write operations must never silently choose the global scope for a platform
 * administrator in the all-tenant platform view. The caller may pass an
 * explicit override for scheduled jobs or other trusted system flows. */
export function requireTenantScopeId(user: JwtPayload): number | null {
  const scope = getTenantScopeId(user);
  if (scope === undefined && config.multiTenantMode) {
    throw new HTTPException(400, { message: '请先选择租户视角后再执行该资金操作' });
  }
  return scope ?? null;
}

/**
 * Build a tenant filter condition for queries.
 * - Multi-tenant off → no filter
 * - Platform admin without viewingTenantId → no filter (sees all)
 * - Platform admin with viewingTenantId → filter by that tenant
 * - Normal user → filter by their tenantId
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tenantCondition<T extends { tenantId: any }>(
  table: T,
  user: JwtPayload,
): SQL | undefined {
  if (!config.multiTenantMode) return undefined;

  const effectiveTenantId = getEffectiveTenantId(user);

  // Platform admin sees all when not viewing a specific tenant
  if (isPlatformAdmin(user) && effectiveTenantId === null) {
    return undefined;
  }

  // Filter by tenant
  if (effectiveTenantId === null) {
    return isNull(table.tenantId);
  }
  return eq(table.tenantId, effectiveTenantId);
}

/**
 * Get the tenant ID to assign when creating records.
 * Returns the effective tenant ID for the current user.
 */
export function getCreateTenantId(user: JwtPayload): number | null {
  if (!config.multiTenantMode) return null;
  return getEffectiveTenantId(user);
}

// ─── 零参便捷重载：依赖 `contextStorage()` 中间件 ─────────────────────────
// 新代码可直接写 `tenantScope(table)`、`currentCreateTenantId()`，无需手动传 user。
// 既有显式传参 API 保持不变。

// 延迟导入避免循环：context.ts 依赖 middleware/auth 的类型，无运行时依赖
import { currentUser } from './context';

/** `tenantCondition` 的零参版本：自动读取当前请求用户。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tenantScope<T extends { tenantId: any }>(table: T): SQL | undefined {
  return tenantCondition(table, currentUser());
}

/** `getCreateTenantId` 的零参版本：自动读取当前请求用户。 */
export function currentCreateTenantId(): number | null {
  return getCreateTenantId(currentUser());
}
