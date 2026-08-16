/**
 * 支付手续费/费率 Service。
 * 维护费率规则（按渠道/支付方式匹配，万分比 + 固定费，clamp 上下限），
 * 监听 payment.succeeded 计算手续费：回写订单 feeAmount/netAmount 并记资金台账（type=fee）。
 */
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { paymentFeeRules, paymentLedgerEntries, paymentOrders, paymentRefunds, type PaymentFeeRuleRow } from '../../db/schema';
import { currentUser } from '../../lib/context';
import { getCreateTenantId, tenantCondition } from '../../lib/tenant';
import { mergeWhere, withPagination } from '../../lib/where-helpers';
import { formatDateTime } from '../../lib/datetime';
import { recordLedgerEntry } from './payment-ledger.service';
import { paymentEventBus } from '../../lib/payment-event-bus';
import logger from '../../lib/logger';
import type { CreatePaymentFeeRuleInput, UpdatePaymentFeeRuleInput } from '@zenith/shared/payment';
import type { PaymentChannel, PaymentFeeRule, PaymentMethod } from '@zenith/shared/payment';

export function mapFeeRule(row: PaymentFeeRuleRow): PaymentFeeRule {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    payMethod: row.payMethod ?? null,
    rateBps: row.rateBps,
    fixedFee: row.fixedFee,
    minFee: row.minFee ?? null,
    maxFee: row.maxFee ?? null,
    status: row.status,
    priority: row.priority,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export interface ListFeeRulesQuery {
  page?: number;
  pageSize?: number;
  channel?: PaymentChannel;
  status?: 'enabled' | 'disabled';
}

export async function listFeeRules(q: ListFeeRulesQuery) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 10;
  const conds = [];
  if (q.channel) conds.push(eq(paymentFeeRules.channel, q.channel));
  if (q.status) conds.push(eq(paymentFeeRules.status, q.status));
  const where = mergeWhere(conds.length ? and(...conds) : undefined, tenantCondition(paymentFeeRules, currentUser()));
  const [total, list] = await Promise.all([
    db.$count(paymentFeeRules, where),
    withPagination(
      db.select().from(paymentFeeRules).where(where).orderBy(desc(paymentFeeRules.priority), desc(paymentFeeRules.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { list: list.map(mapFeeRule), total, page, pageSize };
}

async function ensureFeeRule(id: number): Promise<PaymentFeeRuleRow> {
  const tc = tenantCondition(paymentFeeRules, currentUser());
  const [row] = await db.select().from(paymentFeeRules).where(and(eq(paymentFeeRules.id, id), tc)).limit(1);
  if (!row) throw new HTTPException(404, { message: '费率规则不存在' });
  return row;
}

export async function getFeeRule(id: number): Promise<PaymentFeeRule> {
  return mapFeeRule(await ensureFeeRule(id));
}

function assertFeeBounds(min?: number | null, max?: number | null): void {
  if (min != null && max != null && min > max) {
    throw new HTTPException(400, { message: '最低手续费不能大于最高手续费' });
  }
}

export async function createFeeRule(input: CreatePaymentFeeRuleInput): Promise<PaymentFeeRule> {
  assertFeeBounds(input.minFee, input.maxFee);
  const [row] = await db
    .insert(paymentFeeRules)
    .values({
      name: input.name,
      channel: input.channel,
      payMethod: input.payMethod ?? null,
      rateBps: input.rateBps ?? 0,
      fixedFee: input.fixedFee ?? 0,
      minFee: input.minFee ?? null,
      maxFee: input.maxFee ?? null,
      status: input.status ?? 'enabled',
      priority: input.priority ?? 0,
      remark: input.remark ?? null,
      tenantId: getCreateTenantId(currentUser()),
    })
    .returning();
  return mapFeeRule(row);
}

export async function updateFeeRule(id: number, input: UpdatePaymentFeeRuleInput): Promise<PaymentFeeRule> {
  const existing = await ensureFeeRule(id);
  const min = input.minFee !== undefined ? input.minFee : existing.minFee;
  const max = input.maxFee !== undefined ? input.maxFee : existing.maxFee;
  assertFeeBounds(min, max);
  const set: Partial<PaymentFeeRuleRow> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.channel !== undefined) set.channel = input.channel;
  if (input.payMethod !== undefined) set.payMethod = input.payMethod ?? null;
  if (input.rateBps !== undefined) set.rateBps = input.rateBps;
  if (input.fixedFee !== undefined) set.fixedFee = input.fixedFee;
  if (input.minFee !== undefined) set.minFee = input.minFee ?? null;
  if (input.maxFee !== undefined) set.maxFee = input.maxFee ?? null;
  if (input.status !== undefined) set.status = input.status;
  if (input.priority !== undefined) set.priority = input.priority;
  if (input.remark !== undefined) set.remark = input.remark ?? null;
  const tc = tenantCondition(paymentFeeRules, currentUser());
  const [row] = await db.update(paymentFeeRules).set(set).where(and(eq(paymentFeeRules.id, id), tc)).returning();
  return mapFeeRule(row);
}

export async function deleteFeeRule(id: number): Promise<void> {
  await ensureFeeRule(id);
  await db.delete(paymentFeeRules).where(eq(paymentFeeRules.id, id));
}

/** 计算手续费（分）：rate*amount/10000 + fixed，clamp[min,max]。无匹配规则返回 0。 */
export function computeFeeByRule(rule: PaymentFeeRuleRow, amount: number): number {
  let fee = Math.round((amount * rule.rateBps) / 10000) + rule.fixedFee;
  if (rule.minFee != null) fee = Math.max(fee, rule.minFee);
  if (rule.maxFee != null) fee = Math.min(fee, rule.maxFee);
  return Math.max(0, Math.min(fee, amount));
}

/** 匹配最优费率规则（按 tenant + channel + payMethod，优先 payMethod 精确，再按 priority 降序）。 */
export async function matchFeeRule(channel: PaymentChannel, payMethod: PaymentMethod, tenantId: number | null): Promise<PaymentFeeRuleRow | null> {
  const tenantCond = tenantId == null ? isNull(paymentFeeRules.tenantId) : or(eq(paymentFeeRules.tenantId, tenantId), isNull(paymentFeeRules.tenantId));
  const rows = await db
    .select()
    .from(paymentFeeRules)
    .where(and(eq(paymentFeeRules.status, 'enabled'), eq(paymentFeeRules.channel, channel), or(isNull(paymentFeeRules.payMethod), eq(paymentFeeRules.payMethod, payMethod)), tenantCond))
    .orderBy(desc(paymentFeeRules.priority), desc(paymentFeeRules.id));
  if (rows.length === 0) return null;
  const exact = rows.find((r) => r.payMethod === payMethod);
  return exact ?? rows[0];
}

/** 支付成功后结算手续费：回写订单 feeAmount/netAmount + 记台账。
 * 幂等与并发安全：feeAmount 回写用条件 UPDATE（仅未计费订单命中）充当 claim，
 * 台账插入由 recordLedgerEntry 的唯一索引 + ON CONFLICT 兜底，事件重复投递/并发双投均不会重复记账。 */
export async function settleOrderFee(orderNo: string): Promise<void> {
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderNo, orderNo)).limit(1);
  if (!order) return;
  const amount = order.paidAmount ?? order.amount;
  let fee = order.feeAmount;
  let ruleName: string | null = null;

  if (fee == null) {
    const rule = await matchFeeRule(order.channel, order.payMethod, order.tenantId);
    fee = rule ? computeFeeByRule(rule, amount) : 0;
    ruleName = rule?.name ?? null;
    const claimed = await db
      .update(paymentOrders)
      .set({ feeAmount: fee, netAmount: amount - fee })
      .where(and(eq(paymentOrders.id, order.id), isNull(paymentOrders.feeAmount)))
      .returning({ feeAmount: paymentOrders.feeAmount });
    if (claimed.length === 0) {
      // 竞争失败：另一次投递已计费，读回真实费用仅做台账补偿（崩溃恢复场景）
      const [fresh] = await db.select({ feeAmount: paymentOrders.feeAmount }).from(paymentOrders).where(eq(paymentOrders.id, order.id)).limit(1);
      fee = fresh?.feeAmount ?? fee;
      ruleName = null;
    }
  } else if (order.netAmount == null) {
    await db
      .update(paymentOrders)
      .set({ netAmount: amount - fee })
      .where(and(eq(paymentOrders.id, order.id), isNull(paymentOrders.netAmount)));
  }

  if (fee != null && fee > 0) {
    await recordLedgerEntry({
      direction: 'out',
      type: 'fee',
      amount: fee,
      orderNo: order.orderNo,
      channel: order.channel,
      bizType: order.bizType,
      tenantId: order.tenantId,
      remark: ruleName ? `手续费（${ruleName}）` : '手续费',
    });
  }
}

let registered = false;
/** 注册手续费订阅者（支付成功结算手续费，退款成功按比例冲销）。 */
export function registerFeeSubscribers(): void {
  if (registered) return;
  registered = true;
  paymentEventBus.on('payment.succeeded', (e) => {
    return settleOrderFee(e.orderNo).catch((err) => {
      logger.error('[payment-fee] settle fee failed', { orderNo: e.orderNo, err });
      throw err;
    });
  });
  paymentEventBus.on('refund.succeeded', (e) => {
    return reverseFeeOnRefund({ orderNo: e.orderNo, refundNo: e.refundNo, refundAmount: e.refundAmount }).catch((err) => {
      logger.error('[payment-fee] reverse fee failed', { orderNo: e.orderNo, refundNo: e.refundNo, err });
      throw err;
    });
  });
  logger.info('Payment fee subscribers registered');
}

/**
 * 退款成功后按退款比例冲销手续费（对齐渠道真实行为：退款时按比例返还手续费）。
 *
 * - 冲销额 = round(订单手续费 × 本次退款额 / 实付额)；
 * - 末笔补差：累计成功退款打满实付额时，冲销额 = 手续费 − 已冲销，消除多笔部分退款的舍入残差；
 * - 幂等：台账按 refundNo + type='fee' 去重（recordLedgerEntry 快路径 + DB 部分唯一索引兜底），
 *   事件重复投递不会重复冲销；
 * - 订单 feeAmount 保持下单时快照不变（结算单为应结快照口径），资金事实以台账为准。
 */
export async function reverseFeeOnRefund(e: { orderNo: string; refundNo?: string; refundAmount?: number }): Promise<void> {
  if (!e.refundNo || !e.refundAmount || e.refundAmount <= 0) return;
  const [order] = await db.select().from(paymentOrders).where(eq(paymentOrders.orderNo, e.orderNo)).limit(1);
  if (!order || order.feeAmount == null || order.feeAmount <= 0) return;
  const paidAmount = order.paidAmount ?? order.amount;
  if (paidAmount <= 0) return;

  const [[refundedRow], [reversedRow]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${paymentRefunds.refundAmount}),0)` })
      .from(paymentRefunds)
      .where(and(eq(paymentRefunds.orderId, order.id), eq(paymentRefunds.status, 'success'))),
    db
      .select({ total: sql<number>`coalesce(sum(${paymentLedgerEntries.amount}),0)` })
      .from(paymentLedgerEntries)
      .where(and(eq(paymentLedgerEntries.orderNo, order.orderNo), eq(paymentLedgerEntries.type, 'fee'), eq(paymentLedgerEntries.direction, 'in'))),
  ]);
  const refundedTotal = Number(refundedRow?.total ?? 0);
  const reversedTotal = Number(reversedRow?.total ?? 0);

  const fullyRefunded = refundedTotal >= paidAmount;
  let reverse = fullyRefunded
    ? order.feeAmount - reversedTotal
    : Math.round((order.feeAmount * e.refundAmount) / paidAmount);
  reverse = Math.min(reverse, order.feeAmount - reversedTotal);
  if (reverse <= 0) return;

  await recordLedgerEntry({
    direction: 'in',
    type: 'fee',
    amount: reverse,
    orderNo: order.orderNo,
    refundNo: e.refundNo,
    channel: order.channel,
    bizType: order.bizType,
    tenantId: order.tenantId,
    remark: fullyRefunded ? '退款手续费冲销（全额退款）' : '退款手续费冲销（按比例）',
  });
}
