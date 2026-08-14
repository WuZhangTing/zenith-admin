import { HTTPException } from 'hono/http-exception';
import { asc, eq, sql } from 'drizzle-orm';
import type { CreateWikiTagInput, UpdateWikiTagInput } from '@zenith/shared/wiki';
import { db } from '../../db';
import { wikiDocTags, wikiTags, type WikiTagRow } from '../../db/schema';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { formatDateTime } from '../../lib/datetime';
import { buildWhere, keywordCondition, withPagination } from '../../lib/where-helpers';

export function mapWikiTag(row: WikiTagRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export interface ListWikiTagsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

interface WikiTagWhereInput extends ListWikiTagsQuery {
  id?: number;
}

function buildWikiTagWhere(q: WikiTagWhereInput) {
  return buildWhere(
    q.id !== undefined ? eq(wikiTags.id, q.id) : undefined,
    keywordCondition(q.keyword, [wikiTags.name]),
  );
}

export async function listWikiTags(q: ListWikiTagsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildWikiTagWhere(q);

  const [total, rows] = await Promise.all([
    db.$count(wikiTags, where),
    withPagination(
      db.select({
        tag: wikiTags,
        docCount: sql<number>`count(${wikiDocTags.docId})::int`,
      }).from(wikiTags)
        .leftJoin(wikiDocTags, eq(wikiTags.id, wikiDocTags.tagId))
        .where(where)
        .groupBy(wikiTags.id)
        .orderBy(asc(wikiTags.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { list: rows.map((r) => ({ ...mapWikiTag(r.tag), docCount: r.docCount })), total, page, pageSize };
}

/** 全部标签（编辑器打标下拉） */
export async function listAllWikiTags() {
  const rows = await db.select().from(wikiTags).orderBy(asc(wikiTags.id));
  return rows.map(mapWikiTag);
}

export async function ensureWikiTagExists(id: number) {
  const [row] = await db.select().from(wikiTags).where(buildWikiTagWhere({ id })).limit(1);
  if (!row) throw new HTTPException(404, { message: '标签不存在' });
  return row;
}

export async function createWikiTag(data: CreateWikiTagInput) {
  try {
    const [row] = await db.insert(wikiTags).values(data).returning();
    return mapWikiTag(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '标签名称已存在');
    throw err;
  }
}

export async function updateWikiTag(id: number, data: UpdateWikiTagInput) {
  try {
    const [row] = await db.update(wikiTags).set(data).where(buildWikiTagWhere({ id })).returning();
    if (!row) throw new HTTPException(404, { message: '标签不存在' });
    return mapWikiTag(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '标签名称已存在');
    throw err;
  }
}

export async function deleteWikiTag(id: number) {
  await ensureWikiTagExists(id);
  await db.delete(wikiTags).where(buildWikiTagWhere({ id }));
}
