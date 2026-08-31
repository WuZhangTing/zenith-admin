import { http } from 'msw';
import { PAYMENT_MOCK_SEED_TIME, getNextPaymentOrderId, mockPaymentChannels, mockPaymentOrders, mockPaymentRefunds } from '@/mocks/data/payment';
import { mockDateTime, mockDateTimeOffset } from '@/mocks/utils/date';
import { ok, notFound, badRequest, conflict, forbidden, paginate } from '@/mocks/utils/handlers';
import { PAYMENT_CASHIER_METHODS, PAYMENT_CHANNEL_LABELS, PAYMENT_METHOD_CHANNEL } from '@zenith/shared/payment';
import { SEED_PAYMENT_METHOD_CONFIGS } from '@zenith/shared/seed';
import { recordMockPaymentSucceeded } from './payment-ext';
import { recordMockSystemJournal } from './payment-journals';
import { mockOAuth2Clients } from './oauth2-apps';
import type { CreatePaymentResult, PaymentCashierMethod, PaymentCashierSession, PaymentChannel, PaymentApp, PaymentFeeRule, PaymentLink, PaymentLinkPublic, PaymentLinkStatus, PaymentMethod, PaymentMethodConfig, PaymentReportGroupBy, PaymentReportRow, PaymentRiskRule, PaymentSettlementBatch, PaymentSettlementItem, PaymentSettlementStatus, PaymentSharingOrder, PaymentSharingReceiver, PaymentSharingReversal, PaymentTransfer } from '@zenith/shared/payment';

const SEED = PAYMENT_MOCK_SEED_TIME;
const methodConfigs: PaymentMethodConfig[] = SEED_PAYMENT_METHOD_CONFIGS.map((m) => ({
  id: m.id, method: m.method as PaymentMethod, channel: m.channel as PaymentChannel, label: m.label, icon: m.icon, enabled: m.enabled, sort: m.sort, createdAt: SEED, updatedAt: SEED,
}));
const cashierMethodSet = new Set<PaymentMethod>(PAYMENT_CASHIER_METHODS);

function getMockLinkAvailableMethods(link: PaymentLink): PaymentLinkPublic['availableMethods'] {
  const app = apps.find((item) => item.id === link.appId && item.status === 'enabled');
  if (!app) return [];
  const boundConfigIds = new Set([app.wechatConfigId, app.alipayConfigId, app.unionpayConfigId].filter((id): id is number => id != null));
  const enabledChannels = new Set(
    mockPaymentChannels
      .filter((config) => boundConfigIds.has(config.id) && config.status === 'enabled' && config.sandbox === (app.environment === 'sandbox'))
      .map((config) => config.channel),
  );
  return methodConfigs
    .filter((config) => config.enabled && enabledChannels.has(config.channel) && cashierMethodSet.has(config.method) && (!link.payMethod || config.method === link.payMethod))
    .sort((a, b) => a.sort - b.sort)
    .map((config) => ({ method: config.method as PaymentCashierMethod, label: config.label, icon: config.icon ?? null }));
}

// ─── 费率规则 ─────────────────────────────────────────────────────────────────
const feeRules: PaymentFeeRule[] = [
  { id: 1, name: '微信标准费率', channel: 'wechat', payMethod: null, rateBps: 60, fixedFee: 0, minFee: null, maxFee: null, status: 'enabled', priority: 10, remark: '0.6%', createdAt: SEED, updatedAt: SEED },
  { id: 2, name: '支付宝标准费率', channel: 'alipay', payMethod: null, rateBps: 55, fixedFee: 0, minFee: null, maxFee: 5000, status: 'enabled', priority: 10, remark: '0.55%，封顶 50 元', createdAt: SEED, updatedAt: SEED },
];
let nextFeeId = 3;

const feeHandlers = [
  http.get('/api/payment/fee-rules', ({ request }) => {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = feeRules.filter((r) => (!channel || r.channel === channel) && (!status || r.status === status));
    return ok(paginate([...filtered].sort((a, b) => b.priority - a.priority), url));
  }),
  http.get('/api/payment/fee-rules/:id', ({ params }) => {
    const r = feeRules.find((x) => x.id === Number(params.id));
    return r ? ok(r) : notFound('费率规则不存在');
  }),
  http.post('/api/payment/fee-rules', async ({ request }) => {
    const b = (await request.json()) as Partial<PaymentFeeRule>;
    const now = mockDateTime();
    const item: PaymentFeeRule = {
      id: nextFeeId++, name: b.name ?? '', channel: (b.channel as PaymentChannel) ?? 'wechat', payMethod: (b.payMethod as PaymentMethod) ?? null,
      rateBps: b.rateBps ?? 0, fixedFee: b.fixedFee ?? 0, minFee: b.minFee ?? null, maxFee: b.maxFee ?? null,
      status: b.status ?? 'enabled', priority: b.priority ?? 0, remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    feeRules.push(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/payment/fee-rules/:id', async ({ params, request }) => {
    const r = feeRules.find((x) => x.id === Number(params.id));
    if (!r) return notFound('费率规则不存在');
    const b = (await request.json()) as Partial<PaymentFeeRule>;
    Object.assign(r, b, { updatedAt: mockDateTime() });
    return ok(r, '更新成功');
  }),
  http.delete('/api/payment/fee-rules/:id', ({ params }) => {
    const i = feeRules.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('费率规则不存在');
    feeRules.splice(i, 1);
    return ok(null, '删除成功');
  }),
];

// ─── 结算批次 ─────────────────────────────────────────────────────────────────
const settlements: PaymentSettlementBatch[] = [
  { id: 1, batchNo: 'SETTLE1700000000001', channel: 'wechat', appId: 1, channelConfigId: 1, currency: 'CNY', periodStart: '2024-01-01', periodEnd: '2024-01-07', status: 'settled', orderCount: 12, grossAmount: 158800, feeAmount: 953, refundAmount: 1900, sharingAmount: 0, netAmount: 155947, settledAt: SEED, failureReason: null, payoutReference: 'MOCK-PAYOUT-001', version: 1, remark: '首周结算', createdAt: SEED, updatedAt: SEED },
  { id: 2, batchNo: 'SETTLE1700000000002', channel: 'alipay', appId: 3, channelConfigId: 2, currency: 'CNY', periodStart: '2024-01-08', periodEnd: '2024-01-14', status: 'pending', orderCount: 8, grossAmount: 88800, feeAmount: 488, refundAmount: 0, sharingAmount: 0, netAmount: 88312, settledAt: null, failureReason: null, payoutReference: null, version: 0, remark: null, createdAt: SEED, updatedAt: SEED },
];
let nextSettlementId = 3;
interface MockSettlementLine {
  id: number;
  journalLineId: number;
  amount: string;
  appId: number;
  channelConfigId: number;
  currency: string;
  postedDate: string;
  batchId: number | null;
  createdAt: string;
}
const mockSettlementLines: MockSettlementLine[] = [
  { id: 1, journalLineId: 10001, amount: '155947', appId: 1, channelConfigId: 1, currency: 'CNY', postedDate: '2024-01-03', batchId: 1, createdAt: SEED },
  { id: 2, journalLineId: 10002, amount: '88312', appId: 3, channelConfigId: 2, currency: 'CNY', postedDate: '2024-01-10', batchId: 2, createdAt: SEED },
  { id: 3, journalLineId: 10003, amount: '1900', appId: 1, channelConfigId: 1, currency: 'CNY', postedDate: '2024-01-15', batchId: null, createdAt: SEED },
];
const TRANSITIONS: Record<PaymentSettlementStatus, PaymentSettlementStatus[]> = { pending: ['settling', 'failed'], settling: ['settled', 'failed'], settled: [], failed: [] };

const settlementHandlers = [
  http.get('/api/payment/settlements', ({ request }) => {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = settlements.filter((s) => (!channel || s.channel === channel) && (!status || s.status === status));
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.get('/api/payment/settlements/:id/items', ({ params }) => {
    const batchId = Number(params.id);
    if (!settlements.some((batch) => batch.id === batchId)) return notFound('结算批次不存在');
    const items: PaymentSettlementItem[] = mockSettlementLines
      .filter((line) => line.batchId === batchId)
      .map((line) => ({
        id: line.id,
        batchId,
        journalLineId: line.journalLineId,
        amount: line.amount,
        appId: line.appId,
        channelConfigId: line.channelConfigId,
        currency: line.currency,
        createdAt: line.createdAt,
      }));
    return ok(items);
  }),
  http.get('/api/payment/settlements/:id', ({ params }) => {
    const s = settlements.find((x) => x.id === Number(params.id));
    return s ? ok(s) : notFound('结算批次不存在');
  }),
  http.post('/api/payment/settlements/generate', async ({ request }) => {
    const b = (await request.json()) as { applicationId: number; channelConfigId: number; currency: string; periodStart: string; periodEnd: string; remark?: string };
    const config = mockPaymentChannels.find((item) => item.id === b.channelConfigId && item.status === 'enabled');
    const app = apps.find((item) => item.id === b.applicationId && item.status === 'enabled');
    const appConfigIds = [app?.wechatConfigId, app?.alipayConfigId, app?.unionpayConfigId];
    if (!config || !app || !appConfigIds.includes(config.id)) return badRequest('支付应用或商户配置不存在、未启用或未绑定');
    const availableLines = mockSettlementLines.filter((line) =>
      line.batchId == null
      && line.appId === b.applicationId
      && line.channelConfigId === b.channelConfigId
      && line.currency === b.currency
      && line.postedDate >= b.periodStart
      && line.postedDate <= b.periodEnd);
    if (availableLines.length === 0) return badRequest('该账期没有未结算的可用资金分录');
    const netBigInt = availableLines.reduce((sum, line) => sum + BigInt(line.amount), 0n);
    if (netBigInt <= 0n || netBigInt > BigInt(Number.MAX_SAFE_INTEGER)) return badRequest('该账期可结算净额无效');
    const netAmount = Number(netBigInt);
    const batchId = nextSettlementId++;
    const now = mockDateTime();
    const item: PaymentSettlementBatch = {
      id: batchId, batchNo: `SETTLE${Date.now()}`, channel: config.channel, appId: b.applicationId, channelConfigId: b.channelConfigId, currency: b.currency,
      periodStart: b.periodStart, periodEnd: b.periodEnd,
      status: 'pending', orderCount: availableLines.length, grossAmount: netAmount, feeAmount: 0, refundAmount: 0, sharingAmount: 0, netAmount,
      settledAt: null, failureReason: null, payoutReference: null, version: 0, remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    availableLines.forEach((line) => {
      line.batchId = batchId;
      line.createdAt = now;
    });
    settlements.push(item);
    return ok(item, '生成成功');
  }),
  http.post('/api/payment/settlements/:id/status', async ({ params, request }) => {
    const s = settlements.find((x) => x.id === Number(params.id));
    if (!s) return notFound('结算批次不存在');
    const { status, failureReason, payoutReference } = (await request.json()) as {
      status: PaymentSettlementStatus;
      failureReason?: string;
      payoutReference?: string;
    };
    if (!TRANSITIONS[s.status].includes(status)) return badRequest(`不允许从「${s.status}」流转到「${status}」`);
    if (status === 'failed' && !failureReason?.trim()) return badRequest('标记结算失败时必须填写失败原因');
    if (status === 'settled' && !payoutReference?.trim()) return badRequest('确认结算到账时必须填写出款或到账参考号');
    s.status = status;
    s.failureReason = status === 'failed' ? failureReason!.trim() : null;
    if (status === 'settled') {
      s.settledAt = mockDateTime();
      s.payoutReference = payoutReference!.trim();
      recordMockSystemJournal({ sourceType: 'settlement.paid', sourceId: s.batchNo, description: `结算批次 ${s.batchNo} 到账`, appId: s.appId, channelConfigId: s.channelConfigId, currency: s.currency, lines: [{ accountCode: 'payout_payable', debitAmount: String(s.netAmount), memo: '结算出款应付清偿' }, { accountCode: 'provider_clearing', creditAmount: String(s.netAmount), memo: '渠道清算资金减少' }] });
    }
    s.version += 1;
    s.updatedAt = mockDateTime();
    return ok(s, '操作成功');
  }),
  http.delete('/api/payment/settlements/:id', ({ params }) => {
    const i = settlements.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('结算批次不存在');
    if (settlements[i].status === 'settling') return badRequest('结算中批次不可删除');
    mockSettlementLines.forEach((line) => {
      if (line.batchId === settlements[i].id) line.batchId = null;
    });
    settlements.splice(i, 1);
    return ok(null, '删除成功');
  }),
];

// ─── 分账（接收方 + 分账单）────────────────────────────────────────────────────
const receivers: PaymentSharingReceiver[] = [
  { id: 1, name: '合作商户 A', receiverType: 'merchant', account: '1600000001', ratioBps: 1000, autoShare: true, status: 'enabled', remark: '10% 分成', createdAt: SEED, updatedAt: SEED },
  { id: 2, name: '推广个人 B', receiverType: 'personal', account: 'oXYZ888', ratioBps: 500, autoShare: false, status: 'enabled', remark: '5% 分成', createdAt: SEED, updatedAt: SEED },
];
let nextReceiverId = 3;
const sharingOrders: PaymentSharingOrder[] = [
  { id: 1, sharingNo: 'SHR1700000000001', orderNo: 'PAY1700000000001', receiverId: 1, receiverName: '合作商户 A', amount: 990, status: 'success', channelSharingNo: 'WXSHARE202401010001', version: 0, finishedAt: SEED, remark: null, createdAt: SEED, updatedAt: SEED },
];
let nextSharingOrderId = 2;
const sharingReversals: PaymentSharingReversal[] = [
  {
    id: 1, reversalNo: 'SHRR1700000000001', sharingOrderId: 1, sharingNo: 'SHR1700000000001', orderNo: 'PAY1700000000001',
    amount: 990, status: 'failed', channelReversalNo: null, reason: '演示冲正失败记录', attempts: 1, queryAttempts: 1,
    version: 1, errorMessage: '渠道返回原分账单状态不可冲正', finishedAt: SEED, createdAt: SEED, updatedAt: SEED,
  },
];
let nextSharingReversalId = 2;
const sharingReversalIdempotency = new Map<string, { requestHash: string; reversalId: number }>();

const sharingHandlers = [
  http.get('/api/payment/sharing/receivers', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = receivers.filter((r) => (!keyword || r.name.includes(keyword)) && (!status || r.status === status));
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.get('/api/payment/sharing/receivers/:id', ({ params }) => {
    const r = receivers.find((x) => x.id === Number(params.id));
    return r ? ok(r) : notFound('分账接收方不存在');
  }),
  http.post('/api/payment/sharing/receivers', async ({ request }) => {
    const b = (await request.json()) as Partial<PaymentSharingReceiver>;
    const now = mockDateTime();
    const item: PaymentSharingReceiver = {
      id: nextReceiverId++, name: b.name ?? '', receiverType: b.receiverType ?? 'merchant', account: b.account ?? '',
      ratioBps: b.ratioBps ?? null, autoShare: b.autoShare ?? false, status: b.status ?? 'enabled', remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    receivers.push(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/payment/sharing/receivers/:id', async ({ params, request }) => {
    const r = receivers.find((x) => x.id === Number(params.id));
    if (!r) return notFound('分账接收方不存在');
    const b = (await request.json()) as Partial<PaymentSharingReceiver>;
    Object.assign(r, b, { updatedAt: mockDateTime() });
    return ok(r, '更新成功');
  }),
  http.delete('/api/payment/sharing/receivers/:id', ({ params }) => {
    const i = receivers.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('分账接收方不存在');
    receivers.splice(i, 1);
    return ok(null, '删除成功');
  }),
  http.get('/api/payment/sharing/orders', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = sharingOrders.filter((o) => (!keyword || o.orderNo.includes(keyword)) && (!status || o.status === status));
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.post('/api/payment/sharing/orders', async ({ request }) => {
    const b = (await request.json()) as { orderNo: string; receiverId: number; amount?: number; remark?: string };
    const order = mockPaymentOrders.find((o) => o.orderNo === b.orderNo);
    if (!order) return notFound('支付订单不存在');
    if (!['success', 'refunding', 'refunded'].includes(order.status)) return badRequest('仅支付成功的订单可发起分账');
    const receiver = receivers.find((r) => r.id === b.receiverId);
    if (!receiver) return notFound('分账接收方不存在');
    if (receiver.status !== 'enabled') return badRequest('分账接收方已停用');
    const paid = order.paidAmount ?? order.amount;
    const amount = b.amount ?? (receiver.ratioBps != null ? Math.round((paid * receiver.ratioBps) / 10000) : 0);
    if (amount <= 0) return badRequest('分账金额必须大于 0');
    if (amount > paid) return badRequest('分账金额不能超过订单实付金额');
    const now = mockDateTime();
    const item: PaymentSharingOrder = {
      id: nextSharingOrderId++, sharingNo: `SHR${Date.now()}`, orderNo: b.orderNo, receiverId: receiver.id, receiverName: receiver.name,
      amount, status: 'success', channelSharingNo: `WXSHARE${Date.now()}`, version: 0, finishedAt: now, remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    sharingOrders.push(item);
    return ok(item, '分账已发起');
  }),
  http.get('/api/payment/sharing/reversals', ({ request }) => {
    const url = new URL(request.url);
    const sharingOrderId = Number(url.searchParams.get('sharingOrderId')) || undefined;
    const status = url.searchParams.get('status') ?? '';
    const startTime = url.searchParams.get('startTime') ?? '';
    const endTime = url.searchParams.get('endTime') ?? '';
    const filtered = sharingReversals.filter((record) =>
      (!sharingOrderId || record.sharingOrderId === sharingOrderId)
      && (!status || record.status === status)
      && (!startTime || record.createdAt >= startTime)
      && (!endTime || record.createdAt <= endTime));
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.get('/api/payment/sharing/reversals/:id', ({ params }) => {
    const reversal = sharingReversals.find((record) => record.id === Number(params.id));
    return reversal ? ok(reversal) : notFound('分账冲正单不存在');
  }),
  http.post('/api/payment/sharing/orders/:id/reverse', async ({ params, request }) => {
    const sharingOrderId = Number(params.id);
    const sharingOrder = sharingOrders.find((record) => record.id === sharingOrderId);
    if (!sharingOrder) return notFound('分账单不存在', { status: 404 });
    if (sharingOrder.status !== 'success') return badRequest('仅分账成功的分账单可冲正', { status: 400 });
    const idempotencyKey = request.headers.get('X-Idempotency-Key')?.trim() ?? '';
    if (idempotencyKey.length < 8) return badRequest('X-Idempotency-Key 不能为空且至少 8 位', { status: 400 });
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim() ?? '';
    if (!reason) return badRequest('冲正原因不能为空', { status: 400 });
    const requestHash = JSON.stringify({ sharingOrderId, reason });
    const mapKey = `${sharingOrderId}:${idempotencyKey}`;
    const previous = sharingReversalIdempotency.get(mapKey);
    if (previous) {
      if (previous.requestHash !== requestHash) return conflict('同一幂等键不能用于不同冲正请求', { status: 409 });
      const existing = sharingReversals.find((record) => record.id === previous.reversalId);
      return existing ? ok(existing, '冲正已受理') : conflict('幂等记录对应的冲正单不存在', { status: 409 });
    }
    const now = mockDateTime();
    const reversal: PaymentSharingReversal = {
      id: nextSharingReversalId++, reversalNo: `SHRR${Date.now()}`, sharingOrderId, sharingNo: sharingOrder.sharingNo,
      orderNo: sharingOrder.orderNo, amount: sharingOrder.amount, status: 'processing', channelReversalNo: null, reason,
      attempts: 1, queryAttempts: 0, version: 0, errorMessage: null, finishedAt: null, createdAt: now, updatedAt: now,
    };
    sharingReversals.push(reversal);
    sharingReversalIdempotency.set(mapKey, { requestHash, reversalId: reversal.id });
    return ok(reversal, '冲正已受理');
  }),
  http.post('/api/payment/sharing/reversals/:id/query', ({ params }) => {
    const reversal = sharingReversals.find((record) => record.id === Number(params.id));
    if (!reversal) return notFound('分账冲正单不存在', { status: 404 });
    reversal.queryAttempts += 1;
    reversal.version += 1;
    reversal.updatedAt = mockDateTime();
    if (reversal.status === 'processing' || reversal.status === 'unknown') {
      reversal.status = 'success';
      reversal.channelReversalNo = `WXSHRR${Date.now()}`;
      reversal.errorMessage = null;
      reversal.finishedAt = reversal.updatedAt;
      const sharingOrder = sharingOrders.find((record) => record.id === reversal.sharingOrderId);
      if (sharingOrder) {
        sharingOrder.status = 'reversed';
        sharingOrder.version += 1;
        sharingOrder.updatedAt = reversal.updatedAt;
      }
    }
    return ok(reversal, '查单完成');
  }),
];

// ─── 支付链接 ─────────────────────────────────────────────────────────────────
const links: PaymentLink[] = [
  { id: 1, linkNo: 'LINK1700000000001', token: 'demotoken0000000000000000000001', appId: 1, subject: '会员年费收款', amount: 9900, payMethod: 'wechat_native', bizType: 'membership', maxUses: null, usedCount: 3, reservedCount: 0, expiredAt: null, status: 'active', remark: '演示固定金额链接', createdAt: SEED, updatedAt: SEED },
  { id: 2, linkNo: 'LINK1700000000002', token: 'demotoken0000000000000000000002', appId: 2, subject: '自由打赏', amount: null, payMethod: null, bizType: 'general', maxUses: 100, usedCount: 12, reservedCount: 0, expiredAt: null, status: 'active', remark: '用户自填金额', createdAt: SEED, updatedAt: SEED },
];
let nextLinkId = 3;
let nextLinkToken = 3;
const cashierSessions = new Map<string, PaymentCashierSession>();

function computeLinkStatus(l: PaymentLink): PaymentLinkStatus {
  if (l.status === 'disabled') return 'disabled';
  if (l.expiredAt && new Date(l.expiredAt).getTime() < Date.now()) return 'expired';
  if (l.maxUses != null && l.usedCount + l.reservedCount >= l.maxUses) return 'expired';
  return 'active';
}

const linkHandlers = [
  http.get('/api/payment/links', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = links.filter((l) => (!keyword || l.subject.includes(keyword)) && (!status || computeLinkStatus(l) === status));
    return ok(paginate([...filtered].reverse().map((l) => ({ ...l, status: computeLinkStatus(l) })), url));
  }),
  http.get('/api/payment/links/:id', ({ params }) => {
    const l = links.find((x) => x.id === Number(params.id));
    return l ? ok({ ...l, status: computeLinkStatus(l) }) : notFound('支付链接不存在');
  }),
  http.post('/api/payment/links', async ({ request }) => {
    const b = (await request.json()) as Partial<PaymentLink> & { applicationId?: number };
    const app = apps.find((item) => item.id === b.applicationId && item.status === 'enabled');
    if (!app) return badRequest('支付应用不存在或已停用');
    const now = mockDateTime();
    const item: PaymentLink = {
      id: nextLinkId++, linkNo: `LINK${Date.now()}`, token: `demotoken${String(nextLinkToken++).padStart(23, '0')}`,
      appId: app.id, subject: b.subject ?? '', amount: b.amount ?? null, payMethod: (b.payMethod as PaymentMethod) ?? null, bizType: b.bizType ?? 'general',
      maxUses: b.maxUses ?? null, usedCount: 0, reservedCount: 0, expiredAt: b.expiredAt ?? null, status: b.status === 'disabled' ? 'disabled' : 'active',
      remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    if (getMockLinkAvailableMethods(item).length === 0) {
      return badRequest(item.payMethod ? '所选固定支付方式当前不可用' : '支付应用当前没有可用的公开收银台支付方式');
    }
    links.push(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/payment/links/:id', async ({ params, request }) => {
    const l = links.find((x) => x.id === Number(params.id));
    if (!l) return notFound('支付链接不存在');
    const b = (await request.json()) as Partial<PaymentLink>;
    const next = { ...l, ...b, updatedAt: mockDateTime() };
    if (next.maxUses != null && next.maxUses < next.usedCount + next.reservedCount) {
      return badRequest('使用上限不能小于已核销次数与有效预占次数之和');
    }
    if (getMockLinkAvailableMethods(next).length === 0) {
      return badRequest(next.payMethod ? '所选固定支付方式当前不可用' : '支付应用当前没有可用的公开收银台支付方式');
    }
    Object.assign(l, next);
    return ok({ ...l, status: computeLinkStatus(l) }, '更新成功');
  }),
  http.post('/api/payment/links/:id/rotate-token', ({ params }) => {
    const l = links.find((x) => x.id === Number(params.id));
    if (!l) return notFound('支付链接不存在');
    l.token = `demotoken${Date.now()}`;
    l.updatedAt = mockDateTime();
    return ok({ ...l, status: computeLinkStatus(l) }, 'token 已重置');
  }),
  http.delete('/api/payment/links/:id', ({ params }) => {
    const i = links.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('支付链接不存在');
    links.splice(i, 1);
    return ok(null, '删除成功');
  }),
  http.get('/api/public/payment/link/:token', ({ params }) => {
    const l = links.find((x) => x.token === String(params.token));
    if (!l) return notFound('支付链接不存在或已删除');
    const data: PaymentLinkPublic = {
      token: l.token,
      subject: l.subject,
      amount: l.amount,
      payMethod: l.payMethod,
      bizType: l.bizType,
      status: computeLinkStatus(l),
      expiredAt: l.expiredAt,
      remainingUses: l.maxUses != null ? Math.max(0, l.maxUses - l.usedCount - l.reservedCount) : null,
      availableMethods: getMockLinkAvailableMethods(l),
    };
    return ok(data);
  }),
  http.post('/api/public/payment/link/:token/pay', async ({ params, request }) => {
    const l = links.find((x) => x.token === String(params.token));
    if (!l) return notFound('支付链接不存在或已删除');
    const status = computeLinkStatus(l);
    if (status === 'disabled') return badRequest('该支付链接已停用');
    if (status === 'expired') return badRequest('该支付链接已过期或已达使用上限');
    const body = (await request.json()) as { amount?: number; payMethod?: PaymentMethod; openId?: string };
    const amount = l.amount ?? body.amount;
    if (!amount || amount <= 0) return badRequest('请输入有效的支付金额');
    const payMethod = l.payMethod ?? body.payMethod;
    if (!payMethod) return badRequest('请选择支付方式');
    if (!getMockLinkAvailableMethods(l).some((item) => item.method === payMethod)) return badRequest('该支付方式当前未启用或不属于此收款链接');
    if (l.maxUses != null && l.usedCount + l.reservedCount >= l.maxUses) return badRequest('该支付链接已过期或已达使用上限');
    const channel = PAYMENT_METHOD_CHANNEL[payMethod];
    const sessionToken = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
    const orderNo = `PAY${Date.now()}`;
    const now = mockDateTime();
    const expiresAt = mockDateTimeOffset(30 * 60 * 1000);
    const consumesUseSlot = l.maxUses != null;
    if (consumesUseSlot) l.reservedCount += 1;
    l.updatedAt = mockDateTime();
    mockPaymentOrders.unshift({
      id: getNextPaymentOrderId(), orderNo, outTradeNo: orderNo, channelTradeNo: null, bizType: l.bizType, bizId: `${l.linkNo}:${sessionToken}`,
      subject: l.subject, body: null, amount, currency: 'CNY', channel, channelConfigId: channel === 'wechat' ? 1 : 2, appId: l.appId,
      payMethod, status: 'paying', userId: null, openId: body.openId ?? null, clientIp: '127.0.0.1', departmentId: null,
      paidAmount: null, feeAmount: null, netAmount: null, paidAt: null, expiredAt: expiresAt, errorMessage: null, version: 0, createdAt: now, updatedAt: now,
    });
    const payParams: CreatePaymentResult = {
      orderNo,
      channel,
      payMethod,
      codeUrl: channel === 'wechat' ? `weixin://wxpay/bizpayurl?pr=${orderNo}` : undefined,
      payUrl: channel === 'alipay' ? `https://openapi.alipaydev.com/gateway.do?out_trade_no=${orderNo}` : undefined,
      expiredAt: expiresAt,
    };
    const returnUrl = new URL(`/public/payment/link/${encodeURIComponent(l.token)}`, request.url);
    returnUrl.searchParams.set('session', sessionToken);
    const session: PaymentCashierSession = {
      sessionToken,
      linkId: l.id,
      appId: l.appId,
      orderNo,
      payMethod: payMethod as PaymentCashierMethod,
      amount,
      status: 'processing',
      useSlotStatus: consumesUseSlot ? 'reserved' : 'none',
      payParams,
      returnUrl: returnUrl.toString(),
      errorMessage: null,
      expiresAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    cashierSessions.set(sessionToken, session);
    return ok(session, '收银台会话已创建');
  }),
  http.get('/api/public/payment/link/:token/sessions/:sessionToken', ({ params }) => {
    const link = links.find((item) => item.token === String(params.token));
    const session = cashierSessions.get(String(params.sessionToken));
    if (!link || !session || session.linkId !== link.id) return notFound('收银台会话不存在或已失效');
    const previousStatus = session.status;
    const previousError = session.errorMessage ?? null;
    const order = session.orderNo ? mockPaymentOrders.find((item) => item.orderNo === session.orderNo && item.appId === session.appId) : undefined;
    if (order?.status === 'paying' && Date.now() - new Date(order.createdAt.replace(' ', 'T')).getTime() > 15000) {
      order.status = 'success';
      order.paidAmount = order.amount;
      order.paidAt = mockDateTime();
      order.version += 1;
      order.updatedAt = mockDateTime();
      recordMockPaymentSucceededFromLink(order);
    }
    if (order?.status === 'success' || order?.status === 'refunding' || order?.status === 'refunded') {
      session.status = 'succeeded';
      if (session.useSlotStatus === 'reserved') {
        link.reservedCount = Math.max(0, link.reservedCount - 1);
        link.usedCount += 1;
        session.useSlotStatus = 'consumed';
        link.updatedAt = mockDateTime();
      }
    }
    else if (order?.status === 'failed' || order?.status === 'closed') {
      session.status = 'failed';
      if (session.useSlotStatus === 'reserved') {
        link.reservedCount = Math.max(0, link.reservedCount - 1);
        session.useSlotStatus = 'released';
        link.updatedAt = mockDateTime();
      }
    }
    else if (order?.status === 'unknown') session.status = 'unknown';
    else if (new Date(session.expiresAt.replace(' ', 'T')).getTime() <= Date.now()) {
      session.status = 'expired';
      if (session.useSlotStatus === 'reserved') {
        link.reservedCount = Math.max(0, link.reservedCount - 1);
        session.useSlotStatus = 'released';
        link.updatedAt = mockDateTime();
      }
    }
    else if (order?.status === 'paying') session.status = 'processing';
    session.errorMessage = order?.errorMessage ?? null;
    if (session.status !== previousStatus || session.errorMessage !== previousError) {
      session.version += 1;
      session.updatedAt = mockDateTime();
    }
    return ok({ ...session });
  }),
];

/** 收银台演示支付成功：走统一 mock 履约（Journal / 事件 / Open Platform Webhook）。 */
function recordMockPaymentSucceededFromLink(order: (typeof mockPaymentOrders)[number]) {
  recordMockPaymentSucceeded(order);
}

// ─── 支付应用（App 维度）───────────────────────────────────────────────────────
const apps: PaymentApp[] = [
  { id: 1, name: '官网商城', openClientId: 1, openClientKey: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', openClientName: '示例应用（授权码模式）', environment: 'production', status: 'enabled', wechatConfigId: 1, wechatConfigName: '微信主配置', alipayConfigId: null, alipayConfigName: null, unionpayConfigId: null, unionpayConfigName: null, remark: '官网下单应用', createdAt: SEED, updatedAt: SEED },
  { id: 2, name: '内部支付服务', openClientId: 2, openClientKey: 'f0e1d2c3-b4a5-6789-0abc-de1234567891', openClientName: '内部服务（客户端凭证）', environment: 'production', status: 'enabled', wechatConfigId: 1, wechatConfigName: '微信主配置', alipayConfigId: null, alipayConfigName: null, unionpayConfigId: null, unionpayConfigName: null, remark: null, createdAt: SEED, updatedAt: SEED },
  { id: 3, name: '沙箱收银台', openClientId: 4, openClientKey: 'sandbox-pay-1234-5678-9abc-def012345678', openClientName: '沙箱支付服务', environment: 'sandbox', status: 'enabled', wechatConfigId: null, wechatConfigName: null, alipayConfigId: 2, alipayConfigName: '支付宝主商户', unionpayConfigId: null, unionpayConfigName: null, remark: '支付宝沙箱演示应用', createdAt: SEED, updatedAt: SEED },
];
let nextAppId = 4;

function fillPaymentAppConfigNames(app: PaymentApp) {
  const openClient = mockOAuth2Clients.find((client) => client.id === app.openClientId);
  const wechat = app.wechatConfigId ? mockPaymentChannels.find((c) => c.id === app.wechatConfigId) : null;
  const alipay = app.alipayConfigId ? mockPaymentChannels.find((c) => c.id === app.alipayConfigId) : null;
  const unionpay = app.unionpayConfigId ? mockPaymentChannels.find((c) => c.id === app.unionpayConfigId) : null;
  app.openClientKey = openClient?.clientId ?? app.openClientKey;
  app.openClientName = openClient?.name ?? app.openClientName;
  app.environment = openClient?.environment ?? app.environment;
  app.wechatConfigName = app.wechatConfigName ?? wechat?.name ?? null;
  app.alipayConfigName = app.alipayConfigName ?? alipay?.name ?? null;
  app.unionpayConfigName = app.unionpayConfigName ?? unionpay?.name ?? null;
  if (!app.wechatConfigId) app.wechatConfigName = null;
  if (!app.alipayConfigId) app.alipayConfigName = null;
  if (!app.unionpayConfigId) app.unionpayConfigName = null;
  return app;
}

const appHandlers = [
  http.get('/api/payment/apps', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = apps.filter((a) => (!keyword || a.name.includes(keyword) || a.openClientKey.includes(keyword) || a.openClientName.includes(keyword)) && (!status || a.status === status));
    return ok(paginate([...filtered].reverse().map((a) => fillPaymentAppConfigNames({ ...a })), url));
  }),
  http.get('/api/payment/apps/:id', ({ params }) => {
    const app = apps.find((x) => x.id === Number(params.id));
    return app ? ok(fillPaymentAppConfigNames({ ...app })) : notFound('支付应用不存在');
  }),
  http.post('/api/payment/apps', async ({ request }) => {
    const b = (await request.json()) as Partial<PaymentApp>;
    const openClient = mockOAuth2Clients.find((client) => client.id === b.openClientId);
    if (!openClient || openClient.status !== 'enabled' || openClient.reviewStatus !== 'approved' || openClient.isPublic || !openClient.signEnabled) {
      return badRequest('所选开放客户端不可用于支付接入');
    }
    const now = mockDateTime();
    const item: PaymentApp = {
      id: nextAppId++, name: b.name ?? '', openClientId: openClient.id, openClientKey: openClient.clientId,
      openClientName: openClient.name, environment: openClient.environment, status: b.status ?? 'enabled',
      wechatConfigId: b.wechatConfigId ?? null, wechatConfigName: null,
      alipayConfigId: b.alipayConfigId ?? null, alipayConfigName: null,
      unionpayConfigId: b.unionpayConfigId ?? null, unionpayConfigName: null,
      remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    apps.push(fillPaymentAppConfigNames(item));
    return ok(item, '创建成功');
  }),
  http.put('/api/payment/apps/:id', async ({ params, request }) => {
    const app = apps.find((x) => x.id === Number(params.id));
    if (!app) return notFound('支付应用不存在');
    const b = (await request.json()) as Partial<PaymentApp>;
    Object.assign(app, {
      name: b.name ?? app.name,
      status: b.status ?? app.status,
      wechatConfigId: b.wechatConfigId !== undefined ? b.wechatConfigId : app.wechatConfigId,
      alipayConfigId: b.alipayConfigId !== undefined ? b.alipayConfigId : app.alipayConfigId,
      unionpayConfigId: b.unionpayConfigId !== undefined ? b.unionpayConfigId : app.unionpayConfigId,
      remark: b.remark !== undefined ? b.remark : app.remark,
      wechatConfigName: null,
      alipayConfigName: null,
      unionpayConfigName: null,
      updatedAt: mockDateTime(),
    });
    return ok(fillPaymentAppConfigNames(app), '更新成功');
  }),
  http.delete('/api/payment/apps/:id', ({ params }) => {
    const i = apps.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('支付应用不存在');
    apps.splice(i, 1);
    return ok(null, '删除成功');
  }),
];

// ─── 风控规则 ─────────────────────────────────────────────────────────────────
export const mockPaymentRiskRules: PaymentRiskRule[] = [
  { id: 1, name: '单笔大额拦截', scope: 'global', channel: null, bizType: null, singleLimit: 5000000, dailyLimit: null, dailyCountLimit: null, blockListKeys: ['risk_blacklist'], allowListKeys: ['vip_whitelist'], action: 'block', status: 'enabled', remark: '单笔不超过 5 万元；名单引用规则中心名单库', createdAt: SEED, updatedAt: SEED },
  { id: 2, name: '会员业务限频', scope: 'bizType', channel: null, bizType: 'membership', singleLimit: null, dailyLimit: 2000000, dailyCountLimit: 50, blockListKeys: [], allowListKeys: [], action: 'review', status: 'enabled', remark: null, createdAt: SEED, updatedAt: SEED },
];
const riskRules = mockPaymentRiskRules;
let nextRiskId = 3;

const riskHandlers = [
  http.get('/api/payment/risk-rules', ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const filtered = riskRules.filter((r) => (!scope || r.scope === scope) && (!status || r.status === status));
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.get('/api/payment/risk-rules/:id', ({ params }) => {
    const r = riskRules.find((x) => x.id === Number(params.id));
    return r ? ok(r) : notFound('风控规则不存在');
  }),
  http.post('/api/payment/risk-rules', async ({ request }) => {
    const b = (await request.json()) as Partial<PaymentRiskRule>;
    const now = mockDateTime();
    const item: PaymentRiskRule = {
      id: nextRiskId++, name: b.name ?? '', scope: b.scope ?? 'global', channel: (b.channel as PaymentChannel) ?? null, bizType: b.bizType ?? null,
      singleLimit: b.singleLimit ?? null, dailyLimit: b.dailyLimit ?? null, dailyCountLimit: b.dailyCountLimit ?? null, blockListKeys: b.blockListKeys ?? [],
      allowListKeys: b.allowListKeys ?? [], action: b.action ?? 'block',
      status: b.status ?? 'enabled', remark: b.remark ?? null, createdAt: now, updatedAt: now,
    };
    riskRules.push(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/payment/risk-rules/:id', async ({ params, request }) => {
    const r = riskRules.find((x) => x.id === Number(params.id));
    if (!r) return notFound('风控规则不存在');
    const b = (await request.json()) as Partial<PaymentRiskRule>;
    Object.assign(r, b, { updatedAt: mockDateTime() });
    return ok(r, '更新成功');
  }),
  http.delete('/api/payment/risk-rules/:id', ({ params }) => {
    const i = riskRules.findIndex((x) => x.id === Number(params.id));
    if (i === -1) return notFound('风控规则不存在');
    riskRules.splice(i, 1);
    return ok(null, '删除成功');
  }),
];

// ─── 支付方式配置 ─────────────────────────────────────────────────────────────
const methodHandlers = [
  http.get('/api/payment/methods/enabled', () => ok(methodConfigs.filter((m) => m.enabled).sort((a, b) => a.sort - b.sort))),
  http.get('/api/payment/methods', () => ok([...methodConfigs].sort((a, b) => a.sort - b.sort))),
  http.get('/api/payment/methods/:id', ({ params }) => {
    const m = methodConfigs.find((x) => x.id === Number(params.id));
    return m ? ok(m) : notFound('支付方式配置不存在');
  }),
  http.put('/api/payment/methods/:id', async ({ params, request }) => {
    const m = methodConfigs.find((x) => x.id === Number(params.id));
    if (!m) return notFound('支付方式配置不存在');
    const b = (await request.json()) as Partial<PaymentMethodConfig>;
    Object.assign(m, b, { updatedAt: mockDateTime() });
    return ok(m, '更新成功');
  }),
];

// ─── 财务报表 ─────────────────────────────────────────────────────────────────
const reportHandlers = [
  http.get('/api/payment/reports/summary', ({ request }) => {
    const url = new URL(request.url);
    const groupBy = (url.searchParams.get('groupBy') as PaymentReportGroupBy) ?? 'day';
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    const paid = mockPaymentOrders.filter((o) => o.status === 'success' || o.status === 'refunding' || o.status === 'refunded');
    const groups = new Map<string, { gross: number; fee: number; refund: number; count: number }>();
    const orderGroup = new Map<string, string>();
    const dimensionKey = (order: (typeof mockPaymentOrders)[number], eventTime: string) => {
      if (groupBy === 'application') return String(order.appId);
      if (groupBy === 'merchantAccount') return String(order.channelConfigId);
      if (groupBy === 'currency') return order.currency;
      if (groupBy === 'channel') return order.channel;
      return eventTime.slice(0, 10);
    };
    for (const o of paid) {
      const paidTime = o.paidAt ?? o.createdAt;
      if (startTime && paidTime < startTime) continue;
      if (endTime && paidTime > endTime) continue;
      const key = dimensionKey(o, paidTime);
      orderGroup.set(o.orderNo, key);
      const g = groups.get(key) ?? { gross: 0, fee: 0, refund: 0, count: 0 };
      g.gross += o.paidAmount ?? o.amount;
      g.fee += o.feeAmount ?? Math.round((o.paidAmount ?? o.amount) * 0.006);
      g.count += 1;
      groups.set(key, g);
    }
    for (const refund of mockPaymentRefunds) {
      if (refund.status !== 'success') continue;
      const order = mockPaymentOrders.find((o) => o.orderNo === refund.orderNo);
      if (!order) continue;
      const refundedAt = refund.refundedAt ?? refund.createdAt;
      if (startTime && refundedAt < startTime) continue;
      if (endTime && refundedAt > endTime) continue;
      const key = orderGroup.get(order.orderNo) ?? dimensionKey(order, refundedAt);
      const g = groups.get(key) ?? { gross: 0, fee: 0, refund: 0, count: 0 };
      g.refund += refund.refundAmount;
      groups.set(key, g);
    }
    const rows: PaymentReportRow[] = [...groups.entries()].map(([key, g]) => {
      const label = groupBy === 'channel'
        ? (PAYMENT_CHANNEL_LABELS[key as PaymentChannel] ?? key)
        : groupBy === 'application'
          ? (apps.find((app) => String(app.id) === key)?.name ?? `应用 #${key}`)
          : groupBy === 'merchantAccount'
            ? (mockPaymentChannels.find((config) => String(config.id) === key)?.name ?? `配置 #${key}`)
            : key;
      // Mock 简化：分账按 0 计（真实口径见 payment-report.service）
      return { key, label, gross: g.gross, fee: g.fee, refund: g.refund, sharing: 0, net: g.gross - g.fee - g.refund, count: g.count };
    });
    rows.sort((a, b) => a.key.localeCompare(b.key));
    const summary = {
      groupBy,
      rows,
      totalGross: rows.reduce((s, r) => s + r.gross, 0),
      totalFee: rows.reduce((s, r) => s + r.fee, 0),
      totalRefund: rows.reduce((s, r) => s + r.refund, 0),
      totalSharing: 0,
      totalNet: rows.reduce((s, r) => s + r.net, 0),
      totalCount: rows.reduce((s, r) => s + r.count, 0),
    };
    const compare = url.searchParams.get('compare') === 'true';
    return ok({
      ...summary,
      prev: compare ? {
        totalGross: Math.round(summary.totalGross * 0.8),
        totalFee: Math.round(summary.totalFee * 0.8),
        totalRefund: Math.round(summary.totalRefund * 0.8),
        totalSharing: 0,
        totalNet: Math.round(summary.totalNet * 0.8),
        totalCount: Math.round(summary.totalCount * 0.8),
        rows: rows.map((r) => ({ ...r, gross: Math.round(r.gross * 0.8), fee: Math.round(r.fee * 0.8), refund: Math.round(r.refund * 0.8), net: Math.round(r.net * 0.8), count: Math.round(r.count * 0.8) })),
      } : null,
    });
  }),
];

// ─── 转账/代付 ────────────────────────────────────────────────────────────────
const transfers: PaymentTransfer[] = [
  { id: 1, transferNo: 'TRF1700000000001', outTransferNo: 'TRF1700000000001', channel: 'wechat', appId: 1, channelConfigId: 1, currency: 'CNY', receiverAccount: 'oDEMO_openid_001', receiverName: '张三', amount: 5000, remark: '活动奖励发放', status: 'success', approvalStatus: 'none', appliedById: 1, approverId: null, approvedAt: null, approvalRemark: null, channelTransferNo: 'WXTRF202401010001', failReason: null, attempts: 1, fundReservationId: 20001, version: 1, bizType: 'activity_reward', bizId: 'ACT-1', finishedAt: SEED, operatorName: '管理员', createdAt: SEED, updatedAt: SEED },
  { id: 2, transferNo: 'TRF1700000000002', outTransferNo: 'TRF1700000000002', channel: 'alipay', appId: 3, channelConfigId: 2, currency: 'CNY', receiverAccount: 'demo@alipay.com', receiverName: null, amount: 12000, remark: '供应商结算', status: 'processing', approvalStatus: 'none', appliedById: 1, approverId: null, approvedAt: null, approvalRemark: null, channelTransferNo: 'ALITRF202401010002', failReason: null, attempts: 1, fundReservationId: 20002, version: 0, bizType: null, bizId: null, finishedAt: null, operatorName: '管理员', createdAt: SEED, updatedAt: SEED },
  { id: 3, transferNo: 'TRF1700000000003', outTransferNo: 'TRF1700000000003', channel: 'wechat', appId: 1, channelConfigId: 1, currency: 'CNY', receiverAccount: 'oDEMO_openid_003', receiverName: null, amount: 800, remark: '红包补发', status: 'failed', approvalStatus: 'none', appliedById: 1, approverId: null, approvedAt: null, approvalRemark: null, channelTransferNo: null, failReason: '收款账号不存在', attempts: 1, fundReservationId: 20003, version: 1, bizType: null, bizId: null, finishedAt: SEED, operatorName: '管理员', createdAt: SEED, updatedAt: SEED },
  { id: 4, transferNo: 'TRF1700000000004', outTransferNo: 'TRF1700000000004', channel: 'wechat', appId: 1, channelConfigId: 1, currency: 'CNY', receiverAccount: 'oDEMO_openid_004', receiverName: '李四', amount: 180000, remark: '市场活动大额奖励', status: 'pending', approvalStatus: 'pending', appliedById: 2, approverId: null, approvedAt: null, approvalRemark: null, channelTransferNo: null, failReason: null, attempts: 0, fundReservationId: 20004, version: 0, bizType: 'activity_reward', bizId: 'ACT-4', finishedAt: null, operatorName: '财务经办', createdAt: SEED, updatedAt: SEED },
];
let nextTransferId = 5;
const transferIdempotency = new Map<string, { requestHash: string; transferId: number }>();

const transferHandlers = [
  http.get('/api/payment/transfers/summary', () => {
    const success = transfers.filter((t) => t.status === 'success');
    return ok({
      totalAmount: success.reduce((s, t) => s + t.amount, 0),
      successCount: success.length,
      processingCount: transfers.filter((t) => t.status === 'processing' || t.status === 'unknown').length,
      failedCount: transfers.filter((t) => t.status === 'failed').length,
    });
  }),
  http.get('/api/payment/transfers', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const channel = url.searchParams.get('channel') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const approvalStatus = url.searchParams.get('approvalStatus') ?? '';
    const filtered = transfers.filter(
      (t) =>
        (!keyword || t.transferNo.includes(keyword) || t.receiverAccount.includes(keyword)) &&
        (!channel || t.channel === channel) &&
        (!status || t.status === status) &&
        (!approvalStatus || t.approvalStatus === approvalStatus),
    );
    return ok(paginate([...filtered].reverse(), url));
  }),
  http.get('/api/payment/transfers/:id', ({ params }) => {
    const t = transfers.find((x) => x.id === Number(params.id));
    return t ? ok(t) : notFound('转账单不存在');
  }),
  http.post('/api/payment/transfers', async ({ request }) => {
    const b = (await request.json()) as { applicationId: number; channel: PaymentChannel; currency?: string; receiverAccount: string; receiverName?: string; amount: number; remark?: string; bizType?: string; bizId?: string };
    const idempotencyKey = request.headers.get('X-Idempotency-Key')?.trim() ?? '';
    if (idempotencyKey.length < 8) return badRequest('X-Idempotency-Key 不能为空且至少 8 位', { status: 400 });
    const remark = b.remark?.trim() ?? '';
    if (!remark) return badRequest('转账原因不能为空', { status: 400 });
    const requestHash = JSON.stringify({
      applicationId: b.applicationId,
      channel: b.channel,
      currency: b.currency ?? 'CNY',
      receiverAccount: b.receiverAccount,
      receiverName: b.receiverName ?? null,
      amount: b.amount,
      remark,
      bizType: b.bizType ?? null,
      bizId: b.bizId ?? null,
    });
    const mapKey = `${b.applicationId}:${idempotencyKey}`;
    const previous = transferIdempotency.get(mapKey);
    if (previous) {
      if (previous.requestHash !== requestHash) return conflict('同一幂等键不能用于不同转账请求', { status: 409 });
      const existing = transfers.find((transfer) => transfer.id === previous.transferId);
      return existing ? ok(existing, '转账已受理') : conflict('幂等记录对应的转账单不存在', { status: 409 });
    }
    const app = apps.find((item) => item.id === b.applicationId && item.status === 'enabled');
    const channelConfigId = b.channel === 'wechat' ? app?.wechatConfigId : b.channel === 'alipay' ? app?.alipayConfigId : app?.unionpayConfigId;
    if (!app || !channelConfigId) return badRequest('支付应用未绑定所选转账渠道');
    const now = mockDateTime();
    const no = `TRF${Date.now()}`;
    const transferId = nextTransferId++;
    const needsApproval = b.amount >= 100_000;
    const item: PaymentTransfer = {
      id: transferId, transferNo: no, outTransferNo: no, channel: b.channel, appId: app.id, channelConfigId, currency: b.currency ?? 'CNY', receiverAccount: b.receiverAccount,
      receiverName: b.receiverName ?? null, amount: b.amount, remark, status: needsApproval ? 'pending' : 'success',
      approvalStatus: needsApproval ? 'pending' : 'none', appliedById: 1, approverId: null, approvedAt: null, approvalRemark: null,
      channelTransferNo: needsApproval ? null : `${b.channel === 'wechat' ? 'WXTRF' : 'ALITRF'}${Date.now()}`, failReason: null, attempts: needsApproval ? 0 : 1,
      fundReservationId: 20000 + transferId, version: 0, bizType: b.bizType ?? null, bizId: b.bizId ?? null, finishedAt: needsApproval ? null : now, operatorName: '管理员', createdAt: now, updatedAt: now,
    };
    transfers.push(item);
    transferIdempotency.set(mapKey, { requestHash, transferId: item.id });
    if (!needsApproval) {
      recordMockSystemJournal({ sourceType: 'payment.transfer', sourceId: item.transferNo, description: `转账出款 ${item.transferNo}`, appId: item.appId, channelConfigId: item.channelConfigId, currency: item.currency, lines: [{ accountCode: 'merchant_available', debitAmount: String(item.amount), memo: '扣减商户可用余额' }, { accountCode: 'provider_clearing', creditAmount: String(item.amount), memo: '渠道出款清算' }] });
    }
    return ok(item, needsApproval ? '转账申请已提交，等待审批' : '转账已受理');
  }),
  http.post('/api/payment/transfers/:id/approve', async ({ params, request }) => {
    const t = transfers.find((x) => x.id === Number(params.id));
    if (!t) return notFound('转账单不存在');
    const body = (await request.json()) as { remark?: string };
    const remark = body.remark?.trim() ?? '';
    if (!remark) return badRequest('审批意见不能为空');
    if (t.status !== 'pending' || t.approvalStatus !== 'pending') return badRequest('该转账单无需审批或已处理');
    if (t.appliedById === 1) return forbidden('转账申请人与审批人必须为不同用户');
    const now = mockDateTime();
    t.approvalStatus = 'approved';
    t.approverId = 1;
    t.approvedAt = now;
    t.approvalRemark = remark;
    t.status = 'success';
    t.attempts = 1;
    t.channelTransferNo = `${t.channel === 'wechat' ? 'WXTRF' : 'ALITRF'}${Date.now()}`;
    t.finishedAt = now;
    t.updatedAt = now;
    t.version += 2;
    recordMockSystemJournal({ sourceType: 'payment.transfer', sourceId: t.transferNo, description: `转账出款 ${t.transferNo}`, appId: t.appId, channelConfigId: t.channelConfigId, currency: t.currency, lines: [{ accountCode: 'merchant_available', debitAmount: String(t.amount), memo: '扣减商户可用余额' }, { accountCode: 'provider_clearing', creditAmount: String(t.amount), memo: '渠道出款清算' }] });
    return ok(t, '转账审批通过并已受理');
  }),
  http.post('/api/payment/transfers/:id/reject', async ({ params, request }) => {
    const t = transfers.find((x) => x.id === Number(params.id));
    if (!t) return notFound('转账单不存在');
    const body = (await request.json()) as { remark?: string };
    const remark = body.remark?.trim() ?? '';
    if (!remark) return badRequest('审批意见不能为空');
    if (t.status !== 'pending' || t.approvalStatus !== 'pending') return badRequest('该转账单无需审批或已处理');
    const now = mockDateTime();
    t.approvalStatus = 'rejected';
    t.approverId = 1;
    t.approvedAt = now;
    t.approvalRemark = remark;
    t.status = 'failed';
    t.failReason = '转账审批被驳回';
    t.finishedAt = now;
    t.updatedAt = now;
    t.version += 1;
    return ok(t, '转账已驳回');
  }),
  http.post('/api/payment/transfers/:id/query', ({ params }) => {
    const t = transfers.find((x) => x.id === Number(params.id));
    if (!t) return notFound('转账单不存在');
    if (t.status === 'processing') {
      t.status = 'success';
      t.version += 1;
      t.finishedAt = mockDateTime();
      t.updatedAt = mockDateTime();
      recordMockSystemJournal({ sourceType: 'payment.transfer', sourceId: t.transferNo, description: `转账出款 ${t.transferNo}`, appId: t.appId, channelConfigId: t.channelConfigId, currency: t.currency, lines: [{ accountCode: 'merchant_available', debitAmount: String(t.amount), memo: '扣减商户可用余额' }, { accountCode: 'provider_clearing', creditAmount: String(t.amount), memo: '渠道出款清算' }] });
    }
    return ok(t, '查单完成');
  }),
];

export const paymentBExtHandlers = [
  ...feeHandlers,
  ...settlementHandlers,
  ...sharingHandlers,
  ...linkHandlers,
  ...appHandlers,
  ...riskHandlers,
  ...methodHandlers,
  ...reportHandlers,
  ...transferHandlers,
];
