/**
 * 接口限流（rate limit）相关 DTO
 */
import { z } from '@hono/zod-openapi';
import { auditFields } from './_audit';

export const RateLimitRuleDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string().nullable(),
    windowMs: z.number().int(),
    limit: z.number().int(),
    keyType: z.enum(['ip', 'user', 'ip_path']),
    enabled: z.boolean(),
    mode: z.enum(['enforce', 'monitor']).openapi({ description: 'enforce=超限拦截；monitor=观察模式（只记数不拦截）' }),
    algorithm: z.enum(['fixed_window', 'sliding_window']),
    allowlist: z.array(z.string()).openapi({ description: '豁免名单：IP / CIDR / u:{userId}' }),
    priority: z.number().int().openapi({ description: '路径绑定优先级，多规则命中同一路径时取大者' }),
    alertThreshold: z.number().int().nullable().openapi({ description: '小时拦截数告警阈值，null=不告警' }),
    blockedMessage: z.string().nullable(),
    pathPatterns: z.array(z.string()),
    predefined: z.boolean().openapi({ description: '是否内置规则（不可删除）' }),
    mountSource: z.enum(['code', 'path', 'code_path', 'none']).openapi({ description: '挂载来源：code=代码挂载；path=路径绑定；none=未生效（死规则）' }),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('RateLimitRule');

export const RateLimitStatItemDTO = z
  .object({
    name: z.string(),
    description: z.string().nullable(),
    windowMs: z.number().int(),
    limit: z.number().int(),
    keyType: z.string(),
    enabled: z.boolean(),
    mode: z.enum(['enforce', 'monitor']),
    hitCount: z.number().int(),
    blockedCount: z.number().int(),
    blockRate: z.number(),
    recentBlocks: z.array(z.object({
      at: z.string(),
      key: z.string(),
      path: z.string(),
      monitored: z.boolean().openapi({ description: '观察模式命中：只记数未实际拦截' }),
      banned: z.boolean().openapi({ description: '手动封禁命中' }),
    })),
    hourlySeries: z.array(z.object({
      hour: z.string(),
      hits: z.number().int(),
      blocked: z.number().int(),
    })),
  })
  .openapi('RateLimitStatItem');

export const RateLimitStatsDTO = z
  .object({
    items: z.array(RateLimitStatItemDTO),
  })
  .openapi('RateLimitStats');

export const RateLimitBanDTO = z
  .object({
    name: z.string().openapi({ description: '规则名' }),
    key: z.string().openapi({ description: '被封禁的计数身份（IP / u:{userId} / ip|path）' }),
    expiresAt: z.string().openapi({ description: '封禁到期时间' }),
    remainingSeconds: z.number().int().openapi({ description: '剩余秒数' }),
  })
  .openapi('RateLimitBan');
