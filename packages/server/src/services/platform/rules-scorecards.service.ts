/**
 * 评分卡服务（规则中心）：CRUD、发布快照与求值。
 * 发布采用单快照（publishedSnapshot），运行时按快照执行；编辑态求值仅用于测试。
 */
import { and, desc, eq, like } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type {
  RuleScorecardEvaluateResult,
  RuleScorecardGrade,
  RuleScorecardVariable,
} from '@zenith/shared/rules';
import type { CreateRuleScorecardInput, UpdateRuleScorecardInput } from '@zenith/shared/rules';
import { db } from '../../db';
import { ruleScorecards } from '../../db/schema';
import { currentUser } from '../../lib/context';
import { tenantCondition, getCreateTenantId } from '../../lib/tenant';
import { escapeLike } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { evaluateScorecard, type ScorecardLike } from '../../lib/rules-scorecard';
import { snapshotRuleScope } from './rules.service';

type Row = typeof ruleScorecards.$inferSelect;

interface ScorecardSnapshot {
  baseScore: number;
  variables: RuleScorecardVariable[];
  grades: RuleScorecardGrade[];
}

function draftSnapshot(row: Row): ScorecardSnapshot {
  return {
    baseScore: row.baseScore,
    variables: (row.variables ?? []) as RuleScorecardVariable[],
    grades: (row.grades ?? []) as RuleScorecardGrade[],
  };
}

/** 键序稳定序列化：jsonb 回读会重排对象键序，直接 JSON.stringify 对比会误报 dirty */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function mapRuleScorecard(row: Row) {
  const snapshot = row.publishedSnapshot as ScorecardSnapshot | null;
  const dirty = row.status === 'published' && snapshot != null
    ? stableStringify(draftSnapshot(row)) !== stableStringify(snapshot)
    : undefined;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    status: row.status,
    baseScore: row.baseScore,
    variables: (row.variables ?? []) as RuleScorecardVariable[],
    grades: (row.grades ?? []) as RuleScorecardGrade[],
    version: row.version,
    publishedAt: formatNullableDateTime(row.publishedAt),
    dirty,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function ensureRuleScorecard(id: number): Promise<Row> {
  const tc = tenantCondition(ruleScorecards, currentUser());
  const conds = [eq(ruleScorecards.id, id)];
  if (tc) conds.push(tc);
  const [row] = await db.select().from(ruleScorecards).where(and(...conds)).limit(1);
  if (!row) throw new HTTPException(404, { message: '评分卡不存在' });
  return row;
}

export interface ListRuleScorecardsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'draft' | 'published' | 'disabled';
}

export async function listRuleScorecards(q: ListRuleScorecardsQuery) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const tc = tenantCondition(ruleScorecards, currentUser());
  const conds = [];
  if (tc) conds.push(tc);
  if (q.keyword) conds.push(like(ruleScorecards.name, `%${escapeLike(q.keyword)}%`));
  if (q.status) conds.push(eq(ruleScorecards.status, q.status));
  const where = conds.length ? and(...conds) : undefined;
  const [total, rows] = await Promise.all([
    db.$count(ruleScorecards, where),
    db.select().from(ruleScorecards).where(where).orderBy(desc(ruleScorecards.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
  ]);
  return { list: rows.map(mapRuleScorecard), total, page, pageSize };
}

export async function getRuleScorecard(id: number) {
  return mapRuleScorecard(await ensureRuleScorecard(id));
}

export async function createRuleScorecard(input: CreateRuleScorecardInput) {
  ensureVariableKeysUnique((input.variables ?? []) as RuleScorecardVariable[]);
  try {
    const [row] = await db.insert(ruleScorecards).values({
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      baseScore: input.baseScore ?? 0,
      variables: input.variables ?? [],
      grades: input.grades ?? [],
      tenantId: getCreateTenantId(currentUser()),
    }).returning();
    return mapRuleScorecard(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '评分卡 key 已存在');
    throw err;
  }
}

export async function updateRuleScorecard(id: number, input: UpdateRuleScorecardInput) {
  const before = await ensureRuleScorecard(id);
  // 编辑乐观锁：携带打开编辑时的 updatedAt，不一致说明已被他人修改
  if (input.expectedUpdatedAt && formatDateTime(before.updatedAt) !== input.expectedUpdatedAt) {
    throw new HTTPException(409, { message: '评分卡已被他人修改，请刷新后重试' });
  }
  if (input.variables !== undefined) ensureVariableKeysUnique(input.variables as RuleScorecardVariable[]);
  const [row] = await db.update(ruleScorecards).set({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description ?? null } : {}),
    ...(input.baseScore !== undefined ? { baseScore: input.baseScore } : {}),
    ...(input.variables !== undefined ? { variables: input.variables } : {}),
    ...(input.grades !== undefined ? { grades: input.grades } : {}),
  }).where(eq(ruleScorecards.id, id)).returning();
  return mapRuleScorecard(row);
}

export async function deleteRuleScorecard(id: number): Promise<void> {
  await ensureRuleScorecard(id);
  await db.delete(ruleScorecards).where(eq(ruleScorecards.id, id));
}

function ensureVariableKeysUnique(variables: RuleScorecardVariable[]): void {
  const seen = new Set<string>();
  for (const v of variables) {
    if (seen.has(v.key)) throw new HTTPException(400, { message: `变量 key 重复：${v.key}` });
    seen.add(v.key);
  }
}

/** 发布门禁：至少一个变量且各变量至少一个分段；等级映射按 minScore 唯一 */
function ensureScorecardPublishable(row: Row): void {
  const variables = (row.variables ?? []) as RuleScorecardVariable[];
  if (variables.length === 0) throw new HTTPException(400, { message: '评分卡至少需要一个变量' });
  for (const v of variables) {
    if (!v.bands || v.bands.length === 0) throw new HTTPException(400, { message: `变量「${v.label || v.key}」至少需要一个分段` });
  }
  const grades = (row.grades ?? []) as RuleScorecardGrade[];
  const mins = new Set<number>();
  for (const g of grades) {
    if (mins.has(g.minScore)) throw new HTTPException(400, { message: `等级映射 minScore 重复：${g.minScore}` });
    mins.add(g.minScore);
  }
}

/** 发布：固化快照，version +1（首次发布保持 1），状态置 published */
export async function publishRuleScorecard(id: number) {
  const row = await ensureRuleScorecard(id);
  ensureScorecardPublishable(row);
  const [updated] = await db.update(ruleScorecards).set({
    status: 'published',
    publishedAt: new Date(),
    publishedSnapshot: draftSnapshot(row),
    version: row.publishedSnapshot == null ? row.version : row.version + 1,
  }).where(eq(ruleScorecards.id, id)).returning();
  return mapRuleScorecard(updated);
}

export async function toggleRuleScorecard(id: number, enabled: boolean) {
  const row = await ensureRuleScorecard(id);
  if (enabled && row.publishedSnapshot == null) {
    throw new HTTPException(400, { message: '评分卡尚未发布过，请先发布' });
  }
  const [updated] = await db.update(ruleScorecards)
    .set({ status: enabled ? 'published' : 'disabled' })
    .where(eq(ruleScorecards.id, id)).returning();
  return mapRuleScorecard(updated);
}

/** 测试求值：按编辑态（草稿）求值，评估「若现在发布」的行为 */
export async function testEvaluateRuleScorecard(id: number, input: Record<string, unknown>): Promise<RuleScorecardEvaluateResult> {
  const row = await ensureRuleScorecard(id);
  return evaluateScorecard(draftSnapshot(row), snapshotRuleScope(input));
}

/** 运行时求值：按 key 取发布快照执行（disabled/未发布视为不可用） */
export async function evaluateRuleScorecardByKey(key: string, input: Record<string, unknown>): Promise<RuleScorecardEvaluateResult> {
  const tc = tenantCondition(ruleScorecards, currentUser());
  const conds = [eq(ruleScorecards.key, key), eq(ruleScorecards.status, 'published')];
  if (tc) conds.push(tc);
  const [row] = await db.select().from(ruleScorecards).where(and(...conds)).limit(1);
  if (!row || row.publishedSnapshot == null) throw new HTTPException(404, { message: `评分卡不可用：${key}` });
  return evaluateScorecard(row.publishedSnapshot as ScorecardLike, snapshotRuleScope(input));
}
