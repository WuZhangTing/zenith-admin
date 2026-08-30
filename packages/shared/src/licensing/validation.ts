import * as z from 'zod';
import {
  LICENSE_AUDIENCE,
  LICENSE_EDITIONS,
  LICENSE_FEATURES,
} from './constants';
import { dateTimeStringSchema } from '../core/validation';

// ─── 签名载荷与信封 ───────────────────────────────────────────────────────────

/** ISO 8601 时间戳（License 文档跨系统交换，用 ISO 而非本地格式） */
const isoDateTime = z.iso.datetime({ offset: true });

export const licensePayloadSchema = z.strictObject({
  licenseId: z.string().min(1).max(64),
  audience: z.literal(LICENSE_AUDIENCE),
  installationId: z.uuid(),
  customerId: z.string().min(1).max(64),
  customerName: z.string().min(1).max(128),
  edition: z.enum(LICENSE_EDITIONS),
  features: z.array(z.enum(LICENSE_FEATURES)).max(LICENSE_FEATURES.length),
  limits: z.object({
    maxUsers: z.number().int().positive().nullable(),
    maxTenants: z.number().int().positive().nullable(),
    maxNodes: z.number().int().positive().nullable(),
  }),
  issuedAt: isoDateTime,
  notBefore: isoDateTime,
  expiresAt: isoDateTime,
  graceUntil: isoDateTime,
  maintenanceUntil: isoDateTime.nullable(),
});

export const licenseEnvelopeSchema = z.strictObject({
  // version/algorithm 不用 literal：具体值在验签流程中显式检查，给出可读错误而非「结构无效」
  version: z.number().int().positive(),
  algorithm: z.string().min(1).max(32),
  keyId: z.string().min(1).max(64),
  payload: z.string().min(1),
  signature: z.string().min(1),
});

/** 激活请求：粘贴 .zenlic 文件内容（JSON 字符串） */
export const activateLicenseSchema = z.object({
  envelope: z.string().min(1, 'License 文件内容不能为空').max(64 * 1024),
});

// ─── 套餐功能与配额 ───────────────────────────────────────────────────────────

export const tenantPackageQuotasSchema = z.strictObject({
  maxUsers: z.number().int().positive().optional().nullable(),
});

export const assignTenantPackageFeaturesSchema = z.object({
  features: z.array(z.enum(LICENSE_FEATURES)).default([]),
});

// ─── 事件查询 ─────────────────────────────────────────────────────────────────

export const listLicenseEventsQuerySchema = z.object({
  startTime: dateTimeStringSchema.optional(),
  endTime: dateTimeStringSchema.optional(),
});

export type LicensePayloadInput = z.infer<typeof licensePayloadSchema>;
export type LicenseEnvelopeInput = z.infer<typeof licenseEnvelopeSchema>;
export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;
export type TenantPackageQuotasInput = z.infer<typeof tenantPackageQuotasSchema>;
export type AssignTenantPackageFeaturesInput = z.infer<typeof assignTenantPackageFeaturesSchema>;
