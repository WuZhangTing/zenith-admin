/**
 * 转账/代付管理路由（/api/payment/transfers）。
 * 发起转账（微信零钱 / 支付宝账户）、四眼审批、查单同步、列表与汇总。
 */
import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import { approvePaymentTransferSchema, createPaymentTransferSchema } from '@zenith/shared/payment';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { idempotencyGuard } from '../../middleware/idempotency';
import { IdParam, PaginationQuery, commonErrorResponses, dateRangeBound, jsonContent, ok, okBody, okPaginated, validationHook } from '../../lib/openapi-schemas';
import { PaymentTransferDTO, PaymentTransferSummaryDTO } from '../../lib/openapi-dtos';
import {
  createTransfer,
  approveTransfer,
  getTransfer,
  getTransferSummary,
  listTransfers,
  rejectTransfer,
  syncTransferStatus,
} from '../../services/payment/payment-transfer.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const channelEnum = z.enum(['wechat', 'alipay', 'unionpay']);
const transferStatusEnum = z.enum(['pending', 'processing', 'unknown', 'success', 'failed']);
const transferApprovalStatusEnum = z.enum(['none', 'pending', 'approved', 'rejected']);
const idempotencyHeaders = z.object({
  'x-idempotency-key': z.string().trim().min(8).max(128).openapi({
    param: { name: 'X-Idempotency-Key', in: 'header' },
    example: 'transfer-01JABCDEF1234567890',
  }),
});

const listRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['支付中心-转账'], summary: '转账单列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:transfer:list' })] as const,
    request: {
      query: PaginationQuery.extend({
        keyword: z.string().optional(),
        channel: channelEnum.optional(),
        status: transferStatusEnum.optional(),
        approvalStatus: transferApprovalStatusEnum.optional(),
        startTime: dateRangeBound('起始时间'),
        endTime: dateRangeBound('结束时间'),
      }),
    },
    responses: { ...okPaginated(PaymentTransferDTO, '转账单列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listTransfers(c.req.valid('query'))), 200),
});

const summaryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/summary', tags: ['支付中心-转账'], summary: '转账汇总（成功金额/各状态笔数）',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:transfer:list' })] as const,
    request: { query: z.object({ channel: channelEnum.optional() }) },
    responses: { ...ok(PaymentTransferSummaryDTO, '转账汇总'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getTransferSummary(c.req.valid('query'))), 200),
});

const detailRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['支付中心-转账'], summary: '转账单详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:transfer:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentTransferDTO, '转账单详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getTransfer(c.req.valid('param').id)), 200),
});

const createTransferRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['支付中心-转账'], summary: '发起转账（微信零钱 / 支付宝账户）',
    description: '低于审批阈值时落单后同步调渠道执行；达到阈值时仅冻结资金并等待四眼审批，审批前不会调用渠道。资金流出接口，使用业务幂等键防止重复提交。',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      guard({ permission: 'payment:transfer:create', audit: { description: '发起转账', module: '支付中心' } }),
      idempotencyGuard({ ttlSeconds: 15 }),
    ] as const,
    request: { headers: idempotencyHeaders, body: { content: jsonContent(createPaymentTransferSchema), required: true } },
    responses: { ...ok(PaymentTransferDTO, '转账已受理'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createTransfer({
    ...c.req.valid('json'),
    idempotencyKey: c.req.valid('header')['x-idempotency-key'],
  }), '转账已受理'), 200),
});

const approveRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/approve', tags: ['支付中心-转账'], summary: '审批通过待审批转账',
    description: '申请人与审批人必须为不同用户。审批状态通过 CAS 抢占，只有审批成功的一方会触发渠道转账。',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      guard({ permission: 'payment:transfer:approve', audit: { description: '审批通过转账', module: '支付中心' } }),
    ] as const,
    request: { params: IdParam, body: { content: jsonContent(approvePaymentTransferSchema), required: true } },
    responses: { ...ok(PaymentTransferDTO, '转账审批通过并已受理'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await approveTransfer(
    c.req.valid('param').id,
    c.req.valid('json'),
  ), '转账审批通过并已受理'), 200),
});

const rejectRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/reject', tags: ['支付中心-转账'], summary: '驳回待审批转账',
    description: '驳回转账并在同一事务内释放对应的资金预占。',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      guard({ permission: 'payment:transfer:approve', audit: { description: '驳回转账', module: '支付中心' } }),
    ] as const,
    request: { params: IdParam, body: { content: jsonContent(approvePaymentTransferSchema), required: true } },
    responses: { ...ok(PaymentTransferDTO, '转账已驳回'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await rejectTransfer(
    c.req.valid('param').id,
    c.req.valid('json'),
  ), '转账已驳回'), 200),
});

const queryRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/query', tags: ['支付中心-转账'], summary: '主动查询渠道转账结果并同步本地状态',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:transfer:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentTransferDTO, '查单完成'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await syncTransferStatus(c.req.valid('param').id), '查单完成'), 200),
});

router.openapiRoutes([
  listRoute,
  summaryRoute,
  detailRoute,
  createTransferRoute,
  approveRoute,
  rejectRoute,
  queryRoute,
] as const);

export default router;
