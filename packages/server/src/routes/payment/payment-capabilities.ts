import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { PAYMENT_CHANNELS, PAYMENT_METHODS } from '@zenith/shared/payment';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { commonErrorResponses, ok, okBody, validationHook } from '../../lib/openapi-schemas';
import { PaymentCapabilitiesResponseDTO } from '../../lib/openapi-dtos';
import {
  listEffectivePaymentCapabilities,
  PAYMENT_PROVIDER_OPERATIONS,
} from '../../services/payment/payment-capability.service';

const router = new OpenAPIHono({ defaultHook: validationHook });

const capabilityRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get',
    path: '/',
    tags: ['支付中心-渠道能力'],
    summary: '查询支付渠道有效能力',
    description: '返回适配器声明能力与当前商户配置、运行模式、支付方式启停的交集，并给出不可用原因。',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:channel:list' })] as const,
    request: {
      query: z.object({
        channelConfigId: z.coerce.number().int().positive().optional(),
        channel: z.enum(PAYMENT_CHANNELS).optional(),
        operation: z.enum(PAYMENT_PROVIDER_OPERATIONS).optional(),
        method: z.enum(PAYMENT_METHODS).optional(),
        currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
      }),
    },
    responses: { ...ok(PaymentCapabilitiesResponseDTO, '支付渠道有效能力'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listEffectivePaymentCapabilities(c.req.valid('query'))), 200),
});

router.openapiRoutes([capabilityRoute] as const);

export default router;
