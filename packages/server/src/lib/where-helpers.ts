import { and, gte, ilike, like, lte, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgColumn, PgSelect } from 'drizzle-orm/pg-core';
import { parseDateRangeEnd, parseDateRangeStart } from './datetime';

/** 合并两个可选的 WHERE 条件，等价于 `base && extra ? and(base, extra) : (extra ?? base)` */
export function mergeWhere(base?: SQL, extra?: SQL): SQL | undefined {
  if (base && extra) return and(base, extra);
  return extra ?? base;
}

/** 转义 PostgreSQL LIKE / ILIKE 元字符（%, _, \），防止用户输入被解释为通配符 */
export function escapeLike(s: string): string {
  return s.replaceAll('\\', String.raw`\\`).replaceAll(String.raw`%`, String.raw`\%`).replaceAll('_', String.raw`\_`);
}

/**
 * 关键字跨列模糊匹配。
 *
 * 收敛此前散落在各 service 的三种写法——`or(...)` 返回 `SQL | undefined`，
 * 有的加 `!` 非空断言、有的隐式吞掉 undefined、有的显式 guard。这里统一在一处处理。
 *
 * 关键字为空或纯空格时返回 `undefined`（不参与 WHERE），调用方无需自行判空。
 *
 * @param mode `like` 区分大小写（PostgreSQL 默认），`ilike` 不区分。
 *             既有代码两者都在用，按各表原有语义选择，勿一刀切。
 *
 * @example
 * const where = buildWhere(
 *   keywordCondition(q.keyword, [positions.name, positions.code]),
 *   q.status ? eq(positions.status, q.status) : undefined,
 * );
 */
export function keywordCondition(
  keyword: string | null | undefined,
  columns: readonly PgColumn[],
  mode: 'like' | 'ilike' = 'like',
): SQL | undefined {
  const trimmed = keyword?.trim();
  if (!trimmed || columns.length === 0) return undefined;
  const pattern = `%${escapeLike(trimmed)}%`;
  const op = mode === 'ilike' ? ilike : like;
  return or(...columns.map((column) => op(column, pattern)));
}

/**
 * 时间范围条件（闭区间）。
 *
 * **末端口径统一走 `parseDateRangeEnd`**：传入纯日期 `2026-08-01` 时取当天
 * `23:59:59.999` 而非 `00:00:00`，否则筛选「到 8 月 1 日」会漏掉整个 8 月 1 日的数据。
 * 此前部分 service 用 `parseDateTimeInput` 解析末端，正是该口径分裂的来源。
 *
 * 返回数组便于直接展开进 `buildWhere(...)`；两端都为空时返回空数组。
 */
export function dateRangeConditions(
  column: PgColumn,
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): SQL[] {
  const conditions: SQL[] = [];
  const from = parseDateRangeStart(start);
  if (from) conditions.push(gte(column, from));
  const to = parseDateRangeEnd(end);
  if (to) conditions.push(lte(column, to));
  return conditions;
}

/**
 * 合并任意多个可选条件，全空时返回 `undefined`（即不加 WHERE）。
 * 替代各 service 手写的 `conditions.length ? and(...conditions) : undefined`。
 *
 * @example
 * const where = buildWhere(
 *   keywordCondition(q.keyword, [tags.name, tags.description]),
 *   q.status ? eq(tags.status, q.status) : undefined,
 *   ...dateRangeConditions(tags.createdAt, q.startTime, q.endTime),
 *   tenantCondition(tags, currentUser()),
 * );
 */
export function buildWhere(...conditions: (SQL | undefined)[]): SQL | undefined {
  const kept = conditions.filter((condition): condition is SQL => condition !== undefined);
  if (kept.length === 0) return undefined;
  if (kept.length === 1) return kept[0];
  return and(...kept);
}

/**
 * 为 `.$dynamic()` 查询添加分页（LIMIT + OFFSET），参考 Drizzle 官方 Dynamic Query 文档。
 * @see https://orm.drizzle.team/docs/dynamic-query-building
 *
 * @example
 * const [total, list] = await Promise.all([
 *   db.$count(table, where),
 *   withPagination(db.select().from(table).where(where).$dynamic(), page, pageSize),
 * ]);
 */
export function withPagination<T extends PgSelect>(qb: T, page: number, pageSize: number) {
  return qb.limit(pageSize).offset((page - 1) * pageSize);
}
