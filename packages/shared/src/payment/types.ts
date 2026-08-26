import type { EntityStatus } from '../core/types';
import type { PaymentChannel, PaymentContractStatus, PaymentDeductPeriod, PaymentDisputeStatus, PaymentDisputeType, PaymentLedgerDirection, PaymentLedgerType, PaymentLinkStatus, PaymentMethod, PaymentOrderStatus, PaymentPreauthStatus, PaymentReconHandleStatus, PaymentReconResult, PaymentReconStatus, PaymentRefundApprovalStatus, PaymentRefundStatus, PaymentRiskAction, PaymentRiskDimension, PaymentRiskReviewStatus, PaymentRiskScope, PaymentSettlementStatus, PaymentSharingOrderStatus, PaymentSharingReceiverType, PaymentTransferStatus, PaymentWebhookDeliveryStatus } from './constants';

// ─── 支付中心 ────────────────────────────────────────────────────────
export interface PaymentChannelConfig {
  id: number;
  name: string;
  channel: PaymentChannel;
  status: EntityStatus;
  isDefault: boolean;
  sandbox: boolean;
  notifyUrl?: string | null;
  // 微信（密钥字段以掩码/布尔位返回，永不返回明文）
  wechatAppId?: string | null;
  wechatMchId?: string | null;
  wechatSerialNo?: string | null;
  wechatPlatformCert?: string | null;
  hasWechatApiV3Key?: boolean;
  hasWechatPrivateKey?: boolean;
  // 支付宝
  alipayAppId?: string | null;
  alipayPublicKey?: string | null;
  alipaySignType?: string | null;
  alipayGateway?: string | null;
  hasAlipayPrivateKey?: boolean;
  // 云闪付（银联全渠道）
  unionpayMerId?: string | null;
  unionpayCertId?: string | null;
  unionpayPublicKey?: string | null;
  unionpayGateway?: string | null;
  hasUnionpayPrivateKey?: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrder {
  id: number;
  orderNo: string;
  outTradeNo: string;
  channelTradeNo?: string | null;
  bizType: string;
  bizId: string;
  subject: string;
  body?: string | null;
  amount: number; // 分
  currency: string;
  channel: PaymentChannel;
  channelConfigId?: number | null;
  payMethod: PaymentMethod;
  status: PaymentOrderStatus;
  userId?: number | null;
  openId?: string | null;
  clientIp?: string | null;
  departmentId?: number | null;
  paidAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  /** 优惠前原价（分），null=无优惠 */
  originalAmount?: number | null;
  /** 优惠立减金额（分） */
  discountAmount?: number | null;
  /** 支付使用的会员券 id */
  memberCouponId?: number | null;
  paidAt?: string | null;
  expiredAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRefund {
  id: number;
  refundNo: string;
  outRefundNo: string;
  orderNo: string;
  orderId?: number | null;
  channelRefundNo?: string | null;
  channel: PaymentChannel;
  refundAmount: number; // 分
  totalAmount: number; // 分
  reason?: string | null;
  status: PaymentRefundStatus;
  approvalStatus: PaymentRefundApprovalStatus;
  appliedById?: number | null;
  approverId?: number | null;
  approvedAt?: string | null;
  approvalRemark?: string | null;
  operatorId?: number | null;
  refundedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReconBatch {
  id: number;
  batchNo: string;
  channel: PaymentChannel;
  billDate: string;
  status: PaymentReconStatus;
  localCount: number;
  localAmount: number;
  channelCount: number;
  channelAmount: number;
  matchedCount: number;
  diffCount: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReconItem {
  id: number;
  batchId: number;
  orderNo?: string | null;
  channelTradeNo?: string | null;
  localAmount?: number | null;
  channelAmount?: number | null;
  localStatus?: string | null;
  channelStatus?: string | null;
  result: PaymentReconResult;
  /** 差异处理状态：null=无需处理（一致项） */
  handleStatus?: PaymentReconHandleStatus | null;
  handleRemark?: string | null;
  handledAt?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface PaymentWebhookEndpoint {
  id: number;
  name: string;
  url: string;
  bizType?: string | null;
  events: string[];
  status: 'enabled' | 'disabled';
  hasSecret?: boolean;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentWebhookDelivery {
  id: number;
  endpointId: number;
  endpointName?: string | null;
  eventType: string;
  orderNo?: string | null;
  payload?: string | null;
  status: PaymentWebhookDeliveryStatus;
  attempts: number;
  httpStatus?: number | null;
  responseBody?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentLedgerEntry {
  id: number;
  entryNo: string;
  direction: PaymentLedgerDirection;
  type: PaymentLedgerType;
  amount: number;
  orderNo?: string | null;
  refundNo?: string | null;
  channel?: PaymentChannel | null;
  bizType?: string | null;
  remark?: string | null;
  createdAt: string;
}

export interface PaymentLedgerSummary {
  inAmount: number;
  outAmount: number;
  netAmount: number;
  count: number;
}

export interface PaymentOutboxEvent {
  id: number;
  type: string;
  orderNo: string;
  status: 'pending' | 'done' | 'failed';
  attempts: number;
  /** 事件载荷 JSON（投递给订阅者/Webhook 的内容），运营排障用 */
  payload?: string | null;
  lastError?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

// ─── 支付中心扩展 · B 档 ──────────────────────────────────────────────────────
export interface PaymentFeeRule {
  id: number;
  name: string;
  channel: PaymentChannel;
  payMethod?: PaymentMethod | null;
  rateBps: number; // 万分比
  fixedFee: number; // 分
  minFee?: number | null; // 分
  maxFee?: number | null; // 分
  status: 'enabled' | 'disabled';
  priority: number;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSettlementBatch {
  id: number;
  batchNo: string;
  channel: PaymentChannel;
  periodStart: string;
  periodEnd: string;
  status: PaymentSettlementStatus;
  orderCount: number;
  grossAmount: number; // 分
  feeAmount: number; // 分
  refundAmount: number; // 分
  netAmount: number; // 分
  settledAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSharingReceiver {
  id: number;
  name: string;
  receiverType: PaymentSharingReceiverType;
  account: string;
  ratioBps?: number | null; // 万分比
  /** 自动分账：支付成功后按 ratioBps 自动发起分账 */
  autoShare: boolean;
  status: 'enabled' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSharingOrder {
  id: number;
  sharingNo: string;
  orderNo: string;
  receiverId: number;
  receiverName?: string | null;
  amount: number; // 分
  status: PaymentSharingOrderStatus;
  channelSharingNo?: string | null;
  finishedAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransfer {
  id: number;
  transferNo: string;
  outTransferNo: string;
  channel: PaymentChannel;
  receiverAccount: string;
  receiverName?: string | null;
  amount: number; // 分
  remark?: string | null;
  status: PaymentTransferStatus;
  channelTransferNo?: string | null;
  failReason?: string | null;
  attempts: number;
  bizType?: string | null;
  bizId?: string | null;
  finishedAt?: string | null;
  operatorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentApp {
  id: number;
  name: string;
  appKey: string;
  status: 'enabled' | 'disabled';
  wechatConfigId?: number | null;
  wechatConfigName?: string | null;
  alipayConfigId?: number | null;
  alipayConfigName?: string | null;
  unionpayConfigId?: number | null;
  unionpayConfigName?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDeductPlan {
  id: number;
  name: string;
  period: PaymentDeductPeriod;
  customDays?: number | null;
  amount: number; // 分
  maxRetries: number;
  status: 'enabled' | 'disabled';
  remark?: string | null;
  /** 引用本计划的协议数（列表页展示/删除预检） */
  contractCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentContract {
  id: number;
  contractNo: string;
  channel: PaymentChannel;
  channelConfigId?: number | null;
  planId: number;
  planName?: string | null;
  planPeriod?: PaymentDeductPeriod | null;
  planAmount?: number | null; // 分
  signerAccount: string;
  signerName?: string | null;
  status: PaymentContractStatus;
  channelContractNo?: string | null;
  bizType: string;
  bizId: string;
  nextDeductAt?: string | null;
  lastDeductAt?: string | null;
  failCount: number;
  totalDeductCount: number;
  lastOrderNo?: string | null;
  signedAt?: string | null;
  terminatedAt?: string | null;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 交易投诉/争议工单 */
export interface PaymentDispute {
  id: number;
  disputeNo: string;
  channelDisputeNo?: string | null;
  channel: PaymentChannel;
  orderNo: string;
  complainant?: string | null;
  complainantPhone?: string | null;
  type: PaymentDisputeType;
  content: string;
  amount: number; // 分
  status: PaymentDisputeStatus;
  deadline?: string | null;
  /** 是否已超时（未完结且已过处理时效） */
  overdue: boolean;
  refundNo?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDisputeReply {
  id: number;
  author: 'merchant' | 'user' | 'system';
  content: string;
  operatorName?: string | null;
  createdAt: string;
}

export interface PaymentDisputeDetail extends PaymentDispute {
  replies: PaymentDisputeReply[];
  /** 关联订单摘要 */
  order?: { orderNo: string; subject: string; amount: number; status: PaymentOrderStatus; paidAt?: string | null } | null;
}

export interface PaymentDisputeStats {
  /** 未完结工单数 */
  open: number;
  /** 超时未完结工单数 */
  overdue: number;
  /** 近 30 天投诉单量 */
  last30dCount: number;
  /** 近 30 天投诉率（投诉数 / 成功订单数，百分比数值，如 1.25 表示 1.25%） */
  last30dRate: number;
  /** 平均处理时长（小时，仅统计已完结） */
  avgResolveHours: number;
}

export interface PaymentLink {
  id: number;
  linkNo: string;
  token: string;
  subject: string;
  amount?: number | null; // 分，null=用户填写
  payMethod?: PaymentMethod | null;
  bizType: string;
  maxUses?: number | null;
  usedCount: number;
  expiredAt?: string | null;
  status: PaymentLinkStatus;
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 支付链接公开视图（C 端展示，不含敏感/审计字段） */
export interface PaymentLinkPublic {
  token: string;
  subject: string;
  amount?: number | null; // 分
  payMethod?: PaymentMethod | null;
  bizType: string;
  status: PaymentLinkStatus;
  expiredAt?: string | null;
  remainingUses?: number | null;
}

export interface PaymentRiskRule {
  id: number;
  name: string;
  scope: PaymentRiskScope;
  channel?: PaymentChannel | null;
  bizType?: string | null;
  singleLimit?: number | null; // 分
  dailyLimit?: number | null; // 分
  dailyCountLimit?: number | null;
  /** 引用的黑名单库 key（规则中心名单库，type=black/grey），任一名单命中任一主体标识即触发动作 */
  blockListKeys: string[];
  /** 引用的白名单库 key（type=white），任一命中则跳过本规则全部检查 */
  allowListKeys: string[];
  /** 命中动作：block=直接拦截，review=挂起人工审核 */
  action: PaymentRiskAction;
  status: 'enabled' | 'disabled';
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 风控命中留痕 */
export interface PaymentRiskHit {
  id: number;
  ruleId?: number | null;
  ruleName: string;
  action: PaymentRiskAction;
  dimension: PaymentRiskDimension;
  dimensionValue?: string | null;
  channel: PaymentChannel;
  bizType: string;
  bizId: string;
  orderNo?: string | null;
  amount: number; // 分
  openId?: string | null;
  userId?: number | null;
  clientIp?: string | null;
  createdAt: string;
}

/** 人工审核单（review 动作挂起的可疑交易） */
export interface PaymentRiskReview {
  id: number;
  reviewNo: string;
  hitId?: number | null;
  orderNo: string;
  channel: PaymentChannel;
  bizType: string;
  bizId: string;
  amount: number; // 分
  reason: string;
  status: PaymentRiskReviewStatus;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewRemark?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 商户资金账户（渠道维度余额快照） */
export interface PaymentAccount {
  id: number;
  channel: PaymentChannel;
  pendingSettle: number; // 分，待结算
  available: number; // 分，可用
  frozen: number; // 分，冻结
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** 余额核对结果（快照 vs 流水聚合） */
export interface PaymentAccountCheckRow {
  channel: PaymentChannel;
  pendingSettleSnapshot: number;
  pendingSettleComputed: number;
  availableSnapshot: number;
  availableComputed: number;
  /** 冻结余额快照（口径：进行中预授权冻结金额之和） */
  frozenSnapshot: number;
  frozenComputed: number;
  match: boolean;
}

/** 预授权单（资金冻结/解冻/转支付） */
export interface PaymentPreauth {
  id: number;
  preauthNo: string;
  channel: PaymentChannel;
  channelConfigId?: number | null;
  channelPreauthNo?: string | null;
  bizType: string;
  bizId: string;
  subject: string;
  payerAccount: string;
  frozenAmount: number; // 分
  capturedAmount?: number | null; // 分
  captureOrderNo?: string | null;
  status: PaymentPreauthStatus;
  errorMessage?: string | null;
  frozenAt?: string | null;
  finishedAt?: string | null;
  remark?: string | null;
  operatorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodConfig {
  id: number;
  method: PaymentMethod;
  channel: PaymentChannel;
  label: string;
  icon?: string | null;
  enabled: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReportRow {
  key: string;
  label: string;
  gross: number; // 分
  fee: number; // 分
  refund: number; // 分
  net: number; // 分
  count: number;
}

export interface PaymentNotifyLog {
  id: number;
  channel: PaymentChannel;
  scene: string;
  orderNo?: string | null;
  signatureValid: boolean;
  result?: string | null;
  message?: string | null;
  ip?: string | null;
  /** 原始回调 body（最多 8000 字节），用于排查验签/对账争议 */
  rawBody?: string | null;
  /** 回调请求头（JSON 字符串），用于排查验签/来源 */
  headers?: string | null;
  createdAt: string;
}

/** 支付统计概览（金额单位：分） */
export interface PaymentStats {
  /** 累计成功金额（分） */
  totalAmount: number;
  /** 今日成功金额（分） */
  todayAmount: number;
  /** 今日成功订单数 */
  todayCount: number;
  /** 订单总数 */
  orderCount: number;
  /** 成功订单数（含退款中/已退款） */
  successCount: number;
  /** 累计退款金额（分） */
  refundAmount: number;
  /** 退款笔数（成功） */
  refundCount: number;
  /** 支付成功率（0-100，保留 1 位小数） */
  successRate: number;
  /** 退款率（退款金额/成功金额，0-100） */
  refundRate: number;
  /** 成功订单笔均金额（分） */
  avgAmount: number;
  byChannel: { channel: string; count: number; amount: number }[];
  byStatus: { status: string; count: number }[];
}

/** 收款趋势单点（按天） */
export interface PaymentTrendPoint {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 当日成功金额（分） */
  amount: number;
  /** 当日成功订单数 */
  count: number;
  /** 当日退款金额（分） */
  refundAmount: number;
}

/** 下单返回给前端的支付参数（按支付方式不同而不同） */
export interface CreatePaymentResult {
  orderNo: string;
  payMethod: PaymentMethod;
  channel: PaymentChannel;
  /** 微信 native：二维码内容 */
  codeUrl?: string;
  /** 跳转链接（支付宝 page/wap、微信 h5） */
  payUrl?: string;
  /** 支付宝 page 可返回自动提交表单 HTML */
  formHtml?: string;
  /** 微信 JSAPI：调起支付所需参数 */
  jsapiParams?: Record<string, string>;
  /** APP 支付：客户端调起字符串 */
  appOrderStr?: string;
  expiredAt?: string;
}
