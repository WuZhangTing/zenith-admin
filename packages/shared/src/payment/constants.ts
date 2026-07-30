// ─── 支付中心 ────────────────────────────────────────────────────────
export const PAYMENT_CHANNELS = ['wechat', 'alipay', 'unionpay'] as const;

export type PaymentChannel = typeof PAYMENT_CHANNELS[number];

export const PAYMENT_METHODS = [
  'wechat_native', 'wechat_jsapi', 'wechat_h5',
  'alipay_page', 'alipay_wap', 'alipay_app',
  'unionpay_qr',
  'wechat_papay', 'alipay_cycle',
  'wechat_preauth', 'alipay_preauth',
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const PAYMENT_ORDER_STATUSES = ['pending', 'paying', 'success', 'closed', 'refunding', 'refunded', 'failed'] as const;

export type PaymentOrderStatus = typeof PAYMENT_ORDER_STATUSES[number];

export const PAYMENT_REFUND_STATUSES = ['pending', 'processing', 'success', 'failed'] as const;

export type PaymentRefundStatus = typeof PAYMENT_REFUND_STATUSES[number];

/** 各支付方式所属渠道映射 */
export const PAYMENT_METHOD_CHANNEL: Record<PaymentMethod, PaymentChannel> = {
  wechat_native: 'wechat',
  wechat_jsapi: 'wechat',
  wechat_h5: 'wechat',
  alipay_page: 'alipay',
  alipay_wap: 'alipay',
  alipay_app: 'alipay',
  unionpay_qr: 'unionpay',
  wechat_papay: 'wechat',
  alipay_cycle: 'alipay',
  wechat_preauth: 'wechat',
  alipay_preauth: 'alipay',
};

export const PAYMENT_CHANNEL_LABELS: Record<PaymentChannel, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  unionpay: '云闪付',
};

/** 支付渠道下拉选项（筛选/表单统一复用，与 PAYMENT_CHANNEL_LABELS 自动同步） */
export const PAYMENT_CHANNEL_OPTIONS: Array<{ value: PaymentChannel; label: string }> =
  PAYMENT_CHANNELS.map((value) => ({ value, label: PAYMENT_CHANNEL_LABELS[value] }));

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wechat_native: '微信扫码',
  wechat_jsapi: '微信 JSAPI',
  wechat_h5: '微信 H5',
  alipay_page: '支付宝电脑网站',
  alipay_wap: '支付宝手机网站',
  alipay_app: '支付宝 APP',
  unionpay_qr: '云闪付扫码',
  wechat_papay: '微信委托代扣',
  alipay_cycle: '支付宝周期扣款',
  wechat_preauth: '微信预授权转支付',
  alipay_preauth: '支付宝预授权转支付',
};

export const PAYMENT_ORDER_STATUS_LABELS: Record<PaymentOrderStatus, string> = {
  pending: '待支付',
  paying: '支付中',
  success: '支付成功',
  closed: '已关闭',
  refunding: '退款中',
  refunded: '已退款',
  failed: '支付失败',
};

export const PAYMENT_REFUND_STATUS_LABELS: Record<PaymentRefundStatus, string> = {
  pending: '待处理',
  processing: '退款中',
  success: '退款成功',
  failed: '退款失败',
};

// ─── 支付中心扩展 · A 档（退款审批 / 对账 / Webhook / 资金台账）────────────────
export const PAYMENT_REFUND_APPROVAL_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;

export type PaymentRefundApprovalStatus = typeof PAYMENT_REFUND_APPROVAL_STATUSES[number];

export const PAYMENT_REFUND_APPROVAL_STATUS_LABELS: Record<PaymentRefundApprovalStatus, string> = {
  none: '无需审批', pending: '待审批', approved: '已批准', rejected: '已驳回',
};

export const PAYMENT_RECON_STATUSES = ['pending', 'comparing', 'done', 'failed'] as const;

export type PaymentReconStatus = typeof PAYMENT_RECON_STATUSES[number];

export const PAYMENT_RECON_STATUS_LABELS: Record<PaymentReconStatus, string> = {
  pending: '待对账', comparing: '比对中', done: '已完成', failed: '失败',
};

export const PAYMENT_RECON_RESULTS = ['matched', 'local_only', 'channel_only', 'amount_diff', 'status_diff'] as const;

export type PaymentReconResult = typeof PAYMENT_RECON_RESULTS[number];

export const PAYMENT_RECON_RESULT_LABELS: Record<PaymentReconResult, string> = {
  matched: '一致', local_only: '本地有渠道无', channel_only: '渠道有本地无', amount_diff: '金额不一致', status_diff: '状态不一致',
};

export const PAYMENT_RECON_HANDLE_STATUSES = ['pending', 'adjusted', 'suspended', 'ignored'] as const;

export type PaymentReconHandleStatus = typeof PAYMENT_RECON_HANDLE_STATUSES[number];

export const PAYMENT_RECON_HANDLE_STATUS_LABELS: Record<PaymentReconHandleStatus, string> = {
  pending: '待处理', adjusted: '已调账', suspended: '挂账', ignored: '已忽略',
};

export const PAYMENT_WEBHOOK_DELIVERY_STATUSES = ['pending', 'success', 'failed'] as const;

export type PaymentWebhookDeliveryStatus = typeof PAYMENT_WEBHOOK_DELIVERY_STATUSES[number];

export const PAYMENT_WEBHOOK_DELIVERY_STATUS_LABELS: Record<PaymentWebhookDeliveryStatus, string> = {
  pending: '待投递', success: '成功', failed: '失败',
};

export const PAYMENT_LEDGER_DIRECTIONS = ['in', 'out'] as const;

export type PaymentLedgerDirection = typeof PAYMENT_LEDGER_DIRECTIONS[number];

export const PAYMENT_LEDGER_DIRECTION_LABELS: Record<PaymentLedgerDirection, string> = {
  in: '收入', out: '支出',
};

export const PAYMENT_LEDGER_TYPES = ['payment', 'refund', 'fee', 'settlement', 'adjust', 'transfer'] as const;

export type PaymentLedgerType = typeof PAYMENT_LEDGER_TYPES[number];

export const PAYMENT_LEDGER_TYPE_LABELS: Record<PaymentLedgerType, string> = {
  payment: '收款', refund: '退款', fee: '手续费', settlement: '结算', adjust: '调整', transfer: '转账',
};

// ─── 支付中心扩展 · B 档（费率 / 结算 / 分账 / 支付链接 / 风控 / 支付方式 / 报表）──
export const PAYMENT_SETTLEMENT_STATUSES = ['pending', 'settling', 'settled', 'failed'] as const;

export type PaymentSettlementStatus = typeof PAYMENT_SETTLEMENT_STATUSES[number];

export const PAYMENT_SETTLEMENT_STATUS_LABELS: Record<PaymentSettlementStatus, string> = {
  pending: '待结算', settling: '结算中', settled: '已结算', failed: '结算失败',
};

export const PAYMENT_SHARING_RECEIVER_TYPES = ['merchant', 'personal'] as const;

export type PaymentSharingReceiverType = typeof PAYMENT_SHARING_RECEIVER_TYPES[number];

export const PAYMENT_SHARING_RECEIVER_TYPE_LABELS: Record<PaymentSharingReceiverType, string> = {
  merchant: '商户', personal: '个人',
};

export const PAYMENT_SHARING_ORDER_STATUSES = ['pending', 'processing', 'success', 'failed'] as const;

export type PaymentSharingOrderStatus = typeof PAYMENT_SHARING_ORDER_STATUSES[number];

export const PAYMENT_SHARING_ORDER_STATUS_LABELS: Record<PaymentSharingOrderStatus, string> = {
  pending: '待分账', processing: '分账中', success: '分账成功', failed: '分账失败',
};

export const PAYMENT_LINK_STATUSES = ['active', 'disabled', 'expired'] as const;

export type PaymentLinkStatus = typeof PAYMENT_LINK_STATUSES[number];

export const PAYMENT_LINK_STATUS_LABELS: Record<PaymentLinkStatus, string> = {
  active: '生效中', disabled: '已停用', expired: '已过期',
};

export const PAYMENT_RISK_SCOPES = ['global', 'channel', 'bizType'] as const;

export type PaymentRiskScope = typeof PAYMENT_RISK_SCOPES[number];

export const PAYMENT_RISK_SCOPE_LABELS: Record<PaymentRiskScope, string> = {
  global: '全局', channel: '按渠道', bizType: '按业务类型',
};

export const PAYMENT_RISK_ACTIONS = ['block', 'review'] as const;

export type PaymentRiskAction = typeof PAYMENT_RISK_ACTIONS[number];

export const PAYMENT_RISK_ACTION_LABELS: Record<PaymentRiskAction, string> = {
  block: '直接拦截', review: '人工审核',
};

export const PAYMENT_RISK_DIMENSIONS = ['blocklist', 'single_limit', 'daily_limit', 'daily_count'] as const;

export type PaymentRiskDimension = typeof PAYMENT_RISK_DIMENSIONS[number];

export const PAYMENT_RISK_DIMENSION_LABELS: Record<PaymentRiskDimension, string> = {
  blocklist: '黑名单', single_limit: '单笔限额', daily_limit: '当日累计金额', daily_count: '当日交易笔数',
};

export const PAYMENT_RISK_REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type PaymentRiskReviewStatus = typeof PAYMENT_RISK_REVIEW_STATUSES[number];

export const PAYMENT_RISK_REVIEW_STATUS_LABELS: Record<PaymentRiskReviewStatus, string> = {
  pending: '待审核', approved: '已放行', rejected: '已拒绝',
};

export const PAYMENT_TRANSFER_STATUSES = ['pending', 'processing', 'success', 'failed'] as const;

export type PaymentTransferStatus = typeof PAYMENT_TRANSFER_STATUSES[number];

export const PAYMENT_TRANSFER_STATUS_LABELS: Record<PaymentTransferStatus, string> = {
  pending: '待发起', processing: '处理中', success: '转账成功', failed: '转账失败',
};

export const PAYMENT_REPORT_GROUP_BYS = ['bizType', 'channel', 'day'] as const;

export type PaymentReportGroupBy = typeof PAYMENT_REPORT_GROUP_BYS[number];

export const PAYMENT_REPORT_GROUP_BY_LABELS: Record<PaymentReportGroupBy, string> = {
  bizType: '业务类型', channel: '支付渠道', day: '按日',
};

// ─── 支付中心扩展 · 签约代扣（周期扣款/订阅）───────────────────────────
export const PAYMENT_DEDUCT_PERIODS = ['daily', 'weekly', 'monthly', 'custom'] as const;

export type PaymentDeductPeriod = typeof PAYMENT_DEDUCT_PERIODS[number];

export const PAYMENT_DEDUCT_PERIOD_LABELS: Record<PaymentDeductPeriod, string> = {
  daily: '每日', weekly: '每周', monthly: '每月', custom: '自定义天数',
};

export const PAYMENT_DEDUCT_PERIOD_OPTIONS: Array<{ value: PaymentDeductPeriod; label: string }> =
  PAYMENT_DEDUCT_PERIODS.map((value) => ({ value, label: PAYMENT_DEDUCT_PERIOD_LABELS[value] }));

export const PAYMENT_CONTRACT_STATUSES = ['pending', 'signed', 'paused', 'terminated'] as const;

export type PaymentContractStatus = typeof PAYMENT_CONTRACT_STATUSES[number];

export const PAYMENT_CONTRACT_STATUS_LABELS: Record<PaymentContractStatus, string> = {
  pending: '签约中', signed: '已签约', paused: '已暂停', terminated: '已解约',
};

/** 支持签约代扣的支付方式（服务端发起扣款，无用户交互） */
export const PAYMENT_DEDUCT_METHODS = ['wechat_papay', 'alipay_cycle'] as const satisfies readonly PaymentMethod[];

export type PaymentDeductMethod = typeof PAYMENT_DEDUCT_METHODS[number];

/** 收银台可选支付方式（用户主动支付，不含服务端发起的签约代扣方式） */
export const PAYMENT_CASHIER_METHODS = [
  'wechat_native', 'wechat_jsapi', 'wechat_h5',
  'alipay_page', 'alipay_wap', 'alipay_app',
  'unionpay_qr',
] as const satisfies readonly PaymentMethod[];

export type PaymentCashierMethod = typeof PAYMENT_CASHIER_METHODS[number];

// ─── 支付中心扩展 · 交易投诉/争议 ─────────────────────────────────────
export const PAYMENT_DISPUTE_TYPES = ['refund_request', 'service_issue', 'fraud_report', 'other'] as const;

export type PaymentDisputeType = typeof PAYMENT_DISPUTE_TYPES[number];

export const PAYMENT_DISPUTE_TYPE_LABELS: Record<PaymentDisputeType, string> = {
  refund_request: '退款诉求', service_issue: '服务问题', fraud_report: '欺诈举报', other: '其他',
};

export const PAYMENT_DISPUTE_TYPE_OPTIONS: Array<{ value: PaymentDisputeType; label: string }> =
  PAYMENT_DISPUTE_TYPES.map((value) => ({ value, label: PAYMENT_DISPUTE_TYPE_LABELS[value] }));

export const PAYMENT_DISPUTE_STATUSES = ['pending', 'processing', 'resolved', 'refunded'] as const;

export type PaymentDisputeStatus = typeof PAYMENT_DISPUTE_STATUSES[number];

export const PAYMENT_DISPUTE_STATUS_LABELS: Record<PaymentDisputeStatus, string> = {
  pending: '待处理', processing: '处理中', resolved: '已完结', refunded: '已退款',
};

export const PAYMENT_DISPUTE_STATUS_OPTIONS: Array<{ value: PaymentDisputeStatus; label: string }> =
  PAYMENT_DISPUTE_STATUSES.map((value) => ({ value, label: PAYMENT_DISPUTE_STATUS_LABELS[value] }));

// ─── 支付中心扩展 · 预授权（资金冻结/解冻/转支付）────────────────────
export const PAYMENT_PREAUTH_STATUSES = ['pending', 'frozen', 'captured', 'released', 'failed'] as const;

export type PaymentPreauthStatus = typeof PAYMENT_PREAUTH_STATUSES[number];

export const PAYMENT_PREAUTH_STATUS_LABELS: Record<PaymentPreauthStatus, string> = {
  pending: '冻结中', frozen: '已冻结', captured: '已转支付', released: '已解冻', failed: '冻结失败',
};

export const PAYMENT_PREAUTH_STATUS_OPTIONS: Array<{ value: PaymentPreauthStatus; label: string }> =
  PAYMENT_PREAUTH_STATUSES.map((value) => ({ value, label: PAYMENT_PREAUTH_STATUS_LABELS[value] }));

/** 预授权支持的支付方式（渠道映射用） */
export const PAYMENT_PREAUTH_METHODS = ['wechat_preauth', 'alipay_preauth'] as const satisfies readonly PaymentMethod[];

export type PaymentPreauthMethod = typeof PAYMENT_PREAUTH_METHODS[number];
