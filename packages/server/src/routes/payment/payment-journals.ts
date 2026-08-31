import { OpenAPIHono, createRoute, defineOpenAPIRoute, z } from '@hono/zod-openapi';
import {
  createPaymentFundReservationSchema,
  createPaymentLedgerAccountSchema,
  PAYMENT_FUND_RESERVATION_STATUSES,
  postPaymentJournalSchema,
  reversePaymentJournalSchema,
  transitionPaymentFundReservationSchema,
} from '@zenith/shared/payment';
import { authMiddleware } from '../../middleware/auth';
import { guard } from '../../middleware/guard';
import { idempotencyGuard } from '../../middleware/idempotency';
import {
  IdParam,
  PaginationQuery,
  commonErrorResponses,
  dateRangeBound,
  jsonContent,
  ok,
  okBody,
  okPaginated,
  validationHook,
} from '../../lib/openapi-schemas';
import {
  PaymentActiveReservationAmountDTO,
  PaymentFundReservationDTO,
  PaymentJournalDTO,
  PaymentLedgerAccountDTO,
} from '../../lib/openapi-dtos';
import {
  captureFundReservation,
  createFundReservation,
  createLedgerAccount,
  getActiveReservationAmount,
  getJournal,
  listFundReservations,
  listJournals,
  listLedgerAccounts,
  postJournal,
  releaseFundReservation,
  reverseJournal,
} from '../../services/payment/payment-journal.service';

const router = new OpenAPIHono({ defaultHook: validationHook });
const currency = z.string().regex(/^[A-Z]{3}$/).optional();

const accountListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/accounts', tags: ['支付中心-双分录'], summary: '账本账户列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:ledger:list' })] as const,
    request: { query: PaginationQuery.extend({
      keyword: z.string().optional(),
      appId: z.coerce.number().int().positive().optional(),
      channelConfigId: z.coerce.number().int().positive().optional(),
      currency,
      status: z.enum(['enabled', 'disabled']).optional(),
    }) },
    responses: { ...okPaginated(PaymentLedgerAccountDTO, '账本账户列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listLedgerAccounts(c.req.valid('query'))), 200),
});

const accountCreateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/accounts', tags: ['支付中心-双分录'], summary: '创建账本账户',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      idempotencyGuard({ ttlSeconds: 30 }),
      guard({ permission: 'payment:ledger:account:create', audit: { description: '创建支付账本账户', module: '支付中心' } }),
    ] as const,
    request: { body: { content: jsonContent(createPaymentLedgerAccountSchema), required: true } },
    responses: { ...ok(PaymentLedgerAccountDTO, '创建成功'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createLedgerAccount(c.req.valid('json')), '创建成功'), 200),
});

const activeReservationRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/accounts/{id}/active-reservation', tags: ['支付中心-双分录'], summary: '查询账户有效预占金额',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:ledger:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentActiveReservationAmountDTO, '有效预占金额'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getActiveReservationAmount(c.req.valid('param').id)), 200),
});

const reservationListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/reservations', tags: ['支付中心-双分录'], summary: '资金预占列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:ledger:list' })] as const,
    request: { query: PaginationQuery.extend({
      accountId: z.coerce.number().int().positive().optional(),
      status: z.enum(PAYMENT_FUND_RESERVATION_STATUSES).optional(),
      sourceType: z.string().max(64).optional(),
      startTime: dateRangeBound('起始时间'),
      endTime: dateRangeBound('结束时间'),
    }) },
    responses: { ...okPaginated(PaymentFundReservationDTO, '资金预占列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listFundReservations(c.req.valid('query'))), 200),
});

const reservationCreateRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/reservations', tags: ['支付中心-双分录'], summary: '创建资金预占',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      idempotencyGuard({ ttlSeconds: 30 }),
      guard({ permission: 'payment:ledger:reserve', audit: { description: '创建支付资金预占', module: '支付中心' } }),
    ] as const,
    request: { body: { content: jsonContent(createPaymentFundReservationSchema), required: true } },
    responses: { ...ok(PaymentFundReservationDTO, '预占成功'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await createFundReservation(c.req.valid('json')), '预占成功'), 200),
});

function reservationTransitionRoute(path: '/reservations/{id}/capture' | '/reservations/{id}/release', action: 'capture' | 'release') {
  const capture = action === 'capture';
  return defineOpenAPIRoute({
    route: createRoute({
      method: 'post', path, tags: ['支付中心-双分录'], summary: capture ? '核销资金预占' : '释放资金预占',
      security: [{ BearerAuth: [] }],
      middleware: [
        authMiddleware,
        idempotencyGuard({ ttlSeconds: 15 }),
        guard({ permission: 'payment:ledger:reserve', audit: { description: capture ? '核销支付资金预占' : '释放支付资金预占', module: '支付中心' } }),
      ] as const,
      request: { params: IdParam, body: { content: jsonContent(transitionPaymentFundReservationSchema), required: true } },
      responses: { ...ok(PaymentFundReservationDTO, capture ? '核销成功' : '释放成功'), ...commonErrorResponses },
    }),
    handler: async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');
      const result = capture ? await captureFundReservation(id, body) : await releaseFundReservation(id, body);
      return c.json(okBody(result, capture ? '核销成功' : '释放成功'), 200);
    },
  });
}

const journalListRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/', tags: ['支付中心-双分录'], summary: '资金凭证列表',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:ledger:list' })] as const,
    request: { query: PaginationQuery.extend({
      sourceType: z.string().max(64).optional(),
      appId: z.coerce.number().int().positive().optional(),
      channelConfigId: z.coerce.number().int().positive().optional(),
      currency,
      startTime: dateRangeBound('起始时间'),
      endTime: dateRangeBound('结束时间'),
    }) },
    responses: { ...okPaginated(PaymentJournalDTO, '资金凭证列表'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await listJournals(c.req.valid('query'))), 200),
});

const journalPostRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/', tags: ['支付中心-双分录'], summary: '过账资金凭证',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      idempotencyGuard({ ttlSeconds: 60 }),
      guard({ permission: 'payment:ledger:post', audit: { description: '过账支付资金凭证', module: '支付中心' } }),
    ] as const,
    request: { body: { content: jsonContent(postPaymentJournalSchema), required: true } },
    responses: { ...ok(PaymentJournalDTO, '过账成功'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await postJournal(c.req.valid('json')), '过账成功'), 200),
});

const journalGetRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'get', path: '/{id}', tags: ['支付中心-双分录'], summary: '资金凭证详情',
    security: [{ BearerAuth: [] }],
    middleware: [authMiddleware, guard({ permission: 'payment:ledger:list' })] as const,
    request: { params: IdParam },
    responses: { ...ok(PaymentJournalDTO, '资金凭证详情'), ...commonErrorResponses },
  }),
  handler: async (c) => c.json(okBody(await getJournal(c.req.valid('param').id)), 200),
});

const journalReverseRoute = defineOpenAPIRoute({
  route: createRoute({
    method: 'post', path: '/{id}/reverse', tags: ['支付中心-双分录'], summary: '冲正资金凭证',
    security: [{ BearerAuth: [] }],
    middleware: [
      authMiddleware,
      idempotencyGuard({ ttlSeconds: 30 }),
      guard({ permission: 'payment:ledger:reverse', audit: { description: '冲正支付资金凭证', module: '支付中心' } }),
    ] as const,
    request: { params: IdParam, body: { content: jsonContent(reversePaymentJournalSchema), required: true } },
    responses: { ...ok(PaymentJournalDTO, '冲正成功'), ...commonErrorResponses },
  }),
  handler: async (c) => {
    const { id } = c.req.valid('param');
    return c.json(okBody(await reverseJournal(id, c.req.valid('json').reason), '冲正成功'), 200);
  },
});

router.openapiRoutes([
  accountListRoute,
  accountCreateRoute,
  activeReservationRoute,
  reservationListRoute,
  reservationCreateRoute,
  reservationTransitionRoute('/reservations/{id}/capture', 'capture'),
  reservationTransitionRoute('/reservations/{id}/release', 'release'),
  journalListRoute,
  journalPostRoute,
  journalReverseRoute,
  journalGetRoute,
] as const);

export default router;
