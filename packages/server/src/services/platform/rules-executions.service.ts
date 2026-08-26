/**
 * 规则执行留痕服务（全资产通用）：异步批写队列 + 分页查询。
 *
 * 写入走内存队列批量落盘（削峰，不阻塞求值热路径），流水尽力而为，不阻断业务；
 * 每条记录携带 refKind / caller / version，执行记录页可按资产类型与调用方分析。
 */
import { desc, eq } from 'drizzle-orm';
import type { RuleExecution, RuleExecutionSource, RuleHitPolicy, RuleRefKind } from '@zenith/shared/rules';
import { db } from '../../db';
import { ruleExecutions } from '../../db/schema';
import { currentUser } from '../../lib/context';
import { tenantCondition } from '../../lib/tenant';
import { buildWhere, keywordCondition, dateRangeConditions } from '../../lib/where-helpers';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime } from '../../lib/datetime';

type NewExecRow = typeof ruleExecutions.$inferInsert;

const EXEC_FLUSH_INTERVAL_MS = 2_000;
const EXEC_FLUSH_BATCH = 50;
const execWriteQueue: NewExecRow[] = [];
let execFlushTimer: ReturnType<typeof setTimeout> | null = null;

/** 落盘队列中的执行流水（查询前调用，保证刚发生的求值可见） */
export async function flushRuleExecutionQueue(): Promise<void> {
  if (execFlushTimer) { clearTimeout(execFlushTimer); execFlushTimer = null; }
  if (execWriteQueue.length === 0) return;
  const batch = execWriteQueue.splice(0, execWriteQueue.length);
  try { await db.insert(ruleExecutions).values(batch); } catch { /* 执行流水尽力而为，不阻断业务 */ }
}

/** 写一条执行流水（异步批写） */
export function recordRuleExecution(row: NewExecRow): void {
  execWriteQueue.push(row);
  if (execWriteQueue.length >= EXEC_FLUSH_BATCH) {
    void flushRuleExecutionQueue();
    return;
  }
  if (!execFlushTimer) {
    execFlushTimer = setTimeout(() => { void flushRuleExecutionQueue(); }, EXEC_FLUSH_INTERVAL_MS);
    execFlushTimer.unref?.();
  }
}

/** 执行流水入队前的 scope 深拷贝：异步批写期间调用方可能继续改写原对象（如工作流合并输出回 formData） */
export function snapshotRuleScope(scope: Record<string, unknown>): Record<string, unknown> {
  try {
    return structuredClone(scope);
  } catch {
    try { return JSON.parse(JSON.stringify(scope)) as Record<string, unknown>; } catch { return { ...scope }; }
  }
}

export interface ListRuleExecutionsQuery {
  page?: number;
  pageSize?: number;
  refKind?: RuleRefKind;
  refId?: number;
  caller?: string;
  instanceId?: number;
  ruleKey?: string;
  source?: RuleExecutionSource;
  matched?: boolean;
  dateStart?: string;
  dateEnd?: string;
}

export async function listRuleExecutions(q: ListRuleExecutionsQuery) {
  // 分页前先落盘缓冲区，保证刚发生的求值可见
  await flushRuleExecutionQueue();
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const where = buildWhere(
    tenantCondition(ruleExecutions, currentUser()),
    q.refKind ? eq(ruleExecutions.refKind, q.refKind) : undefined,
    q.refId ? eq(ruleExecutions.refId, q.refId) : undefined,
    q.caller ? eq(ruleExecutions.caller, q.caller) : undefined,
    q.instanceId ? eq(ruleExecutions.instanceId, q.instanceId) : undefined,
    keywordCondition(q.ruleKey, [ruleExecutions.ruleKey]),
    q.source ? eq(ruleExecutions.source, q.source) : undefined,
    q.matched !== undefined ? eq(ruleExecutions.matched, q.matched) : undefined,
    ...dateRangeConditions(ruleExecutions.createdAt, q.dateStart, q.dateEnd),
  );
  const [total, rows] = await Promise.all([
    db.$count(ruleExecutions, where),
    db.select().from(ruleExecutions).where(where).orderBy(desc(ruleExecutions.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
  ]);
  const list: RuleExecution[] = rows.map((r) => ({
    id: r.id,
    refKind: r.refKind as RuleRefKind,
    refId: r.refId,
    ruleKey: r.ruleKey,
    version: r.version,
    caller: r.caller,
    instanceId: r.instanceId,
    nodeKey: r.nodeKey,
    source: r.source as RuleExecutionSource,
    matched: r.matched,
    hitPolicy: (r.hitPolicy ?? null) as RuleHitPolicy | null,
    input: (r.input ?? {}) as Record<string, unknown>,
    outputs: (r.outputs ?? {}) as Record<string, unknown>,
    matchedRowIds: (r.matchedRowIds ?? []) as string[],
    createdAt: formatDateTime(r.createdAt),
  }));
  return { list, total, page, pageSize };
}
