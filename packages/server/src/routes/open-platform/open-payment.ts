/** 支付开放 API：全部租户与应用上下文来自 openPrincipal。 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  createOpenPaymentIntentSchema,
  createOpenPaymentRefundSchema,
} from '@zenith/shared/payment';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  commonErrorResponses,
  jsonContent,
  ok,
  okBody,
  validationHook,
} from '../../lib/openapi-schemas';
import {
  OpenPaymentApplicationCapabilitiesDTO,
  OpenPaymentIntentCreatedDTO,
  OpenPaymentIntentDTO,
  OpenPaymentRefundDTO,
} from '../../lib/openapi-dtos';
import { idempotencyGuard } from '../../middleware/idempotency';
import {
  requireOpenScope,
  requireOpenSignatureChannel,
  type OpenPrincipal,
} from '../../middleware/open-gateway';
import { getClientIp } from '../../lib/request-helpers';
import {
  createOpenPaymentIntent,
  createOpenPaymentRefund,
  getOpenPaymentCapabilities,
  getOpenPaymentIntent,
  getOpenPaymentRefund,
} from '../../services/payment/payment-open.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const IdempotencyHeaders = z.object({
  'x-idempotency-key': z.string().trim().min(8).max(128).openapi({
    param: { in: 'header' },
    example: 'pay-01JABCDEF1234567890',
  }),
});

const OrderNoParam = z.object({
  orderNo: z.string().min(1).max(64).openapi({ param: { name: 'orderNo', in: 'path' } }),
});

const RefundNoParam = z.object({
  refundNo: z.string().min(1).max(64).openapi({ param: { name: 'refundNo', in: 'path' } }),
});

function principalOf(c: Context): OpenPrincipal {
  const principal = c.get('openPrincipal');
  if (!principal) throw new HTTPException(401, { message: '缺少有效的开放应用身份' });
  return principal;
}

const createIntentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/payments/intents',
    tags: ['开放API-支付'],
    summary: '创建支付意图',
    middleware: [
      requireOpenSignatureChannel,
      requireOpenScope('payment:intent:create'),
      idempotencyGuard({ ttlSeconds: 300, autoFingerprint: false }),
    ] as const,
    request: {
      headers: IdempotencyHeaders,
      body: { content: jsonContent(createOpenPaymentIntentSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(OpenPaymentIntentCreatedDTO, '支付意图已创建') },
  }),
  handler: async (c) => c.json(okBody(await createOpenPaymentIntent({
    principal: principalOf(c),
    data: c.req.valid('json'),
    idempotencyKey: c.req.valid('header')['x-idempotency-key'],
    clientIp: getClientIp(c),
  }), '支付意图已创建'), 200),
});

const getIntentRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/payments/intents/{orderNo}',
    tags: ['开放API-支付'],
    summary: '读取支付意图',
    middleware: [requireOpenScope('payment:intent:read')] as const,
    request: { params: OrderNoParam },
    responses: { ...commonErrorResponses, ...ok(OpenPaymentIntentDTO, '支付意图') },
  }),
  handler: async (c) => c.json(okBody(await getOpenPaymentIntent(
    principalOf(c),
    c.req.valid('param').orderNo,
  )), 200),
});

const createRefundRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post',
    path: '/payments/refunds',
    tags: ['开放API-支付'],
    summary: '创建退款',
    middleware: [
      requireOpenSignatureChannel,
      requireOpenScope('payment:refund:create'),
      idempotencyGuard({ ttlSeconds: 300, autoFingerprint: false }),
    ] as const,
    request: {
      headers: IdempotencyHeaders,
      body: { content: jsonContent(createOpenPaymentRefundSchema), required: true },
    },
    responses: { ...commonErrorResponses, ...ok(OpenPaymentRefundDTO, '退款已受理') },
  }),
  handler: async (c) => c.json(okBody(await createOpenPaymentRefund({
    principal: principalOf(c),
    data: c.req.valid('json'),
    idempotencyKey: c.req.valid('header')['x-idempotency-key'],
  }), '退款已受理'), 200),
});

const getRefundRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/payments/refunds/{refundNo}',
    tags: ['开放API-支付'],
    summary: '读取退款',
    middleware: [requireOpenScope('payment:refund:read')] as const,
    request: { params: RefundNoParam },
    responses: { ...commonErrorResponses, ...ok(OpenPaymentRefundDTO, '退款') },
  }),
  handler: async (c) => c.json(okBody(await getOpenPaymentRefund(
    principalOf(c),
    c.req.valid('param').refundNo,
  )), 200),
});

const capabilitiesRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/payments/capabilities',
    tags: ['开放API-支付'],
    summary: '读取当前应用支付能力',
    middleware: [requireOpenScope('payment:intent:read')] as const,
    responses: { ...commonErrorResponses, ...ok(OpenPaymentApplicationCapabilitiesDTO, '应用支付能力') },
  }),
  handler: async (c) => c.json(okBody(await getOpenPaymentCapabilities(principalOf(c))), 200),
});

const OPEN_PAYMENT_ROUTES = [
  createIntentRoute,
  getIntentRoute,
  createRefundRoute,
  getRefundRoute,
  capabilitiesRoute,
] as const;

router.openapiRoutes(OPEN_PAYMENT_ROUTES);

export const OPEN_PAYMENT_ENDPOINTS = OPEN_PAYMENT_ROUTES.map((item) => ({
  method: item.route.method.toUpperCase(),
  path: `/api/open/v1${item.route.path}`,
  summary: item.route.summary ?? '',
  scope: item.route.path.includes('/refunds')
    ? item.route.method === 'post' ? 'payment:refund:create' : 'payment:refund:read'
    : item.route.method === 'post' ? 'payment:intent:create' : 'payment:intent:read',
}));

export default router;
