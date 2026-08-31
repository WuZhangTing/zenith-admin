import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { createPaymentSharingReceiverSchema, createPaymentSharingReversalSchema, PAYMENT_SHARING_REVERSAL_STATUSES, updatePaymentSharingReceiverSchema } from '@zenith/shared/payment';
import { authMiddleware } from '../../middleware/auth';
import { guard, setAuditBeforeData } from '../../middleware/guard';
import { idempotencyGuard } from '../../middleware/idempotency';
import { PaginationQuery, dateRangeBound, jsonContent, validationHook, commonErrorResponses, ok, okPaginated, okMsg, IdParam, okBody } from '../../lib/openapi-schemas';
import { PaymentSharingReceiverDTO, PaymentSharingOrderDTO, PaymentSharingReversalDTO } from '../../lib/openapi-dtos';
import {
  listReceivers,
  getReceiver,
  createReceiver,
  updateReceiver,
  deleteReceiver,
  listSharingOrders,
  dispatchSharing,
} from '../../services/payment/payment-sharing.service';
import {
  createSharingReversal,
  getSharingReversal,
  listSharingReversals,
  querySharingReversal,
} from '../../services/payment/payment-sharing-reversal.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const statusEnum = z.enum(['enabled', 'disabled']);
const sharingOrderStatusEnum = z.enum(['pending', 'processing', 'success', 'failed', 'reversed']);
const idempotencyHeaders = z.object({
  'x-idempotency-key': z.string().trim().min(8).max(128).openapi({
    param: { in: 'header' },
    example: 'sharing-reversal-01JABCDEF1234567890',
  }),
});

// ─── 接收方 CRUD ──────────────────────────────────────────────────────────────
const listReceiversRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/receivers', tags: ['支付中心-分账'], summary: '分账接收方列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional(), status: statusEnum.optional() }) },
    responses: { ...okPaginated(PaymentSharingReceiverDTO, '分账接收方列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listReceivers(c.req.valid('query'))), 200),
});

const receiverDetailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/receivers/{id}', tags: ['支付中心-分账'], summary: '分账接收方详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentSharingReceiverDTO, '分账接收方详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getReceiver(c.req.valid('param').id)), 200),
});

const createReceiverRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/receivers', tags: ['支付中心-分账'], summary: '新增分账接收方',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:manage', audit: { description: '新增分账接收方', module: '支付中心' } })] as const,
    request: { body: { content: jsonContent(createPaymentSharingReceiverSchema), required: true } },
    responses: { ...ok(PaymentSharingReceiverDTO, '创建成功'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createReceiver(c.req.valid('json')), '创建成功'), 200),
});

const updateReceiverRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'put', path: '/receivers/{id}', tags: ['支付中心-分账'], summary: '编辑分账接收方',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:manage', audit: { description: '编辑分账接收方', module: '支付中心' } })] as const,
    request: { params: IdParam, body: { content: jsonContent(updatePaymentSharingReceiverSchema), required: true } },
    responses: { ...ok(PaymentSharingReceiverDTO, '更新成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getReceiver(id));
    return c.json(okBody(await updateReceiver(id, c.req.valid('json')), '更新成功'), 200);
  },
});

const deleteReceiverRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'delete', path: '/receivers/{id}', tags: ['支付中心-分账'], summary: '删除分账接收方',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:manage', audit: { description: '删除分账接收方', module: '支付中心' } })] as const,
    request: { params: IdParam },
    responses: { ...okMsg('删除成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    setAuditBeforeData(c, await getReceiver(id));
    await deleteReceiver(id);
    return c.json(okBody(null, '删除成功'), 200);
  },
});

// ─── 分账单 ───────────────────────────────────────────────────────────────────
const listOrdersRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/orders', tags: ['支付中心-分账'], summary: '分账单列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:list' })] as const,
    request: { query: PaginationQuery.extend({ keyword: z.string().optional(), status: sharingOrderStatusEnum.optional(), receiverId: z.coerce.number().int().optional() }) },
    responses: { ...okPaginated(PaymentSharingOrderDTO, '分账单列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listSharingOrders(c.req.valid('query'))), 200),
});

const dispatchRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/orders', tags: ['支付中心-分账'], summary: '发起分账',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:dispatch', audit: { description: '发起支付分账', module: '支付中心' } })] as const,
    request: {
      body: { content: jsonContent(z.object({ orderNo: z.string().min(1).max(64), receiverId: z.number().int().positive(), amount: z.number().int().positive().optional(), remark: z.string().max(256).optional() })), required: true },
    },
    responses: { ...ok(PaymentSharingOrderDTO, '分账已发起'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await dispatchSharing(c.req.valid('json')), '分账已发起'), 200),
});

const reversalListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/reversals', tags: ['支付中心-分账'], summary: '分账冲正列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:list' })] as const,
    request: { query: PaginationQuery.extend({
      sharingOrderId: z.coerce.number().int().positive().optional(),
      status: z.enum(PAYMENT_SHARING_REVERSAL_STATUSES).optional(),
      startTime: dateRangeBound('起始时间'),
      endTime: dateRangeBound('结束时间'),
    }) },
    responses: { ...okPaginated(PaymentSharingReversalDTO, '分账冲正列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listSharingReversals(c.req.valid('query'))), 200),
});

const reversalDetailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/reversals/{id}', tags: ['支付中心-分账'], summary: '分账冲正详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentSharingReversalDTO, '分账冲正详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getSharingReversal(c.req.valid('param').id)), 200),
});

const reversalCreateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/orders/{id}/reverse', tags: ['支付中心-分账'], summary: '发起分账冲正',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      idempotencyGuard({ ttlSeconds: 15, message: '分账冲正处理中，请勿重复提交' }),
      guard({ permission: 'payment:sharing:dispatch', audit: { description: '发起支付分账冲正', module: '支付中心' } }),
    ] as const,
    request: { params: IdParam, headers: idempotencyHeaders, body: { content: jsonContent(createPaymentSharingReversalSchema), required: true } },
    responses: { ...ok(PaymentSharingReversalDTO, '冲正已受理'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createSharingReversal({
    sharingOrderId: c.req.valid('param').id,
    idempotencyKey: c.req.valid('header')['x-idempotency-key'],
    reason: c.req.valid('json').reason,
  }), '冲正已受理'), 200),
});

const reversalQueryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/reversals/{id}/query', tags: ['支付中心-分账'], summary: '查询分账冲正结果',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:sharing:dispatch', audit: { description: '查询支付分账冲正', module: '支付中心' } })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentSharingReversalDTO, '查单完成'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await querySharingReversal(c.req.valid('param').id), '查单完成'), 200),
});

router.openapiRoutes([
  listReceiversRoute,
  receiverDetailRoute,
  createReceiverRoute,
  updateReceiverRoute,
  deleteReceiverRoute,
  listOrdersRoute,
  dispatchRoute,
  reversalListRoute,
  reversalCreateRoute,
  reversalQueryRoute,
  reversalDetailRoute,
] as const);

export default router;
