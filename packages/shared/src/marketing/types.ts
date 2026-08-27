import type {
  MarketingCampaignStatus,
  MarketingCampaignType,
  MarketingGrantStatus,
  MarketingPrizeType,
} from './constants';

export interface MarketingCampaign {
  id: number;
  name: string;
  type: MarketingCampaignType;
  status: MarketingCampaignStatus;
  /** YYYY-MM-DD HH:mm:ss */
  startAt: string;
  endAt: string;
  perMemberLimit: number;
  dailyPerMemberLimit: number | null;
  landingUrl: string | null;
  /** 分享短链（配置了落地页且已生成时回显） */
  shortUrl?: string | null;
  description: string | null;
  /** 参与/中奖统计（列表聚合返回） */
  participationCount?: number;
  awardCount?: number;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingPrize {
  id: number;
  campaignId: number;
  name: string;
  prizeType: MarketingPrizeType;
  points: number | null;
  couponId: number | null;
  couponName?: string | null;
  stock: number;
  totalStock: number;
  weight: number;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingParticipation {
  id: number;
  campaignId: number;
  memberId: number;
  memberNickname?: string | null;
  prizeId: number | null;
  prizeName: string | null;
  grantStatus: MarketingGrantStatus;
  grantNote: string | null;
  createdAt: string;
}

/** C 端抽奖结果 */
export interface MarketingDrawResult {
  /** 是否中奖 */
  won: boolean;
  prizeId: number | null;
  prizeName: string | null;
  prizeType: MarketingPrizeType | null;
  /** 剩余可参与次数（总限制口径） */
  remainingTimes: number;
}
