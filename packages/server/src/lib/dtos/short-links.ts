/**
 * 短链服务 DTO
 */
import { z } from '@hono/zod-openapi';
import { SHORT_LINK_BIZ_TYPES, SHORT_LINK_REDIRECT_TYPES } from '@zenith/shared/short-link';
import { auditFields } from './_audit';

export const ShortLinkDTO = z
  .object({
    id: z.number().int(),
    code: z.string().openapi({ example: 'aB3xY7k' }),
    shortUrl: z.string().openapi({ example: 'https://example.com/s/aB3xY7k' }),
    targetUrl: z.string().openapi({ example: 'https://example.com/landing?from=sms' }),
    title: z.string().nullable(),
    redirectType: z.enum(SHORT_LINK_REDIRECT_TYPES),
    status: z.enum(['enabled', 'disabled']),
    expiresAt: z.string().nullable(),
    expired: z.boolean(),
    maxVisits: z.number().int().nullable(),
    password: z.string().nullable(),
    utmSource: z.string().nullable(),
    utmMedium: z.string().nullable(),
    utmCampaign: z.string().nullable(),
    utmTerm: z.string().nullable(),
    utmContent: z.string().nullable(),
    bizType: z.enum(SHORT_LINK_BIZ_TYPES),
    bizRef: z.string().nullable(),
    remark: z.string().nullable(),
    totalPv: z.number().int(),
    lastVisitAt: z.string().nullable(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ShortLink');

const dimensionItem = z.object({ name: z.string(), count: z.number().int() });

export const ShortLinkStatsDTO = z
  .object({
    totals: z.object({
      pv: z.number().int(),
      uv: z.number().int(),
      todayPv: z.number().int(),
      todayUv: z.number().int(),
    }),
    trend: z.array(z.object({ date: z.string(), pv: z.number().int(), uv: z.number().int() })),
    devices: z.array(dimensionItem),
    browsers: z.array(dimensionItem),
    regions: z.array(dimensionItem),
    referers: z.array(dimensionItem),
  })
  .openapi('ShortLinkStats');

export const ChannelAnalysisDTO = z
  .object({
    totals: z.object({
      clicks: z.number().int(),
      uv: z.number().int(),
      links: z.number().int(),
      conversions: z.number().int().nullable(),
    }),
    trend: z.array(z.object({ date: z.string(), pv: z.number().int(), uv: z.number().int() })),
    rows: z.array(z.object({
      name: z.string(),
      clicks: z.number().int(),
      uv: z.number().int(),
      conversions: z.number().int().nullable(),
      convRate: z.number().nullable(),
    })),
  })
  .openapi('ChannelAnalysis');
