/**
 * 营销活动 DTO
 */
import { z } from '@hono/zod-openapi';
import {
  MARKETING_CAMPAIGN_STATUSES, MARKETING_CAMPAIGN_TYPES,
  MARKETING_GRANT_STATUSES, MARKETING_PRIZE_TYPES,
} from '@zenith/shared/marketing';
import { auditFields } from './_audit';

export const MarketingCampaignDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.enum(MARKETING_CAMPAIGN_TYPES),
    status: z.enum(MARKETING_CAMPAIGN_STATUSES),
    startAt: z.string(),
    endAt: z.string(),
    perMemberLimit: z.number().int(),
    dailyPerMemberLimit: z.number().int().nullable(),
    landingUrl: z.string().nullable(),
    shortUrl: z.string().nullable(),
    description: z.string().nullable(),
    participationCount: z.number().int(),
    awardCount: z.number().int(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('MarketingCampaign');

export const MarketingPrizeDTO = z
  .object({
    id: z.number().int(),
    campaignId: z.number().int(),
    name: z.string(),
    prizeType: z.enum(MARKETING_PRIZE_TYPES),
    points: z.number().int().nullable(),
    couponId: z.number().int().nullable(),
    couponName: z.string().nullable(),
    stock: z.number().int(),
    totalStock: z.number().int(),
    weight: z.number().int(),
    sort: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('MarketingPrize');

export const MarketingParticipationDTO = z
  .object({
    id: z.number().int(),
    campaignId: z.number().int(),
    memberId: z.number().int(),
    memberNickname: z.string().nullable(),
    prizeId: z.number().int().nullable(),
    prizeName: z.string().nullable(),
    grantStatus: z.enum(MARKETING_GRANT_STATUSES),
    grantNote: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('MarketingParticipation');

export const MarketingDrawResultDTO = z
  .object({
    won: z.boolean(),
    prizeId: z.number().int().nullable(),
    prizeName: z.string().nullable(),
    prizeType: z.enum(MARKETING_PRIZE_TYPES).nullable(),
    remainingTimes: z.number().int(),
  })
  .openapi('MarketingDrawResult');

export const MarketingPublicCampaignDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.enum(MARKETING_CAMPAIGN_TYPES),
    startAt: z.string(),
    endAt: z.string(),
    perMemberLimit: z.number().int(),
    dailyPerMemberLimit: z.number().int().nullable(),
    description: z.string().nullable(),
    prizes: z.array(z.object({
      id: z.number().int(),
      name: z.string(),
      prizeType: z.enum(MARKETING_PRIZE_TYPES),
    })),
  })
  .openapi('MarketingPublicCampaign');
