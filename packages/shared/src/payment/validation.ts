import { z } from 'zod';
import { partialForUpdate } from '../core/validation';

// ─── 支付中心 ────────────────────────────────────────────────────────
export const createPaymentChannelConfigSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(64),
  channel: z.enum(['wechat', 'alipay', 'unionpay']),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  isDefault: z.boolean().default(false),
  sandbox: z.boolean().default(false),
  notifyUrl: z.string().max(512).optional(),
  // 微信（明文入参，service 层加密后入库）
  wechatAppId: z.string().max(64).optional(),
  wechatMchId: z.string().max(64).optional(),
  wechatApiV3Key: z.string().max(128).optional(),
  wechatPrivateKey: z.string().optional(),
  wechatSerialNo: z.string().max(128).optional(),
  wechatPlatformCert: z.string().optional(),
  // 支付宝
  alipayAppId: z.string().max(64).optional(),
  alipayPrivateKey: z.string().optional(),
  alipayPublicKey: z.string().optional(),
  alipaySignType: z.enum(['RSA2', 'RSA']).default('RSA2'),
  alipayGateway: z.string().max(256).optional(),
  // 云闪付（银联全渠道）
  unionpayMerId: z.string().max(64).optional(),
  unionpayPrivateKey: z.string().optional(),
  unionpayCertId: z.string().max(64).optional(),
  unionpayPublicKey: z.string().optional(),
  unionpayGateway: z.string().max(256).optional(),
  remark: z.string().max(256).optional(),
});

// partial() 不会剥离 default：显式声明带默认值的字段为纯 optional，
// 否则部分更新（如仅改 notifyUrl）会把 sandbox/isDefault/status 静默重置为默认值
export const updatePaymentChannelConfigSchema = partialForUpdate(createPaymentChannelConfigSchema).extend({
  status: z.enum(['enabled', 'disabled']).optional(),
  isDefault: z.boolean().optional(),
  sandbox: z.boolean().optional(),
  alipaySignType: z.enum(['RSA2', 'RSA']).optional(),
});

/** 业务/后台发起支付下单 */
export const createPaymentSchema = z.object({
  bizType: z.string().min(1).max(64),
  bizId: z.string().min(1).max(128),
  subject: z.string().min(1).max(256),
  body: z.string().max(512).optional(),
  amount: z.number().int().positive('金额必须大于 0'), // 分
  payMethod: z.enum(['wechat_native', 'wechat_jsapi', 'wechat_h5', 'alipay_page', 'alipay_wap', 'alipay_app', 'unionpay_qr']),
  channelConfigId: z.number().int().positive().optional(),
  /** 按应用下单：路由到该应用绑定的渠道配置（与 channelConfigId 互斥，appKey 优先） */
  appKey: z.string().max(64).optional(),
  openId: z.string().max(128).optional(),
  userId: z.number().int().positive().optional(),
  expireMinutes: z.number().int().positive().max(1440).default(30),
});

/** 发起退款 */
export const createRefundSchema = z.object({
  orderNo: z.string().min(1).max(64),
  refundAmount: z.number().int().positive('退款金额必须大于 0'), // 分
  reason: z.string().max(256).optional(),
});

export type CreatePaymentChannelConfigInput = z.infer<typeof createPaymentChannelConfigSchema>;

export type UpdatePaymentChannelConfigInput = z.infer<typeof updatePaymentChannelConfigSchema>;

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export type CreateRefundInput = z.infer<typeof createRefundSchema>;

// ─── 支付中心扩展 · B 档（费率 / 分账 / 支付链接 / 风控 / 支付方式）──────────────
const paymentChannelZ = z.enum(['wechat', 'alipay', 'unionpay']);

const paymentMethodZ = z.enum(['wechat_native', 'wechat_jsapi', 'wechat_h5', 'alipay_page', 'alipay_wap', 'alipay_app', 'unionpay_qr']);

/** 手续费/费率规则 */
export const createPaymentFeeRuleSchema = z.object({
  name: z.string().min(1).max(64),
  channel: paymentChannelZ,
  payMethod: paymentMethodZ.optional(),
  rateBps: z.number().int().min(0).max(100000).default(0), // 万分比
  fixedFee: z.number().int().min(0).default(0), // 分
  minFee: z.number().int().min(0).optional(),
  maxFee: z.number().int().min(0).optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  priority: z.number().int().min(0).max(9999).default(0),
  remark: z.string().max(256).optional(),
});

export const updatePaymentFeeRuleSchema = partialForUpdate(createPaymentFeeRuleSchema);

/** 分账接收方 */
export const createPaymentSharingReceiverSchema = z.object({
  name: z.string().min(1).max(64),
  receiverType: z.enum(['merchant', 'personal']).default('merchant'),
  account: z.string().min(1).max(128),
  ratioBps: z.number().int().min(0).max(10000).optional(), // 万分比
  autoShare: z.boolean().default(false),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).optional(),
});

export const updatePaymentSharingReceiverSchema = partialForUpdate(createPaymentSharingReceiverSchema);

/** 对账差异处理 */
export const handlePaymentReconItemSchema = z.object({
  action: z.enum(['adjusted', 'suspended', 'ignored']),
  remark: z.string().max(256).optional(),
});

/** 转账/代付 */
export const createPaymentTransferSchema = z.object({
  channel: paymentChannelZ,
  channelConfigId: z.number().int().positive().optional(),
  receiverAccount: z.string().min(1).max(128),
  receiverName: z.string().max(64).optional(),
  amount: z.number().int().positive('转账金额必须大于 0'), // 分
  remark: z.string().max(256).optional(),
  bizType: z.string().max(64).optional(),
  bizId: z.string().max(128).optional(),
});

/** 支付应用（App 维度） */
export const createPaymentAppSchema = z.object({
  name: z.string().min(1).max(64),
  appKey: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'appKey 仅允许字母/数字/下划线/中划线'),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  wechatConfigId: z.number().int().positive().nullable().optional(),
  alipayConfigId: z.number().int().positive().nullable().optional(),
  unionpayConfigId: z.number().int().positive().nullable().optional(),
  remark: z.string().max(256).optional(),
});

export const updatePaymentAppSchema = partialForUpdate(createPaymentAppSchema);

/** 支付链接 */
export const createPaymentLinkSchema = z.object({
  subject: z.string().min(1).max(256),
  amount: z.number().int().positive().optional(), // 分，留空=用户填写
  payMethod: paymentMethodZ.optional(),
  bizType: z.string().min(1).max(64),
  maxUses: z.number().int().positive().optional(),
  expiredAt: z.string().max(32).optional(),
  status: z.enum(['active', 'disabled']).default('active'),
  remark: z.string().max(256).optional(),
});

export const updatePaymentLinkSchema = partialForUpdate(createPaymentLinkSchema);

/** 风控限额规则 */
export const createPaymentRiskRuleSchema = z.object({
  name: z.string().min(1).max(64),
  scope: z.enum(['global', 'channel', 'bizType']).default('global'),
  channel: paymentChannelZ.optional(),
  bizType: z.string().max(64).optional(),
  singleLimit: z.number().int().min(0).optional(), // 分
  dailyLimit: z.number().int().min(0).optional(), // 分
  dailyCountLimit: z.number().int().min(0).optional(),
  blockListKeys: z.array(z.string().min(1).max(64)).default([]),
  allowListKeys: z.array(z.string().min(1).max(64)).default([]),
  action: z.enum(['block', 'review']).default('block'),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).optional(),
});

// partial() 不剥离 default，显式覆盖带默认值字段为纯 optional（防部分更新静默重置）
export const updatePaymentRiskRuleSchema = partialForUpdate(createPaymentRiskRuleSchema).extend({
  scope: z.enum(['global', 'channel', 'bizType']).optional(),
  blockListKeys: z.array(z.string().min(1).max(64)).optional(),
  allowListKeys: z.array(z.string().min(1).max(64)).optional(),
  action: z.enum(['block', 'review']).optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

/** 人工审核处理 */
export const handlePaymentRiskReviewSchema = z.object({
  remark: z.string().max(256).optional(),
});

export type HandlePaymentRiskReviewInput = z.infer<typeof handlePaymentRiskReviewSchema>;

/** 资金账户人工调账（走台账 adjust 流水联动可用余额） */
export const adjustPaymentAccountSchema = z.object({
  channel: paymentChannelZ,
  direction: z.enum(['in', 'out']),
  amount: z.number().int().positive('调账金额必须大于 0'), // 分
  remark: z.string().max(200).optional(),
});

export type AdjustPaymentAccountInput = z.infer<typeof adjustPaymentAccountSchema>;

// ─── 预授权（资金冻结/解冻/转支付）───────────────────────────────────────────
export const createPaymentPreauthSchema = z.object({
  payMethod: z.enum(['wechat_preauth', 'alipay_preauth']),
  channelConfigId: z.number().int().positive().optional(),
  payerAccount: z.string().min(1, '付款人账号不能为空').max(128),
  subject: z.string().min(1, '冻结事由不能为空').max(256),
  frozenAmount: z.number().int().positive('冻结金额必须大于 0'), // 分
  bizType: z.string().max(64).optional(),
  remark: z.string().max(256).optional(),
});

export type CreatePaymentPreauthInput = z.infer<typeof createPaymentPreauthSchema>;

export const capturePaymentPreauthSchema = z.object({
  /** 转支付金额（分），留空 = 全额；不足冻结额的剩余部分自动解冻 */
  captureAmount: z.number().int().positive().optional(),
  remark: z.string().max(256).optional(),
});

export type CapturePaymentPreauthInput = z.infer<typeof capturePaymentPreauthSchema>;

/** 支付方式配置（仅更新展示/启停/排序） */
export const updatePaymentMethodConfigSchema = z.object({
  label: z.string().min(1).max(64).optional(),
  icon: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
  sort: z.number().int().min(0).max(9999).optional(),
});

// ─── 签约代扣（周期扣款/订阅）─────────────────────────────────────────────────
/** 扣款计划 */
export const createPaymentDeductPlanSchema = z.object({
  name: z.string().min(1, '计划名称不能为空').max(64),
  period: z.enum(['daily', 'weekly', 'monthly', 'custom']).default('monthly'),
  customDays: z.number().int().min(1).max(3650).nullable().optional(),
  amount: z.number().int().positive('每期扣款金额必须大于 0'), // 分
  maxRetries: z.number().int().min(0).max(10).default(3),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  remark: z.string().max(256).optional(),
}).refine((v) => v.period !== 'custom' || (v.customDays != null && v.customDays >= 1), {
  message: '自定义周期必须填写天数',
  path: ['customDays'],
});

export const updatePaymentDeductPlanSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  period: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  customDays: z.number().int().min(1).max(3650).nullable().optional(),
  amount: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
  remark: z.string().max(256).optional(),
});

/** 管理端创建签约协议（演示/测试用，sandbox 渠道即时签约生效） */
export const createPaymentContractSchema = z.object({
  planId: z.number().int().positive(),
  payMethod: z.enum(['wechat_papay', 'alipay_cycle']),
  channelConfigId: z.number().int().positive().optional(),
  signerAccount: z.string().min(1, '签约账号不能为空').max(128),
  signerName: z.string().max(64).optional(),
  remark: z.string().max(256).optional(),
  /** 签约成功后是否立即执行首期扣款 */
  firstDeductNow: z.boolean().default(true),
});

export type CreatePaymentDeductPlanInput = z.infer<typeof createPaymentDeductPlanSchema>;

export type UpdatePaymentDeductPlanInput = z.infer<typeof updatePaymentDeductPlanSchema>;

export type CreatePaymentContractInput = z.infer<typeof createPaymentContractSchema>;

// ─── 交易投诉/争议 ────────────────────────────────────────────────────────────
/** 商户回复投诉 */
export const replyPaymentDisputeSchema = z.object({
  content: z.string().min(1, '回复内容不能为空').max(1000),
});

/** 完结投诉 */
export const resolvePaymentDisputeSchema = z.object({
  remark: z.string().max(500).optional(),
});

/** 投诉发起退款（复用支付中心退款链路） */
export const refundPaymentDisputeSchema = z.object({
  refundAmount: z.number().int().positive().optional(), // 分，留空 = 全额（涉诉金额）
  reason: z.string().max(256).optional(),
});

export type ReplyPaymentDisputeInput = z.infer<typeof replyPaymentDisputeSchema>;

export type ResolvePaymentDisputeInput = z.infer<typeof resolvePaymentDisputeSchema>;

export type RefundPaymentDisputeInput = z.infer<typeof refundPaymentDisputeSchema>;

export type CreatePaymentFeeRuleInput = z.infer<typeof createPaymentFeeRuleSchema>;

export type UpdatePaymentFeeRuleInput = z.infer<typeof updatePaymentFeeRuleSchema>;

export type CreatePaymentSharingReceiverInput = z.infer<typeof createPaymentSharingReceiverSchema>;

export type UpdatePaymentSharingReceiverInput = z.infer<typeof updatePaymentSharingReceiverSchema>;

export type HandlePaymentReconItemInput = z.infer<typeof handlePaymentReconItemSchema>;

export type CreatePaymentTransferInput = z.infer<typeof createPaymentTransferSchema>;

export type CreatePaymentAppInput = z.infer<typeof createPaymentAppSchema>;

export type UpdatePaymentAppInput = z.infer<typeof updatePaymentAppSchema>;

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;

export type UpdatePaymentLinkInput = z.infer<typeof updatePaymentLinkSchema>;

export type CreatePaymentRiskRuleInput = z.infer<typeof createPaymentRiskRuleSchema>;

export type UpdatePaymentRiskRuleInput = z.infer<typeof updatePaymentRiskRuleSchema>;

export type UpdatePaymentMethodConfigInput = z.infer<typeof updatePaymentMethodConfigSchema>;

export const generateSelfSignedCertSchema = z.object({
  name: z.string().min(1).max(128),
  domain: z.string().min(1).max(256),
  days: z.number().int().min(1).max(3650).default(365),
  country: z.string().length(2).default('CN').optional(),
  organization: z.string().max(64).default('Organization').optional(),
  outputDir: z.string().max(500).optional(),
});

export type GenerateSelfSignedCertSchemaInput = z.infer<typeof generateSelfSignedCertSchema>;
