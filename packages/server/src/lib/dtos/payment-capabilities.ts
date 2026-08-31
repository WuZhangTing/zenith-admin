import { z } from '@hono/zod-openapi';

const capabilityReasonCode = z.enum([
  'ENGINE_OFF',
  'ENGINE_MODE_MISMATCH',
  'CONFIG_DISABLED',
  'ENVIRONMENT_UNSUPPORTED',
  'CONFIG_INCOMPLETE',
  'PAYMENT_METHOD_NOT_CONFIGURED',
  'PAYMENT_METHOD_DISABLED',
  'PAYMENT_METHOD_CHANNEL_MISMATCH',
  'PAYMENT_METHOD_UNSUPPORTED',
  'CURRENCY_UNSUPPORTED',
  'OPERATION_UNSUPPORTED',
]);

export const PaymentEffectiveCapabilityDTO = z.object({
  operation: z.string(),
  environment: z.enum(['sandbox', 'live']),
  declaredEnvironments: z.array(z.enum(['sandbox', 'live'])),
  paymentMethod: z.string().nullable(),
  currency: z.string(),
  execution: z.enum(['redirect', 'synchronous', 'asynchronous', 'local']).nullable(),
  limits: z.object({
    maxAmount: z.number().int().nullable(),
    receiverNameRequiredAtOrAbove: z.number().int().nullable(),
  }).nullable(),
  supported: z.boolean(),
  reasonCode: capabilityReasonCode.nullable(),
  reason: z.string().nullable(),
  missingConfigFields: z.array(z.string()),
}).openapi('PaymentEffectiveCapability');

export const PaymentConfigCapabilitiesDTO = z.object({
  channelConfigId: z.number().int(),
  tenantId: z.number().int().nullable(),
  configName: z.string(),
  channel: z.enum(['wechat', 'alipay', 'unionpay']),
  environment: z.enum(['sandbox', 'live']),
  configStatus: z.enum(['enabled', 'disabled']),
  providerName: z.string(),
  supported: z.boolean(),
  reason: z.string().nullable(),
  capabilities: z.array(PaymentEffectiveCapabilityDTO),
}).openapi('PaymentConfigCapabilities');

export const PaymentCapabilitiesResponseDTO = z.object({
  engineMode: z.enum(['off', 'sandbox', 'live']),
  configs: z.array(PaymentConfigCapabilitiesDTO),
}).openapi('PaymentCapabilitiesResponse');
