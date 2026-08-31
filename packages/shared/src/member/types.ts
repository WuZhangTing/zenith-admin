import type { EntityStatus } from '../core/types';
import type { PaymentCashierMethod, PaymentChannel, PaymentDeductMethod, PaymentMethod, PaymentOrderStatus } from '../payment/constants';
import type { PaymentContract } from '../payment/types';
import type { CouponTemplateStatus, CouponType, CouponValidType, MemberCouponStatus, MemberStatus, PointTxType, WalletTxType } from './constants';

export interface MemberLoginLog {
  id: number;
  memberId: number | null;
  memberNickname?: string | null;
  ip: string | null;
  location: string | null;
  browser: string | null;
  os: string | null;
  userAgent: string | null;
  status: 'success' | 'fail';
  message: string | null;
  createdAt: string;
}

export interface MemberRecharge {
  id: number;
  orderNo: string;
  outTradeNo: string;
  channelTradeNo: string | null;
  memberId: number | null;
  memberNickname: string | null;
  memberPhone: string | null;
  subject: string;
  amount: number;
  channel: PaymentChannel;
  payMethod: PaymentMethod;
  status: PaymentOrderStatus;
  paidAmount: number | null;
  paidAt: string | null;
  expiredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface MemberPaymentApplicationOption {
  id: number;
  name: string;
  cashierMethods: Array<{ method: PaymentCashierMethod; label: string; icon: string | null }>;
  deductMethods: Array<{ method: PaymentDeductMethod; label: string }>;
}

export interface MemberStatsOverview {
  totalMembers: number;
  todayNewMembers: number;
  monthNewMembers: number;
  activeMembers30d: number;
  totalPoints: number;
  totalWalletBalance: number;
  todayCheckins: number;
  todayCheckinRate: number;
  availableCoupons: number;
}

export interface MemberStatsCharts {
  registerTrend: { date: string; count: number }[];
  levelDistribution: { name: string; value: number }[];
  pointTrend: { date: string; earned: number; spent: number }[];
  checkinTrend: { date: string; count: number }[];
  /** 活跃分层（按最后登录时间：7天/30天/90天/沉睡/从未登录）*/
  activitySegments: { name: string; value: number }[];
  /** 充值能力分层（按累计充值金额分档）*/
  rechargeSegments: { name: string; value: number }[];
  /** 近30天钱包收支（单位分：income 入账，expense 支出）*/
  walletTrend: { date: string; income: number; expense: number }[];
  /** 注册来源分布 */
  sourceDistribution: { name: string; value: number }[];
  /** 卡券状态分布（未使用/已使用/已过期）*/
  couponStatusDistribution: { name: string; value: number }[];
}

/** 签到日历单日聚合（管理端日历视图） */
export interface MemberCheckinCalendarDay {
  date: string;
  count: number;
  makeupCount: number;
}

export interface HeatmapPoint {
  x: number;
  y: number;
  value: number;
}

/** 会员端自动续费视图（当前协议 + VIP 状态） */
export interface MemberRenewalInfo {
  vipExpireAt?: string | null;
  contract?: PaymentContract | null;
  renewals: MemberVipRenewal[];
}

export interface MemberVipRenewal {
  id: number;
  orderNo: string;
  contractNo?: string | null;
  amount: number; // 分
  vipExpireAfter: string;
  createdAt: string;
}

// ─── 会员中心（Member Center）────────────────────────────────────────
export interface MemberLevel {
  id: number;
  name: string;
  level: number;
  growthThreshold: number;
  /** 折扣百分比（100=原价，95=95折）*/
  discount: number;
  icon?: string | null;
  benefits: string[];
  description?: string | null;
  sort: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: number;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  nickname: string;
  avatar?: string | null;
  gender?: string | null;
  birthday?: string | null;
  status: MemberStatus;
  levelId?: number | null;
  levelName?: string | null;
  /** 付费会员（VIP）到期时间，null = 未开通 */
  vipExpireAt?: string | null;
  growthValue: number;
  experience: number;
  registerSource: string;
  registerIp?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  remark?: string | null;
  /** 是否已设置登录密码 */
  hasPassword?: boolean;
  /** 积分余额（关联查询时附加）*/
  pointBalance?: number;
  /** 钱包余额（分，关联查询时附加）*/
  walletBalance?: number;
  /** 会员标签（后台列表/详情附加）*/
  tags?: MemberTagBrief[];
  createdAt: string;
  updatedAt: string;
}

/** 会员标签（运营分群）*/
export interface MemberTag {
  id: number;
  name: string;
  color?: string | null;
  description?: string | null;
  sort: number;
  status: EntityStatus;
  /** 绑定会员数（列表附加）*/
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

/** 会员身上的标签摘要 */
export interface MemberTagBrief {
  id: number;
  name: string;
  color: string | null;
}

/** 会员站内通知 */
export interface MemberNotification {
  id: number;
  memberId: number;
  type: string;
  title: string;
  content?: string | null;
  readAt?: string | null;
  createdAt: string;
}

/** 会员权益（等级折扣与升级进度）*/
export interface MemberBenefits {
  growthValue: number;
  /** 折扣百分比（100 = 原价）*/
  discount: number;
  levelId: number | null;
  levelName: string | null;
  benefits: string[];
  nextLevel: {
    id: number;
    name: string;
    growthThreshold: number;
    discount: number;
    /** 距升级还差的成长值 */
    growthGap: number;
  } | null;
}

/** 会员邀请汇总 */
export interface MemberInviteSummary {
  inviteCode: string;
  invitedCount: number;
  totalRewardPoints: number;
  recentInvitees: { id: number; nickname: string; createdAt: string }[];
}

/** 会员轻量下拉选项（积分/钱包调整、发券搜索选择）*/
export interface MemberOption {
  id: number;
  nickname: string;
  phone?: string | null;
  username?: string | null;
  levelName?: string | null;
}

export interface MemberPointAccount {
  memberId: number;
  balance: number;
  frozen: number;
  totalEarned: number;
  totalSpent: number;
}

export interface MemberWallet {
  memberId: number;
  /** 余额（分）*/
  balance: number;
  frozen: number;
  totalRecharge: number;
  totalConsume: number;
}

export interface MemberPointTransaction {
  id: number;
  memberId: number;
  type: PointTxType;
  amount: number;
  balanceAfter: number;
  bizType?: string | null;
  bizId?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface MemberWalletTransaction {
  id: number;
  memberId: number;
  type: WalletTxType;
  /** 金额变动（分）*/
  amount: number;
  balanceAfter: number;
  bizType?: string | null;
  bizId?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface Coupon {
  id: number;
  name: string;
  type: CouponType;
  /** amount 型为减免金额（分）；percent 型为折扣百分比 */
  faceValue: number;
  threshold: number;
  maxDiscount?: number | null;
  totalQuantity: number;
  issuedQuantity: number;
  perLimit: number;
  validType: CouponValidType;
  validStart?: string | null;
  validEnd?: string | null;
  validDays?: number | null;
  /** 积分兑换所需积分（0 = 不可积分兑换）*/
  exchangePoints?: number;
  status: CouponTemplateStatus;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCoupon {
  id: number;
  couponId: number;
  memberId: number;
  code: string;
  status: MemberCouponStatus;
  receivedAt: string;
  usedAt?: string | null;
  expireAt?: string | null;
  coupon?: Coupon;
  /** 后台列表展示用：会员昵称/标识 */
  memberName?: string;
  createdAt: string;
}

/** 会员登录结果 */
export interface MemberLoginResult {
  member: Member;
  token: { accessToken: string; refreshToken: string };
}

export interface CheckinRule {
  id: number;
  dayNumber: number;
  points: number;
  experience: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCheckin {
  id: number;
  memberId: number;
  memberNickname?: string | null;
  checkinDate: string;
  consecutiveDays: number;
  pointsAwarded: number;
  experienceAwarded: number;
  isMakeup?: boolean;
  /** 备注（管理端补签原因）*/
  remark?: string | null;
  createdAt: string;
}

export interface MemberCheckinStatus {
  checkedToday: boolean;
  consecutiveDays: number;
  totalDays: number;
  todayPoints: number;
  todayExperience: number;
  nextDayPoints: number;
  nextDayExperience: number;
  thisMonthDates: string[];
}

export type CheckinMilestoneRewardType = 'points' | 'coupon';

export interface CheckinSettings {
  makeupEnabled: boolean;
  makeupCostPoints: number;
  makeupMaxDays: number;
  updatedAt: string;
}

export interface CheckinMilestone {
  id: number;
  title: string;
  cumulativeDays: number;
  rewardType: CheckinMilestoneRewardType;
  rewardPoints: number;
  couponId?: number | null;
  couponName?: string | null;
  enabled: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberMilestoneStatusItem {
  id: number;
  title: string;
  cumulativeDays: number;
  rewardType: CheckinMilestoneRewardType;
  rewardPoints: number;
  couponName?: string | null;
  achieved: boolean;
  achievedAt?: string | null;
}

export interface MemberMilestoneStatus {
  totalDays: number;
  milestones: MemberMilestoneStatusItem[];
}

export interface MakeupCheckinResult {
  checkinDate: string;
  pointsAwarded: number;
  experienceAwarded: number;
  costPoints: number;
  consecutiveDays: number;
}

export interface GenerateSelfSignedCertInput {
  name: string;
  domain: string;
  days?: number;
  country?: string;
  organization?: string;
  outputDir?: string;
}
