import * as z from 'zod';
import { MARKETING_PRIZE_TYPES } from './constants';

export const createMarketingCampaignSchema = z.object({
  name: z.string().min(1, '活动名称不能为空').max(128),
  startAt: z.string().min(1, '请选择开始时间').max(19),
  endAt: z.string().min(1, '请选择结束时间').max(19),
  perMemberLimit: z.number().int().min(1, '每人次数至少 1 次').max(1000).default(1),
  dailyPerMemberLimit: z.number().int().min(1).max(1000).nullable().optional(),
  landingUrl: z.preprocess((v) => (v === '' ? null : v), z.url('落地页必须是合法 URL').max(2048).nullable().optional()),
  description: z.string().max(2000).nullable().optional(),
});

export const updateMarketingCampaignSchema = createMarketingCampaignSchema.partial();

export const saveMarketingPrizeSchema = z.object({
  name: z.string().min(1, '奖品名称不能为空').max(128),
  prizeType: z.enum(MARKETING_PRIZE_TYPES),
  points: z.number().int().positive().max(1_000_000).nullable().optional(),
  couponId: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  weight: z.number().int().min(1, '权重至少为 1').max(100_000).default(1),
  sort: z.number().int().min(0).max(9999).default(0),
}).superRefine((value, ctx) => {
  if (value.prizeType === 'points' && !value.points) {
    ctx.addIssue({ code: 'custom', path: ['points'], message: '积分奖品必须填写积分数' });
  }
  if (value.prizeType === 'coupon' && !value.couponId) {
    ctx.addIssue({ code: 'custom', path: ['couponId'], message: '优惠券奖品必须选择优惠券' });
  }
});

export type CreateMarketingCampaignInput = z.infer<typeof createMarketingCampaignSchema>;

export type UpdateMarketingCampaignInput = z.infer<typeof updateMarketingCampaignSchema>;

export type SaveMarketingPrizeInput = z.infer<typeof saveMarketingPrizeSchema>;
