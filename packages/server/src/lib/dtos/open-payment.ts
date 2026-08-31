import { z } from '@hono/zod-openapi';
import { CreatePaymentResultDTO } from './payment';

const channel = z.enum(['wechat', 'alipay', 'unionpay']);
const payMethod = z.enum([
  'wechat_native', 'wechat_jsapi', 'wechat_h5',
  'alipay_page', 'alipay_wap', 'alipay_app', 'unionpay_qr',
  'wechat_papay', 'alipay_cycle', 'wechat_preauth', 'alipay_preauth',
]);

export const OpenPaymentIntentDTO = z.object({
  orderNo: z.string(),
  bizType: z.string(),
  bizId: z.string(),
  subject: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  channel,
  payMethod,
  status: z.enum(['pending', 'paying', 'unknown', 'success', 'closed', 'refunding', 'refunded', 'failed']),
  paidAmount: z.number().int().nullable(),
  paidAt: z.string().nullable(),
  expiredAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('OpenPaymentIntent');

export const OpenPaymentIntentCreatedDTO = z.object({
  intent: OpenPaymentIntentDTO,
  payParams: CreatePaymentResultDTO,
}).openapi('OpenPaymentIntentCreated');

export const OpenPaymentRefundDTO = z.object({
  refundNo: z.string(),
  orderNo: z.string(),
  refundAmount: z.number().int(),
  status: z.enum(['pending', 'processing', 'unknown', 'success', 'failed']),
  approvalStatus: z.enum(['none', 'pending', 'approved', 'rejected']),
  refundedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('OpenPaymentRefund');

export const OpenPaymentCapabilityDTO = z.object({
  channel,
  operation: z.string(),
  paymentMethod: payMethod.nullable(),
  currency: z.string(),
  execution: z.enum(['redirect', 'synchronous', 'asynchronous', 'local']).nullable(),
  limits: z.object({
    maxAmount: z.number().int().nullable(),
    receiverNameRequiredAtOrAbove: z.number().int().nullable(),
  }).nullable(),
  supported: z.boolean(),
  reasonCode: z.string().nullable(),
  reason: z.string().nullable(),
}).openapi('OpenPaymentCapability');

export const OpenPaymentApplicationCapabilitiesDTO = z.object({
  clientId: z.string(),
  environment: z.enum(['production', 'sandbox']),
  capabilities: z.array(OpenPaymentCapabilityDTO),
}).openapi('OpenPaymentApplicationCapabilities');
