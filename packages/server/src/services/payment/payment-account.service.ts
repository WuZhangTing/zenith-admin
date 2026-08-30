/**
 * 商户资金账户 Service（渠道×租户余额快照）。
 *
 * 账户余额不独立记账，而是随资金台账流水（recordLedgerEntry）原子联动，
 * 映射规则：payment→待结算+，fee/refund→待结算-，settlement→待结算转可用，
 * transfer→可用-，adjust→可用±。快照与流水聚合口径一致，checkAccounts() 可随时核对，
 * rebuildAccountsFromLedger() 支持从全量流水重建快照（存量数据迁移/差错修复）。
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { paymentAccounts, paymentLedgerEntries, paymentPreauths, type PaymentAccountRow } from '../../db/schema';
import { currentUser, currentUserOrNull } from '../../lib/context';
import { tenantCondition } from '../../lib/tenant';
import { mergeWhere } from '../../lib/where-helpers';
import { formatDateTime } from '../../lib/datetime';
import logger from '../../lib/logger';
import type { PaymentAccount, PaymentAccountCheckRow, PaymentChannel, PaymentLedgerDirection, PaymentLedgerType } from '@zenith/shared/payment';

export function mapAccount(row: PaymentAccountRow): PaymentAccount {
  return {
    id: row.id,
    channel: row.channel,
    pendingSettle: row.pendingSettle,
    available: row.available,
    frozen: row.frozen,
    version: row.version,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

function accountWhere(channel: PaymentChannel, tenantId: number | null) {
  return tenantId == null
    ? and(eq(paymentAccounts.channel, channel), isNull(paymentAccounts.tenantId))
    : and(eq(paymentAccounts.channel, channel), eq(paymentAccounts.tenantId, tenantId));
}

/** 查找或创建账户（并发安全：INSERT ON CONFLICT DO NOTHING 后回读） */
export async function ensureAccount(channel: PaymentChannel, tenantId: number | null): Promise<PaymentAccountRow> {
  const [existing] = await db.select().from(paymentAccounts).where(accountWhere(channel, tenantId)).limit(1);
  if (existing) return existing;
  await db.insert(paymentAccounts).values({ channel, tenantId }).onConflictDoNothing();
  const [row] = await db.select().from(paymentAccounts).where(accountWhere(channel, tenantId)).limit(1);
  return row;
}

interface BalanceDelta {
  pendingSettle?: number;
  available?: number;
}

/** 流水类型 → 账户余额变化映射（与 checkAccounts 的聚合口径必须保持一致） */
function deltaOf(type: PaymentLedgerType, direction: PaymentLedgerDirection, amount: number): BalanceDelta | null {
  switch (type) {
    case 'payment':
      return { pendingSettle: amount };
    case 'fee':
      // out=手续费扣收，in=退款手续费冲销（返还）
      return { pendingSettle: direction === 'in' ? amount : -amount };
    case 'refund':
      return { pendingSettle: -amount };
    case 'sharing':
      // 分账：从待结算划出给接收方（结算前分走的份额）
      return { pendingSettle: -amount };
    case 'settlement':
      // 结算划转：待结算 → 可用
      return { pendingSettle: -amount, available: amount };
    case 'transfer':
      return { available: -amount };
    case 'adjust':
      return { available: direction === 'in' ? amount : -amount };
    default:
      return null;
  }
}

/**
 * 台账流水联动账户余额（由 recordLedgerEntry 在流水真实落库后调用）。
 * 原子自增更新，失败仅告警不阻断记账（快照可由 rebuild 修复，流水是权威数据源）。
 */
export async function applyLedgerToAccount(input: {
  type: PaymentLedgerType;
  direction: PaymentLedgerDirection;
  amount: number;
  channel?: PaymentChannel | null;
  tenantId?: number | null;
}): Promise<void> {
  if (!input.channel) return;
  const delta = deltaOf(input.type, input.direction, input.amount);
  if (!delta) return;
  try {
    const account = await ensureAccount(input.channel, input.tenantId ?? null);
    await db
      .update(paymentAccounts)
      .set({
        pendingSettle: sql`${paymentAccounts.pendingSettle} + ${delta.pendingSettle ?? 0}`,
        available: sql`${paymentAccounts.available} + ${delta.available ?? 0}`,
        version: sql`${paymentAccounts.version} + 1`,
      })
      .where(eq(paymentAccounts.id, account.id));
  } catch (err) {
    logger.error('[payment-account] apply ledger delta failed', { channel: input.channel, type: input.type, err: err instanceof Error ? err.message : err });
  }
}

/** 账户总览（按当前用户租户过滤） */
export async function listAccounts(): Promise<PaymentAccount[]> {
  const user = currentUserOrNull();
  const where = user ? tenantCondition(paymentAccounts, user) : undefined;
  const rows = await db.select().from(paymentAccounts).where(mergeWhere(undefined, where)).orderBy(paymentAccounts.channel);
  return rows.map(mapAccount);
}

// ─── 余额核对（流水聚合 vs 快照）──────────────────────────────────────────────

interface ComputedBalance {
  pendingSettle: number;
  available: number;
}

/** 账户维度键：(channel, tenantId) → 稳定字符串，聚合结果按此键回填 */
function dimKey(channel: string, tenantId: number | null): string {
  return `${channel}:${tenantId ?? 'null'}`;
}

/** 台账流水按 (channel, tenantId) 分组聚合理论余额（口径与 deltaOf 一致）。
 * 一次 GROUP BY 覆盖全部维度，替代逐维度各查一次。 */
async function computeAllFromLedger(): Promise<Map<string, ComputedBalance>> {
  const rows = await db
    .select({
      channel: paymentLedgerEntries.channel,
      tenantId: paymentLedgerEntries.tenantId,
      payment: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'payment' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      // fee 方向敏感：out=扣收，in=退款冲销（净手续费 = out - in）
      fee: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'fee' then (case when ${paymentLedgerEntries.direction} = 'in' then -${paymentLedgerEntries.amount} else ${paymentLedgerEntries.amount} end) else 0 end),0)`,
      refund: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'refund' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      sharing: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'sharing' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      settlement: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'settlement' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      transfer: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'transfer' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      adjustIn: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'adjust' and ${paymentLedgerEntries.direction} = 'in' then ${paymentLedgerEntries.amount} else 0 end),0)`,
      adjustOut: sql<number>`coalesce(sum(case when ${paymentLedgerEntries.type} = 'adjust' and ${paymentLedgerEntries.direction} = 'out' then ${paymentLedgerEntries.amount} else 0 end),0)`,
    })
    .from(paymentLedgerEntries)
    .groupBy(paymentLedgerEntries.channel, paymentLedgerEntries.tenantId);
  const n = (v: unknown) => Number(v ?? 0);
  const map = new Map<string, ComputedBalance>();
  for (const agg of rows) {
    if (!agg.channel) continue;
    map.set(dimKey(agg.channel, agg.tenantId ?? null), {
      pendingSettle: n(agg.payment) - n(agg.fee) - n(agg.refund) - n(agg.sharing) - n(agg.settlement),
      available: n(agg.settlement) - n(agg.transfer) + n(agg.adjustIn) - n(agg.adjustOut),
    });
  }
  return map;
}

/** 收集流水与快照中出现过的全部 (channel, tenantId) 维度 */
async function collectDimensions(): Promise<Array<{ channel: PaymentChannel; tenantId: number | null }>> {
  const [fromLedger, fromAccounts] = await Promise.all([
    db
      .selectDistinct({ channel: paymentLedgerEntries.channel, tenantId: paymentLedgerEntries.tenantId })
      .from(paymentLedgerEntries)
      .where(sql`${paymentLedgerEntries.channel} is not null`),
    db.selectDistinct({ channel: paymentAccounts.channel, tenantId: paymentAccounts.tenantId }).from(paymentAccounts),
  ]);
  const seen = new Set<string>();
  const dims: Array<{ channel: PaymentChannel; tenantId: number | null }> = [];
  for (const d of [...fromLedger, ...fromAccounts]) {
    if (!d.channel) continue;
    const key = dimKey(d.channel, d.tenantId ?? null);
    if (seen.has(key)) continue;
    seen.add(key);
    dims.push({ channel: d.channel as PaymentChannel, tenantId: d.tenantId ?? null });
  }
  return dims;
}

/** 进行中预授权冻结金额按 (channel, tenantId) 分组聚合（账户 frozen 快照核对口径） */
async function computeAllFrozenFromPreauths(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      channel: paymentPreauths.channel,
      tenantId: paymentPreauths.tenantId,
      total: sql<number>`coalesce(sum(${paymentPreauths.frozenAmount}),0)`,
    })
    .from(paymentPreauths)
    .where(eq(paymentPreauths.status, 'frozen'))
    .groupBy(paymentPreauths.channel, paymentPreauths.tenantId);
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.channel) continue;
    map.set(dimKey(row.channel, row.tenantId ?? null), Number(row.total ?? 0));
  }
  return map;
}

/** 快照全量装载为 (channel, tenantId) → 账户行 */
async function loadAccountSnapshots(): Promise<Map<string, PaymentAccountRow>> {
  const rows = await db.select().from(paymentAccounts);
  return new Map(rows.map((row) => [dimKey(row.channel, row.tenantId ?? null), row]));
}

/** 余额核对：逐账户比对快照与流水聚合，返回差异明细（match=false 为异常账户） */
export async function checkAccounts(): Promise<PaymentAccountCheckRow[]> {
  // 维度先行：必须等 collectDimensions 完成后再取聚合，保证每个被发现的维度
  // 其聚合快照都晚于维度扫描（并发记账时才不会出现「维度已出现、聚合却为空」）
  const dims = await collectDimensions();
  const [ledgerByDim, frozenByDim, snapshotByDim] = await Promise.all([
    computeAllFromLedger(),
    computeAllFrozenFromPreauths(),
    loadAccountSnapshots(),
  ]);
  const result: PaymentAccountCheckRow[] = [];
  for (const dim of dims) {
    const key = dimKey(dim.channel, dim.tenantId);
    const snapshot = snapshotByDim.get(key);
    const computed = ledgerByDim.get(key) ?? { pendingSettle: 0, available: 0 };
    const frozenComputed = frozenByDim.get(key) ?? 0;
    const snapPending = snapshot?.pendingSettle ?? 0;
    const snapAvailable = snapshot?.available ?? 0;
    const snapFrozen = snapshot?.frozen ?? 0;
    result.push({
      channel: dim.channel,
      pendingSettleSnapshot: snapPending,
      pendingSettleComputed: computed.pendingSettle,
      availableSnapshot: snapAvailable,
      availableComputed: computed.available,
      frozenSnapshot: snapFrozen,
      frozenComputed,
      match: snapPending === computed.pendingSettle && snapAvailable === computed.available && snapFrozen === frozenComputed,
    });
  }
  return result;
}

/** 从全量流水重建账户快照（存量数据初始化 / 差错修复；流水为权威数据源） */
export async function rebuildAccountsFromLedger(): Promise<number> {
  // 顺序同 checkAccounts：维度扫描必须先于聚合。否则并发记账时
  // 「维度已被发现、聚合快照却早于那条流水」会让本函数拿 0 覆盖掉真实余额
  const dims = await collectDimensions();
  const [ledgerByDim, frozenByDim, snapshotByDim] = await Promise.all([
    computeAllFromLedger(),
    computeAllFrozenFromPreauths(),
    loadAccountSnapshots(),
  ]);
  for (const dim of dims) {
    const key = dimKey(dim.channel, dim.tenantId);
    const computed = ledgerByDim.get(key) ?? { pendingSettle: 0, available: 0 };
    const frozenComputed = frozenByDim.get(key) ?? 0;
    // 快照已存在时直接复用预取结果，只有缺账户的维度才走建号流程
    const account = snapshotByDim.get(key) ?? await ensureAccount(dim.channel, dim.tenantId);
    await db
      .update(paymentAccounts)
      .set({
        pendingSettle: computed.pendingSettle,
        available: computed.available,
        frozen: frozenComputed,
        version: sql`${paymentAccounts.version} + 1`,
      })
      .where(eq(paymentAccounts.id, account.id));
  }
  logger.info('[payment-account] rebuilt from ledger', { accounts: dims.length });
  return dims.length;
}

/** 人工调账：走台账 adjust 流水（自动联动可用余额），保证流水与快照口径一致 */
export async function adjustAccount(input: { channel: PaymentChannel; direction: PaymentLedgerDirection; amount: number; remark?: string }): Promise<PaymentAccount> {
  if (input.amount <= 0) throw new HTTPException(400, { message: '调账金额必须大于 0' });
  const user = currentUser();
  const tenantId = user.tenantId ?? null;
  // 延迟导入避免与 ledger service 循环依赖
  const { recordLedgerEntry } = await import('./payment-ledger.service');
  await recordLedgerEntry({
    direction: input.direction,
    type: 'adjust',
    amount: input.amount,
    channel: input.channel,
    tenantId,
    remark: `人工调账${input.remark ? `：${input.remark}` : ''}（操作人 ${user.username}）`,
  });
  const account = await ensureAccount(input.channel, tenantId);
  return mapAccount(account);
}
