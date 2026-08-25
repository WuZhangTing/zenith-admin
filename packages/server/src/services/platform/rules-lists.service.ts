/**
 * 名单库服务（规则中心）：黑/白/灰名单 CRUD、条目管理（含过期）与运行时命中判定。
 */
import { and, desc, eq, gt, inArray, isNull, like, or, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { RuleListType, RuleListCheckResult } from '@zenith/shared/rules';
import { db } from '../../db';
import { ruleLists, ruleListItems } from '../../db/schema';
import { currentUser, currentUserOrNull } from '../../lib/context';
import { tenantCondition, getCreateTenantId } from '../../lib/tenant';
import { escapeLike } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime, formatNullableDateTime, parseDateTimeInput } from '../../lib/datetime';

type ListRow = typeof ruleLists.$inferSelect;
type ItemRow = typeof ruleListItems.$inferSelect;

export function mapRuleList(row: ListRow, itemCount?: number) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    type: row.type as RuleListType,
    description: row.description ?? null,
    status: row.status,
    itemCount,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

const mapItem = (r: ItemRow) => ({
  id: r.id,
  listId: r.listId,
  value: r.value,
  label: r.label ?? null,
  matchMode: (r.matchMode ?? 'exact') as 'exact' | 'prefix' | 'regex',
  expiresAt: formatNullableDateTime(r.expiresAt),
  remark: r.remark ?? null,
  createdAt: formatDateTime(r.createdAt),
});

export async function ensureRuleList(id: number): Promise<ListRow> {
  const tc = tenantCondition(ruleLists, currentUser());
  const conds = [eq(ruleLists.id, id)];
  if (tc) conds.push(tc);
  const [row] = await db.select().from(ruleLists).where(and(...conds)).limit(1);
  if (!row) throw new HTTPException(404, { message: '名单不存在' });
  return row;
}

export interface ListRuleListsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: RuleListType;
}

export async function listRuleLists(q: ListRuleListsQuery) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const tc = tenantCondition(ruleLists, currentUser());
  const conds = [];
  if (tc) conds.push(tc);
  if (q.keyword) conds.push(like(ruleLists.name, `%${escapeLike(q.keyword)}%`));
  if (q.type) conds.push(eq(ruleLists.type, q.type));
  const where = conds.length ? and(...conds) : undefined;
  const [total, rows] = await Promise.all([
    db.$count(ruleLists, where),
    db.select().from(ruleLists).where(where).orderBy(desc(ruleLists.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
  ]);
  const ids = rows.map((r) => r.id);
  const counts = ids.length
    ? await db.select({ listId: ruleListItems.listId, count: sql<number>`count(*)::int` })
      .from(ruleListItems).where(inArray(ruleListItems.listId, ids)).groupBy(ruleListItems.listId)
    : [];
  const countByList = new Map(counts.map((c) => [c.listId, c.count]));
  return { list: rows.map((r) => mapRuleList(r, countByList.get(r.id) ?? 0)), total, page, pageSize };
}

export interface CreateRuleListInput {
  key: string;
  name: string;
  type?: RuleListType;
  description?: string | null;
}

export async function createRuleList(input: CreateRuleListInput) {
  try {
    const [row] = await db.insert(ruleLists).values({
      key: input.key,
      name: input.name,
      type: input.type ?? 'black',
      description: input.description ?? null,
      tenantId: getCreateTenantId(currentUser()),
    }).returning();
    return mapRuleList(row, 0);
  } catch (err) {
    rethrowPgUniqueViolation(err, '名单 key 已存在');
  }
}

export async function updateRuleList(id: number, input: Partial<CreateRuleListInput> & { status?: 'enabled' | 'disabled' }) {
  await ensureRuleList(id);
  const patch: Partial<typeof ruleLists.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  const [row] = await db.update(ruleLists).set(patch).where(eq(ruleLists.id, id)).returning();
  const count = await db.$count(ruleListItems, eq(ruleListItems.listId, id));
  return mapRuleList(row, count);
}

export async function deleteRuleList(id: number): Promise<void> {
  await ensureRuleList(id);
  await db.delete(ruleLists).where(eq(ruleLists.id, id));
}

// ─── 条目管理 ──────────────────────────────────────────────────────────────────

export interface ListRuleListItemsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export async function listRuleListItems(listId: number, q: ListRuleListItemsQuery) {
  await ensureRuleList(listId);
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const conds = [eq(ruleListItems.listId, listId)];
  if (q.keyword) conds.push(like(ruleListItems.value, `%${escapeLike(q.keyword)}%`));
  const where = and(...conds);
  const [total, rows] = await Promise.all([
    db.$count(ruleListItems, where),
    db.select().from(ruleListItems).where(where).orderBy(desc(ruleListItems.id)).limit(pageSize).offset(pageOffset(page, pageSize)),
  ]);
  return { list: rows.map(mapItem), total, page, pageSize };
}

export interface CreateRuleListItemInput {
  value: string;
  label?: string | null;
  matchMode?: 'exact' | 'prefix' | 'regex';
  expiresAt?: string | null;
  remark?: string | null;
}

/** 正则条目安全校验：必须可编译，限制长度防 ReDoS 滥用 */
function ensureRegexValid(pattern: string): void {
  if (pattern.length > 128) throw new HTTPException(400, { message: '正则过长（最多 128 字符）' });
  try {
    void new RegExp(pattern);
  } catch {
    throw new HTTPException(400, { message: '正则表达式无法编译' });
  }
}

export async function createRuleListItem(listId: number, input: CreateRuleListItemInput) {
  await ensureRuleList(listId);
  const matchMode = input.matchMode ?? 'exact';
  if (matchMode === 'regex') ensureRegexValid(input.value.trim());
  try {
    const [row] = await db.insert(ruleListItems).values({
      listId,
      value: input.value.trim(),
      label: input.label ?? null,
      matchMode,
      expiresAt: parseDateTimeInput(input.expiresAt) ?? null,
      remark: input.remark ?? null,
      createdBy: currentUser().userId,
    }).returning();
    return mapItem(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '该值已在名单中');
  }
}

/** 批量导入：去重后 onConflictDoNothing，返回实际新增数 */
export async function batchCreateRuleListItems(listId: number, values: string[], expiresAt?: string | null): Promise<number> {
  await ensureRuleList(listId);
  const unique = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  const rows = await db.insert(ruleListItems).values(unique.map((value) => ({
    listId,
    value,
    expiresAt: parseDateTimeInput(expiresAt) ?? null,
    createdBy: currentUser().userId,
  }))).onConflictDoNothing({ target: [ruleListItems.listId, ruleListItems.value] }).returning({ id: ruleListItems.id });
  return rows.length;
}

export async function deleteRuleListItem(listId: number, itemId: number): Promise<void> {
  await ensureRuleList(listId);
  await db.delete(ruleListItems).where(and(eq(ruleListItems.id, itemId), eq(ruleListItems.listId, listId)));
}

/** 清理已过期条目，返回删除数 */
export async function purgeExpiredRuleListItems(listId: number): Promise<number> {
  await ensureRuleList(listId);
  const rows = await db.delete(ruleListItems)
    .where(and(eq(ruleListItems.listId, listId), sql`${ruleListItems.expiresAt} IS NOT NULL AND ${ruleListItems.expiresAt} < now()`))
    .returning({ id: ruleListItems.id });
  return rows.length;
}

// ─── 运行时命中判定 ─────────────────────────────────────────────────────────────

/**
 * 名单命中判定（运行时/业务侧通用）：租户精确匹配优先回退平台级；
 * 名单禁用或不存在视为未命中；条目过期不命中。
 */
export async function checkRuleList(key: string, value: string, meta?: { tenantId?: number | null }): Promise<RuleListCheckResult> {
  const tenantId = meta?.tenantId !== undefined
    ? meta.tenantId
    : (() => { const u = currentUserOrNull(); return u ? (u.viewingTenantId ?? u.tenantId ?? null) : undefined; })();
  const candidates = await db.select().from(ruleLists).where(eq(ruleLists.key, key));
  const row = (tenantId != null ? candidates.find((r) => r.tenantId === tenantId) : undefined)
    ?? candidates.find((r) => r.tenantId == null)
    ?? (tenantId === undefined && candidates.length === 1 ? candidates[0] : undefined);
  if (!row || row.status !== 'enabled') return { hit: false };
  const trimmed = value.trim();
  const notExpired = or(isNull(ruleListItems.expiresAt), gt(ruleListItems.expiresAt, new Date()));
  // 精确条目走索引等值查询；未命中再加载前缀/正则条目逐条匹配（此类条目通常极少）
  const [item] = await db.select().from(ruleListItems)
    .where(and(
      eq(ruleListItems.listId, row.id),
      eq(ruleListItems.value, trimmed),
      eq(ruleListItems.matchMode, 'exact'),
      notExpired,
    )).limit(1);
  const toHit = (it: ItemRow): RuleListCheckResult => ({
    hit: true,
    listType: row.type as RuleListType,
    item: {
      value: it.value,
      label: it.label ?? null,
      matchMode: (it.matchMode ?? 'exact') as 'exact' | 'prefix' | 'regex',
      expiresAt: formatNullableDateTime(it.expiresAt),
    },
  });
  if (item) return toHit(item);
  const patternItems = await db.select().from(ruleListItems)
    .where(and(
      eq(ruleListItems.listId, row.id),
      sql`${ruleListItems.matchMode} <> 'exact'`,
      notExpired,
    ));
  for (const it of patternItems) {
    if (it.matchMode === 'prefix' && trimmed.startsWith(it.value)) return toHit(it);
    if (it.matchMode === 'regex') {
      try {
        if (new RegExp(it.value).test(trimmed)) return toHit(it);
      } catch { /* 无法编译的历史正则视为不命中 */ }
    }
  }
  return { hit: false };
}
