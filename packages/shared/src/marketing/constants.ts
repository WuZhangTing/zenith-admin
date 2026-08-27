import { createLabelOptions } from '../core/enum-options';

// ─── 活动类型 ─────────────────────────────────────────────────────────────────
export const MARKETING_CAMPAIGN_TYPES = ['lottery'] as const;

export type MarketingCampaignType = (typeof MARKETING_CAMPAIGN_TYPES)[number];

export const MARKETING_CAMPAIGN_TYPE_LABELS: Record<MarketingCampaignType, string> = {
  lottery: '抽奖活动',
};

export const MARKETING_CAMPAIGN_TYPE_OPTIONS = createLabelOptions(MARKETING_CAMPAIGN_TYPES, MARKETING_CAMPAIGN_TYPE_LABELS);

// ─── 活动状态 ─────────────────────────────────────────────────────────────────
export const MARKETING_CAMPAIGN_STATUSES = ['draft', 'published', 'ended'] as const;

export type MarketingCampaignStatus = (typeof MARKETING_CAMPAIGN_STATUSES)[number];

export const MARKETING_CAMPAIGN_STATUS_LABELS: Record<MarketingCampaignStatus, string> = {
  draft: '草稿',
  published: '进行中',
  ended: '已结束',
};

export const MARKETING_CAMPAIGN_STATUS_OPTIONS = createLabelOptions(MARKETING_CAMPAIGN_STATUSES, MARKETING_CAMPAIGN_STATUS_LABELS);

// ─── 奖品类型 ─────────────────────────────────────────────────────────────────
export const MARKETING_PRIZE_TYPES = ['points', 'coupon', 'physical', 'none'] as const;

export type MarketingPrizeType = (typeof MARKETING_PRIZE_TYPES)[number];

export const MARKETING_PRIZE_TYPE_LABELS: Record<MarketingPrizeType, string> = {
  points: '积分',
  coupon: '优惠券',
  physical: '实物',
  none: '谢谢参与',
};

export const MARKETING_PRIZE_TYPE_OPTIONS = createLabelOptions(MARKETING_PRIZE_TYPES, MARKETING_PRIZE_TYPE_LABELS);

// ─── 发放状态 ─────────────────────────────────────────────────────────────────
export const MARKETING_GRANT_STATUSES = ['none', 'granted', 'failed'] as const;

export type MarketingGrantStatus = (typeof MARKETING_GRANT_STATUSES)[number];

export const MARKETING_GRANT_STATUS_LABELS: Record<MarketingGrantStatus, string> = {
  none: '未中奖',
  granted: '已发放',
  failed: '发放失败',
};

export const MARKETING_GRANT_STATUS_OPTIONS = createLabelOptions(MARKETING_GRANT_STATUSES, MARKETING_GRANT_STATUS_LABELS);
