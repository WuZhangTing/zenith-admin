import { http } from 'msw';
import type {
  PaymentFundReservation,
  PaymentJournal,
  PaymentJournalLine,
  PaymentLedgerAccount,
  PaymentLedgerAccountCode,
} from '@zenith/shared/payment';
import { mockDateTime } from '@/mocks/utils/date';
import { badRequest, conflict, notFound, ok, paginate } from '@/mocks/utils/handlers';

type NormalBalance = PaymentLedgerAccount['normalBalance'];

const ACCOUNT_META: Record<PaymentLedgerAccountCode, { name: string; normalBalance: NormalBalance }> = {
  provider_clearing: { name: '渠道清算', normalBalance: 'debit' },
  merchant_pending: { name: '商户待结算', normalBalance: 'credit' },
  merchant_available: { name: '商户可用', normalBalance: 'credit' },
  merchant_frozen: { name: '商户冻结', normalBalance: 'credit' },
  platform_fee: { name: '平台手续费', normalBalance: 'credit' },
  refund_payable: { name: '退款应付', normalBalance: 'credit' },
  sharing_payable: { name: '分账应付', normalBalance: 'credit' },
  payout_payable: { name: '出款应付', normalBalance: 'credit' },
  suspense: { name: '待查资金', normalBalance: 'credit' },
};

const accounts: PaymentLedgerAccount[] = [];
const journals: PaymentJournal[] = [];
const reservations: PaymentFundReservation[] = [];
let nextAccountId = 1;
let nextJournalId = 1;
let nextLineId = 1;
let nextReservationId = 1;

export interface MockSystemJournalInput {
  sourceType: string;
  sourceId: string;
  description: string;
  appId: number;
  channelConfigId: number;
  currency: string;
  lines: Array<{
    accountCode: PaymentLedgerAccountCode;
    debitAmount?: string;
    creditAmount?: string;
    memo?: string;
  }>;
}

function ensureAccount(scope: Pick<MockSystemJournalInput, 'appId' | 'channelConfigId' | 'currency'>, code: PaymentLedgerAccountCode): PaymentLedgerAccount {
  const existing = accounts.find((account) => account.appId === scope.appId
    && account.channelConfigId === scope.channelConfigId
    && account.currency === scope.currency
    && account.code === code);
  if (existing) return existing;
  const meta = ACCOUNT_META[code];
  const now = mockDateTime();
  const account: PaymentLedgerAccount = {
    id: nextAccountId++,
    accountNo: `PLA${scope.appId}${scope.channelConfigId}${code.replaceAll('_', '').toUpperCase()}`,
    name: meta.name,
    code,
    normalBalance: meta.normalBalance,
    appId: scope.appId,
    channelConfigId: scope.channelConfigId,
    currency: scope.currency,
    status: 'enabled',
    createdAt: now,
    updatedAt: now,
  };
  accounts.push(account);
  return account;
}

function totals(lines: Array<Pick<PaymentJournalLine, 'debitAmount' | 'creditAmount'>>) {
  return lines.reduce((sum, line) => ({
    debit: sum.debit + BigInt(line.debitAmount),
    credit: sum.credit + BigInt(line.creditAmount),
  }), { debit: 0n, credit: 0n });
}

export function recordMockSystemJournal(input: MockSystemJournalInput): PaymentJournal {
  const existing = journals.find((journal) => journal.sourceType === input.sourceType
    && journal.sourceId === input.sourceId
    && journal.appId === input.appId
    && journal.channelConfigId === input.channelConfigId
    && journal.currency === input.currency);
  if (existing) return existing;
  const now = mockDateTime();
  const journalId = nextJournalId++;
  const lines: PaymentJournalLine[] = input.lines.map((line, index) => {
    const account = ensureAccount(input, line.accountCode);
    return {
      id: nextLineId++,
      lineNo: index + 1,
      accountId: account.id,
      accountNo: account.accountNo,
      accountName: account.name,
      debitAmount: line.debitAmount ?? '0',
      creditAmount: line.creditAmount ?? '0',
      memo: line.memo ?? null,
    };
  });
  const total = totals(lines);
  if (total.debit <= 0n || total.debit !== total.credit) throw new Error('Mock Journal 借贷不平衡');
  const journal: PaymentJournal = {
    id: journalId,
    journalNo: `JRNMOCK${String(journalId).padStart(8, '0')}`,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    description: input.description,
    appId: input.appId,
    channelConfigId: input.channelConfigId,
    currency: input.currency,
    reversalOfJournalId: null,
    reversedByJournalId: null,
    operatorId: null,
    postedAt: now,
    createdAt: now,
    lines,
  };
  journals.unshift(journal);
  return journal;
}

recordMockSystemJournal({
  sourceType: 'payment.capture',
  sourceId: 'PAY1700000000001',
  description: '支付收款 PAY1700000000001',
  appId: 1,
  channelConfigId: 1,
  currency: 'CNY',
  lines: [
    { accountCode: 'provider_clearing', debitAmount: '9900', memo: '渠道应收增加' },
    { accountCode: 'merchant_available', creditAmount: '9900', memo: '商户可用余额增加' },
  ],
});

function filterAccounts(url: URL) {
  const keyword = url.searchParams.get('keyword')?.trim() ?? '';
  const appId = Number(url.searchParams.get('appId') ?? 0);
  const channelConfigId = Number(url.searchParams.get('channelConfigId') ?? 0);
  const currency = url.searchParams.get('currency') ?? '';
  const status = url.searchParams.get('status') ?? '';
  return accounts.filter((account) => (!keyword || account.accountNo.includes(keyword) || account.name.includes(keyword))
    && (!appId || account.appId === appId)
    && (!channelConfigId || account.channelConfigId === channelConfigId)
    && (!currency || account.currency === currency)
    && (!status || account.status === status));
}

function filterJournals(url: URL) {
  const sourceType = url.searchParams.get('sourceType') ?? '';
  const appId = Number(url.searchParams.get('appId') ?? 0);
  const channelConfigId = Number(url.searchParams.get('channelConfigId') ?? 0);
  const currency = url.searchParams.get('currency') ?? '';
  return journals.filter((journal) => (!sourceType || journal.sourceType === sourceType)
    && (!appId || journal.appId === appId)
    && (!channelConfigId || journal.channelConfigId === channelConfigId)
    && (!currency || journal.currency === currency));
}

function filterReservations(url: URL) {
  const accountId = Number(url.searchParams.get('accountId') ?? 0);
  const sourceType = url.searchParams.get('sourceType') ?? '';
  const status = url.searchParams.get('status') ?? '';
  return reservations.filter((reservation) => (!accountId || reservation.accountId === accountId)
    && (!sourceType || reservation.sourceType === sourceType)
    && (!status || reservation.status === status));
}

export const paymentJournalHandlers = [
  http.get('/api/payment/journals/accounts', ({ request }) => {
    const url = new URL(request.url);
    return ok(paginate([...filterAccounts(url)].reverse(), url, 20));
  }),
  http.post('/api/payment/journals/accounts', async ({ request }) => {
    const body = (await request.json()) as { name?: string; code?: PaymentLedgerAccountCode; appId?: number; channelConfigId?: number; currency?: string };
    if (!body.name?.trim() || !body.code || !body.appId || !body.channelConfigId || !body.currency) return badRequest('账本账户参数不完整');
    if (accounts.some((account) => account.appId === body.appId && account.channelConfigId === body.channelConfigId && account.currency === body.currency && account.code === body.code)) {
      return conflict('同一账务作用域下该科目已存在');
    }
    const account = ensureAccount({ appId: body.appId, channelConfigId: body.channelConfigId, currency: body.currency }, body.code);
    account.name = body.name.trim();
    return ok(account, '创建成功');
  }),
  http.get('/api/payment/journals/accounts/:id/active-reservation', ({ params }) => {
    const accountId = Number(params.id);
    if (!accounts.some((account) => account.id === accountId)) return notFound('账本账户不存在');
    const amount = reservations
      .filter((reservation) => reservation.accountId === accountId && reservation.status === 'active')
      .reduce((sum, reservation) => sum + BigInt(reservation.amount), 0n);
    return ok({ accountId, amount: amount.toString() });
  }),
  http.get('/api/payment/journals/reservations', ({ request }) => {
    const url = new URL(request.url);
    return ok(paginate([...filterReservations(url)].reverse(), url, 20));
  }),
  http.post('/api/payment/journals/reservations', async ({ request }) => {
    const body = (await request.json()) as { accountId?: number; sourceType?: string; sourceId?: string; amount?: string; reason?: string; expiresAt?: string };
    const account = accounts.find((item) => item.id === body.accountId);
    if (!account) return notFound('账本账户不存在');
    if (!body.sourceType?.startsWith('manual.') || !body.sourceId?.trim() || !body.amount || BigInt(body.amount) <= 0n || !body.reason?.trim()) {
      return badRequest('资金预占参数不完整或不合法');
    }
    const now = mockDateTime();
    const reservation: PaymentFundReservation = {
      id: nextReservationId++,
      reservationNo: `RSVMOCK${String(nextReservationId).padStart(8, '0')}`,
      accountId: account.id,
      sourceType: body.sourceType,
      sourceId: body.sourceId.trim(),
      amount: body.amount,
      status: 'active',
      version: 0,
      reason: body.reason.trim(),
      finalizationReason: null,
      appId: account.appId,
      channelConfigId: account.channelConfigId,
      currency: account.currency,
      expiresAt: body.expiresAt ?? null,
      finalizedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    reservations.push(reservation);
    return ok(reservation, '预占成功');
  }),
  http.post('/api/payment/journals/reservations/:id/:action', async ({ params, request }) => {
    const reservation = reservations.find((item) => item.id === Number(params.id));
    if (!reservation) return notFound('资金预占不存在');
    const action = String(params.action);
    if (action !== 'capture' && action !== 'release') return notFound('操作不存在');
    const body = (await request.json()) as { version?: number; reason?: string };
    if (body.version !== reservation.version) return conflict('资金预占版本已变化');
    if (reservation.status !== 'active') return conflict('资金预占已处理');
    if (!body.reason?.trim()) return badRequest('处理原因不能为空');
    reservation.status = action === 'capture' ? 'captured' : 'released';
    reservation.finalizationReason = body.reason.trim();
    reservation.finalizedAt = mockDateTime();
    reservation.updatedAt = mockDateTime();
    reservation.version += 1;
    return ok(reservation, action === 'capture' ? '核销成功' : '释放成功');
  }),
  http.get('/api/payment/journals', ({ request }) => {
    const url = new URL(request.url);
    return ok(paginate(filterJournals(url), url, 20));
  }),
  http.get('/api/payment/journals/:id', ({ params }) => {
    const journal = journals.find((item) => item.id === Number(params.id));
    return journal ? ok(journal) : notFound('资金凭证不存在');
  }),
  http.post('/api/payment/journals', async ({ request }) => {
    const body = (await request.json()) as {
      sourceType?: string;
      sourceId?: string;
      description?: string;
      appId?: number;
      channelConfigId?: number;
      currency?: string;
      lines?: Array<{ accountId: number; debitAmount: string; creditAmount: string; memo?: string }>;
    };
    if (!body.sourceType?.startsWith('manual.') || !body.sourceId?.trim() || !body.description?.trim() || !body.appId || !body.channelConfigId || !body.currency || !body.lines?.length) {
      return badRequest('资金凭证参数不完整');
    }
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const lines = body.lines.map((line, index): PaymentJournalLine | null => {
      const account = accountById.get(line.accountId);
      if (!account || account.appId !== body.appId || account.channelConfigId !== body.channelConfigId || account.currency !== body.currency) return null;
      return { id: nextLineId++, lineNo: index + 1, accountId: account.id, accountNo: account.accountNo, accountName: account.name, debitAmount: line.debitAmount, creditAmount: line.creditAmount, memo: line.memo ?? null };
    });
    if (lines.some((line) => line == null)) return badRequest('凭证账户与账务作用域不一致');
    const typedLines = lines as PaymentJournalLine[];
    const total = totals(typedLines);
    if (total.debit <= 0n || total.debit !== total.credit) return badRequest('资金凭证借贷金额必须相等且大于 0');
    const existing = journals.find((journal) => journal.sourceType === body.sourceType && journal.sourceId === body.sourceId && journal.appId === body.appId && journal.channelConfigId === body.channelConfigId && journal.currency === body.currency);
    if (existing) return ok(existing, '过账成功');
    const now = mockDateTime();
    const journal: PaymentJournal = { id: nextJournalId++, journalNo: `JRNMOCK${String(nextJournalId).padStart(8, '0')}`, sourceType: body.sourceType, sourceId: body.sourceId.trim(), description: body.description.trim(), appId: body.appId, channelConfigId: body.channelConfigId, currency: body.currency, reversalOfJournalId: null, reversedByJournalId: null, operatorId: 1, postedAt: now, createdAt: now, lines: typedLines };
    journals.unshift(journal);
    return ok(journal, '过账成功');
  }),
  http.post('/api/payment/journals/:id/reverse', async ({ params, request }) => {
    const original = journals.find((item) => item.id === Number(params.id));
    if (!original) return notFound('资金凭证不存在');
    if (journals.some((journal) => journal.reversalOfJournalId === original.id)) return conflict('该资金凭证已冲正');
    const body = (await request.json()) as { reason?: string };
    if (!body.reason?.trim()) return badRequest('冲正原因不能为空');
    const now = mockDateTime();
    const reversal: PaymentJournal = {
      ...original,
      id: nextJournalId++,
      journalNo: `JRNMOCK${String(nextJournalId).padStart(8, '0')}`,
      sourceType: 'manual.reversal',
      sourceId: `reversal:${original.id}`,
      description: `冲正 ${original.journalNo}：${body.reason.trim()}`,
      reversalOfJournalId: original.id,
      reversedByJournalId: null,
      operatorId: 1,
      postedAt: now,
      createdAt: now,
      lines: original.lines.map((line, index) => ({ ...line, id: nextLineId++, lineNo: index + 1, debitAmount: line.creditAmount, creditAmount: line.debitAmount })),
    };
    original.reversedByJournalId = reversal.id;
    journals.unshift(reversal);
    return ok(reversal, '冲正成功');
  }),
];
