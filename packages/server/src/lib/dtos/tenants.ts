/**
 * 租户相关 DTO
 */
import { z } from '@hono/zod-openapi';
import { auditFields } from './_audit';

export const TenantDTO = z
  .object({
    id: z.number().int(),
    name: z.string().openapi({ example: '示例租户' }),
    code: z.string().openapi({ example: 'demo' }),
    logo: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    status: z.enum(['enabled', 'disabled']),
    expireAt: z.string().nullable().optional(),
    maxUsers: z.number().int().nullable().optional(),
    packageId: z.number().int().nullable().optional(),
    packageName: z.string().nullable().optional(),
    userCount: z.number().int().optional().openapi({ description: '租户当前用户数（列表返回）' }),
    remark: z.string().nullable().optional(),
    initialAdmin: z
      .object({
        username: z.string(),
        email: z.string(),
        password: z.string().openapi({ description: '初始密码，仅创建响应中一次性返回' }),
      })
      .optional()
      .openapi({ description: '自动初始化的租户管理员账号（仅创建且指定 adminUsername 时返回）' }),
    ...auditFields,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .openapi('Tenant');

export const TenantStatsDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    code: z.string(),
    status: z.enum(['enabled', 'disabled']),
    userCount: z.number().int(),
    maxUsers: z.number().int().nullable(),
    departmentCount: z.number().int(),
    roleCount: z.number().int(),
    positionCount: z.number().int(),
    packageId: z.number().int().nullable(),
    packageName: z.string().nullable(),
    packageFeatureCount: z.number().int().openapi({ description: '套餐已分配的可授权功能数量' }),
    expireAt: z.string().nullable(),
    daysToExpire: z.number().int().nullable().openapi({ description: '距到期天数；null=永不过期，负数=已过期' }),
  })
  .openapi('TenantStats');

export const TenantPackageQuotasDTO = z
  .object({
    maxUsers: z.number().int().nullable().optional().openapi({ description: '套餐席位上限；缺省/null=不限制' }),
  })
  .nullable();

export const TenantPackageDTO = z
  .object({
    id: z.number().int(),
    name: z.string().openapi({ example: '标准版' }),
    status: z.enum(['enabled', 'disabled']),
    quotas: TenantPackageQuotasDTO.optional(),
    remark: z.string().nullable().optional(),
    features: z.array(z.string()).optional().openapi({ description: '已分配的可授权功能 key（列表与详情返回）' }),
    featureCount: z.number().int().optional().openapi({ description: '已分配功能数量' }),
    ...auditFields,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .openapi('TenantPackage');
