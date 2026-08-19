import { HTTPException } from 'hono/http-exception';
import type { MiddlewareHandler } from 'hono';
import { isLicenseFeatureKey, type LicenseFeatureKey, type LicenseMode } from '@zenith/shared/licensing';
import { config } from '../config';

/**
 * License 功能门控（PR1 骨架）。
 *
 * - `off` 模式（默认）：不做任何检查，全部功能可用——开发 / 演示 / CI 零感知。
 * - `warn` / `required` 模式：PR2 接入已激活 License 的功能集后生效；
 *   在此之前 warn 视为全放行，required 在无 License 快照时同样放行（避免半成品锁死）。
 *
 * 该模块必须保持惰性：不在 import 时读库，不产生进程级副作用（createApp() 无副作用约束）。
 */
export function licenseMode(): LicenseMode {
  return config.licenseMode;
}

/**
 * 判断某个可授权功能当前是否可用（部署级 License 维度，与租户套餐无关）。
 * PR1 中除 off 短路外恒为 true；PR2 引入 License 快照后改为查功能集。
 */
export async function isFeatureEnabled(feature: LicenseFeatureKey): Promise<boolean> {
  if (config.licenseMode === 'off') return true;
  if (!isLicenseFeatureKey(feature)) return false;
  return true;
}

/** 功能不可用时抛 403（带机器可读 code，前端据此展示升级引导）。 */
export async function assertFeatureEnabled(feature: LicenseFeatureKey): Promise<void> {
  if (await isFeatureEnabled(feature)) return;
  throw new HTTPException(403, {
    res: Response.json(
      { code: 'LICENSE_FEATURE_DISABLED', message: `当前授权不包含「${feature}」功能，请联系管理员升级 License`, feature },
      { status: 403 },
    ),
  });
}

/** 域挂载级功能门控中间件：off 模式零开销直通。 */
export function licenseFeatureGate(feature: LicenseFeatureKey): MiddlewareHandler {
  return async (_c, next) => {
    if (config.licenseMode !== 'off') {
      await assertFeatureEnabled(feature);
    }
    await next();
  };
}
