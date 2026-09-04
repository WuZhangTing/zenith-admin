import type { MarketingCampaign, MarketingPrize } from '../marketing/contracts';
import { SEED_DATE } from './_base';

/** 营销活动演示数据：DB seed 与 MSW mock 共用（shortUrl / 统计 / couponName 为派生字段，DB seed 时忽略） */
export const SEED_MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 1,
    name: '新春抽奖 · 天天有礼',
    type: 'lottery',
    status: 'published',
    startAt: '2026-01-01 00:00:00',
    endAt: '2026-12-31 23:59:59',
    perMemberLimit: 3,
    dailyPerMemberLimit: 1,
    landingUrl: 'https://www.example.com/activity/new-year-lottery',
    shortUrl: null,
    description: '演示抽奖活动：每人共 3 次机会，每天限 1 次，中奖自动发放积分/优惠券。',
    participationCount: 0,
    awardCount: 0,
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
];

export const SEED_MARKETING_PRIZES: MarketingPrize[] = [
  { id: 1, campaignId: 1, name: '100 积分', prizeType: 'points', points: 100, couponId: null, couponName: null, stock: 500, totalStock: 500, weight: 50, sort: 1, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 2, campaignId: 1, name: '新人满减券', prizeType: 'coupon', points: null, couponId: 1, couponName: null, stock: 100, totalStock: 100, weight: 20, sort: 2, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 3, campaignId: 1, name: '定制周边礼盒', prizeType: 'physical', points: null, couponId: null, couponName: null, stock: 10, totalStock: 10, weight: 2, sort: 3, createdAt: SEED_DATE, updatedAt: SEED_DATE },
  { id: 4, campaignId: 1, name: '谢谢参与', prizeType: 'none', points: null, couponId: null, couponName: null, stock: 0, totalStock: 0, weight: 60, sort: 9, createdAt: SEED_DATE, updatedAt: SEED_DATE },
];
