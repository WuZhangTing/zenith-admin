import { eq, asc, and, like, or, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { cmsErrorProneWords } from '../../db/schema';
import type { CmsErrorProneWordRow } from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { mergeWhere, escapeLike, withPagination } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { invalidateWordCheckCache } from './cms-word-check.service';
import type { CreateCmsErrorProneWordInput, UpdateCmsErrorProneWordInput } from '@zenith/shared/cms';

// ─── 易错词自动替换（Aho-Corasick 多模式匹配，与敏感词同构）────────────────────
interface AcNode {
  children: Map<string, AcNode>;
  fail: AcNode | null;
  hits: CmsErrorProneWordRow[];
}

function buildAutomaton(words: CmsErrorProneWordRow[]): AcNode {
  const root: AcNode = { children: new Map(), fail: null, hits: [] };
  for (const w of words) {
    let node = root;
    for (const ch of w.word) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), fail: null, hits: [] };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.hits.push(w);
  }
  const queue: AcNode[] = [];
  for (const child of root.children.values()) {
    child.fail = root;
    queue.push(child);
  }
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const [ch, child] of node.children) {
      let fail = node.fail;
      while (fail && !fail.children.has(ch)) fail = fail.fail;
      child.fail = fail?.children.get(ch) ?? root;
      child.hits.push(...child.fail.hits);
      queue.push(child);
    }
  }
  return root;
}

let replaceCache: { automaton: AcNode; loadedAt: number } | null = null;
const REPLACE_CACHE_TTL_MS = 60_000;

function invalidateErrorProneCaches(): void {
  replaceCache = null;
  invalidateWordCheckCache();
}

async function getReplaceAutomaton(): Promise<AcNode> {
  if (!replaceCache || Date.now() - replaceCache.loadedAt >= REPLACE_CACHE_TTL_MS) {
    const words = await db.select().from(cmsErrorProneWords).where(eq(cmsErrorProneWords.status, 'enabled'));
    replaceCache = { automaton: buildAutomaton(words), loadedAt: Date.now() };
  }
  return replaceCache.automaton;
}

/**
 * 易错词批量替换：命中词替换为 correction，单次扫描 O(文本长度)。
 * 与 checkCmsText（只报告）不同，本函数直接改写文本，供内容保存管线按站点开关调用。
 */
export async function replaceErrorProneWords(text: string): Promise<string> {
  if (!text) return text;
  const root = await getReplaceAutomaton();
  if (root.children.size === 0) return text;

  const matches: { start: number; end: number; correction: string }[] = [];
  let node: AcNode = root;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    while (node !== root && !node.children.has(ch)) node = node.fail ?? root;
    node = node.children.get(ch) ?? root;
    for (const w of node.hits) {
      matches.push({ start: i - [...w.word].length + 1, end: i + 1, correction: w.correction });
    }
  }
  if (matches.length === 0) return text;

  // 按起点排序，长词优先，跳过重叠区间
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    out += chars.slice(cursor, m.start).join('') + m.correction;
    cursor = m.end;
  }
  return out + chars.slice(cursor).join('');
}

// ─── 数据映射 ─────────────────────────────────────────────────────────────────
export function mapCmsErrorProneWord(row: CmsErrorProneWordRow) {
  return {
    id: row.id,
    word: row.word,
    correction: row.correction,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export async function ensureCmsErrorProneWordExists(id: number): Promise<CmsErrorProneWordRow> {
  const [row] = await db.select().from(cmsErrorProneWords).where(eq(cmsErrorProneWords.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '易错词不存在' });
  return row;
}

// ─── 查询 ─────────────────────────────────────────────────────────────────────
export interface ListCmsErrorProneWordsQuery {
  keyword?: string;
  status?: 'enabled' | 'disabled';
  page: number;
  pageSize: number;
}

export async function listCmsErrorProneWords(q: ListCmsErrorProneWordsQuery) {
  const conditions: SQL[] = [];
  if (q.keyword) {
    const kw = or(
      like(cmsErrorProneWords.word, `%${escapeLike(q.keyword)}%`),
      like(cmsErrorProneWords.correction, `%${escapeLike(q.keyword)}%`),
    );
    if (kw) conditions.push(kw);
  }
  if (q.status) conditions.push(eq(cmsErrorProneWords.status, q.status));
  const where = mergeWhere(and(...conditions));
  const [total, list] = await Promise.all([
    db.$count(cmsErrorProneWords, where),
    withPagination(
      db.select().from(cmsErrorProneWords).where(where).orderBy(asc(cmsErrorProneWords.id)).$dynamic(),
      q.page,
      q.pageSize,
    ),
  ]);
  return { list: list.map(mapCmsErrorProneWord), total, page: q.page, pageSize: q.pageSize };
}

// ─── 写入 ─────────────────────────────────────────────────────────────────────
export async function createCmsErrorProneWord(data: CreateCmsErrorProneWordInput) {
  try {
    const [row] = await db.insert(cmsErrorProneWords).values(data).returning();
    invalidateErrorProneCaches();
    return mapCmsErrorProneWord(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '该易错词已存在');
  }
}

export async function updateCmsErrorProneWord(id: number, data: UpdateCmsErrorProneWordInput) {
  try {
    const [row] = await db.update(cmsErrorProneWords).set(data).where(eq(cmsErrorProneWords.id, id)).returning();
    if (!row) throw new HTTPException(404, { message: '易错词不存在' });
    invalidateErrorProneCaches();
    return mapCmsErrorProneWord(row);
  } catch (err) {
    rethrowPgUniqueViolation(err, '该易错词已存在');
  }
}

export async function deleteCmsErrorProneWord(id: number) {
  const [row] = await db.delete(cmsErrorProneWords).where(eq(cmsErrorProneWords.id, id)).returning();
  if (!row) throw new HTTPException(404, { message: '易错词不存在' });
  invalidateErrorProneCaches();
}
