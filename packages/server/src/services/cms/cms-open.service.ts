/**
 * Headless 开放 API 的 CMS 读取服务。
 *
 * 与后台/前台读取路径共用同一批「已发布内容」查询与素材句柄解析，
 * 因此站点权限、映射透传、素材替换等语义天然一致 —— 这里只负责按开放 API 的
 * 查询 DSL 收窄条件、裁剪字段与生成游标。
 *
 * 安全约束：只读已发布、未回收、未归档、所属栏目启用中的内容。
 */
import { and, asc, eq, exists, gt, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import {
  cmsChannels, cmsContentChannels, cmsContentRelations, cmsContents, cmsContentTags,
  cmsContentTombstones, cmsModels, cmsTags,
} from '../../db/schema';
import type { CmsContentRow, CmsSiteRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime, parseDateTimeInput } from '../../lib/datetime';
import { pageOffset } from '../../lib/pagination';
import { dateRangeConditions, escapeLike } from '../../lib/where-helpers';
import {
  encodeCmsOpenCursor, OpenQueryError, pickCmsOpenFields,
  type CmsOpenSortRule, type ParsedCmsOpenQuery,
} from '../../lib/open-query';
import { CMS_OPEN_SYNC_PAGE_SIZE_MAX } from '@zenith/shared/cms';
import { resolveCmsContentRows } from './cms-resource-refs.service';
import { listCmsModelFields } from './cms-models.service';
import { contentUrl } from './cms-urls';
import { buildCmsSearchCondition } from './cms-search.service';

const SORT_COLUMNS = {
  publishedAt: cmsContents.publishedAt,
  createdAt: cmsContents.createdAt,
  updatedAt: cmsContents.updatedAt,
  sort: cmsContents.sort,
  topWeight: cmsContents.topWeight,
  viewCount: cmsContents.viewCount,
  likeCount: cmsContents.likeCount,
  favoriteCount: cmsContents.favoriteCount,
  id: cmsContents.id,
} as const;

/** 已发布且对外可见：排除回收站、归档与停用栏目下的内容 */
function publicWhere(siteId: number): SQL {
  return and(
    eq(cmsContents.siteId, siteId),
    eq(cmsContents.status, 'published'),
    isNull(cmsContents.deletedAt),
    isNull(cmsContents.archivedAt),
    // 栏目停用即等同前台下线（渲染侧同样按 enabled 解析栏目）。
    // 不加这一条时，「不带 channel 参数」的站级 feed 会把停用栏目的内容连正文一起吐出来，
    // 而显式指定该栏目反而 404 —— 既不一致也是新增的暴露面。
    exists(
      db.select({ one: sql`1` }).from(cmsChannels).where(and(
        eq(cmsChannels.id, cmsContents.channelId),
        eq(cmsChannels.status, 'enabled'),
      )),
    ),
  )!;
}

async function resolveChannelIds(siteId: number, codes: string[]): Promise<number[]> {
  if (codes.length === 0) return [];
  const rows = await db.select({ id: cmsChannels.id, code: cmsChannels.code }).from(cmsChannels).where(and(
    eq(cmsChannels.siteId, siteId),
    eq(cmsChannels.status, 'enabled'),
    inArray(cmsChannels.code, codes),
  ));
  const found = new Set(rows.map((row) => row.code));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length > 0) throw new HTTPException(404, { message: `栏目标识不存在：${missing.join(', ')}` });
  return rows.map((row) => row.id);
}

async function resolveChannelPathIds(siteId: number, path: string): Promise<number[]> {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  if (!normalized) return [];
  const rows = await db.select({ id: cmsChannels.id }).from(cmsChannels).where(and(
    eq(cmsChannels.siteId, siteId),
    eq(cmsChannels.status, 'enabled'),
    or(eq(cmsChannels.path, normalized), sql`${cmsChannels.path} like ${`${escapeLike(normalized)}/%`}`)!,
  ));
  if (rows.length === 0) throw new HTTPException(404, { message: `栏目路径不存在：${path}` });
  return rows.map((row) => row.id);
}

async function resolveTagIds(siteId: number, slugs: string[]): Promise<number[]> {
  if (slugs.length === 0) return [];
  const rows = await db.select({ id: cmsTags.id }).from(cmsTags).where(and(
    eq(cmsTags.siteId, siteId),
    inArray(cmsTags.slug, slugs),
  ));
  if (rows.length === 0) throw new HTTPException(404, { message: `标签不存在：${slugs.join(', ')}` });
  return rows.map((row) => row.id);
}

/**
 * 扩展字段过滤：只允许模型中标记为 `searchable` 的字段。
 *
 * 否则外部应用可以用任意 JSONB 路径探测未公开的扩展字段（如内部备注、成本价）。
 */
async function buildExtendConditions(
  siteId: number,
  filters: { field: string; value: string }[],
): Promise<SQL[]> {
  if (filters.length === 0) return [];
  const models = await db.select({ id: cmsModels.id }).from(cmsModels);
  const allowed = new Set<string>();
  for (const model of models) {
    for (const field of await listCmsModelFields(model.id)) {
      if (field.searchable) allowed.add(field.name);
    }
  }
  return filters.map((filter) => {
    if (!allowed.has(filter.field)) {
      throw new HTTPException(400, { message: `扩展字段「${filter.field}」不可用于过滤（需在内容模型中标记为「纳入检索」）` });
    }
    return sql`${cmsContents.extend} ->> ${filter.field} = ${filter.value}`;
  });
}

/** 时间型排序字段：PG 侧是微秒精度，游标必须按微秒比较 */
const TIME_SORT_FIELDS = new Set<CmsOpenSortRule['field']>(['publishedAt', 'createdAt', 'updatedAt']);

/** 时间列 → 微秒整数（文本返回，避免 bigint 精度在驱动层被截断） */
const microsOf = (column: PgColumn) => sql<string>`((extract(epoch from ${column}) * 1000000)::bigint)::text`;

/** 微秒 → 与 timestamp 列同基准的 UTC 墙钟时间 */
const microsToTimestamp = (micros: number) => sql`(to_timestamp(${micros} / 1000000.0) at time zone 'UTC')`;

/**
 * ORDER BY 一律 `NULLS LAST`。
 *
 * PG 的缺省是 desc → NULLS FIRST、asc → NULLS LAST，两个方向不一致，
 * keyset 条件没法用同一套「空值组恒在尾部」的推进逻辑；显式写死后
 * `cursorCondition` 的空值分支对两个方向都成立。
 */
function orderByOf(rules: CmsOpenSortRule[]) {
  return rules.map((rule) => sql`${SORT_COLUMNS[rule.field]} ${sql.raw(rule.direction)} nulls last`);
}

/** 主排序字段的游标值（时间列取**微秒**时间戳，见 TIME_SORT_FIELDS） */
function cursorValueOf(row: CmsContentRow, field: CmsOpenSortRule['field']): number | null {
  const value = (row as unknown as Record<string, unknown>)[field];
  if (value == null) return null;
  if (value instanceof Date) return value.getTime() * 1000;
  return Number(value);
}

/**
 * keyset 条件：`(主排序字段, id)` 严格大于/小于游标。
 *
 * **仅支持「单个排序字段 + id 兜底」**：多字段排序时 ORDER BY 是字典序，而这里只比较主字段，
 * 中间字段被忽略会同时造成重复行与漏行（例如 `-topWeight,-publishedAt` 下 topWeight 几乎全为 0，
 * 整个结果集是一个并列组，游标却只按 id 过滤）。多字段排序在 `assertCursorSortable` 处提前拒绝。
 *
 * 时间列按**微秒**比较：PG 的 `timestamp` 是微秒精度而 JS `Date` 只到毫秒，
 * 用毫秒边界会让 desc 漏掉 `[边界, 真实值)` 区间的行、asc 把游标行自己重新纳入（同一时刻多行时直接死循环）。
 */
function cursorCondition(rules: CmsOpenSortRule[], cursor: { value: number | null; id: number }): SQL {
  const primary = rules[0];
  const column = SORT_COLUMNS[primary.field];
  const idColumn = cmsContents.id;
  // id 用它自己的方向，而不是主字段的方向：sort=-publishedAt,+id 时两者不一致
  const idRule = rules.find((rule) => rule.field === 'id') ?? primary;
  const idAfter = idRule.direction === 'desc' ? lt(idColumn, cursor.id) : gt(idColumn, cursor.id);

  if (primary.field === 'id') return idAfter;

  const bound = cursor.value == null
    ? null
    : (TIME_SORT_FIELDS.has(primary.field) ? microsToTimestamp(cursor.value) : sql`${cursor.value}`);

  if (bound == null) {
    // 主排序值为 null：空值组恒在尾部（orderBy 强制 nulls last），只能继续在组内按 id 推进
    return and(isNull(column), idAfter)!;
  }
  const strictly = primary.direction === 'desc' ? lt(column, bound) : gt(column, bound);
  const tie = and(eq(column, bound), idAfter);
  // 空值组排在所有有值行之后，翻页要能跨过边界进入该组
  return or(strictly, tie, isNull(column))!;
}

/**
 * 游标翻页要求排序可被 keyset 表达：至多一个非 id 排序字段。
 *
 * 与其在多字段排序下悄悄给出重复/缺失的结果，不如直接告诉调用方换用 page 模式。
 */
function assertCursorSortable(rules: CmsOpenSortRule[]): void {
  const nonId = rules.filter((rule) => rule.field !== 'id');
  if (nonId.length > 1) {
    throw new HTTPException(400, {
      message: `游标翻页仅支持单个排序字段（当前为 ${nonId.map((r) => r.field).join(', ')}），请改用 page 分页或只保留一个排序字段`,
    });
  }
}

async function buildListConditions(site: CmsSiteRow, query: ParsedCmsOpenQuery): Promise<SQL[]> {
  const conditions: SQL[] = [publicWhere(site.id)];

  const channelIds = [
    ...await resolveChannelIds(site.id, query.channels),
    ...(query.channelPath ? await resolveChannelPathIds(site.id, query.channelPath) : []),
  ];
  if (channelIds.length > 0) {
    // 聚合主栏目与副栏目，与前台栏目列表保持一致
    const extraIds = db.select({ contentId: cmsContentChannels.contentId })
      .from(cmsContentChannels).where(inArray(cmsContentChannels.channelId, channelIds));
    conditions.push(or(inArray(cmsContents.channelId, channelIds), inArray(cmsContents.id, extraIds))!);
  }

  const tagIds = await resolveTagIds(site.id, query.tags);
  if (tagIds.length > 0) {
    const taggedIds = db.select({ contentId: cmsContentTags.contentId })
      .from(cmsContentTags).where(inArray(cmsContentTags.tagId, tagIds));
    conditions.push(inArray(cmsContents.id, taggedIds));
  }

  if (query.contentTypes.length > 0) {
    conditions.push(inArray(cmsContents.contentType, query.contentTypes as CmsContentRow['contentType'][]));
  }
  if (query.author) conditions.push(eq(cmsContents.author, query.author));
  if (query.modelCode) {
    const [model] = await db.select({ id: cmsModels.id }).from(cmsModels).where(eq(cmsModels.code, query.modelCode)).limit(1);
    if (!model) throw new HTTPException(404, { message: `内容模型「${query.modelCode}」不存在` });
    conditions.push(eq(cmsContents.modelId, model.id));
  }
  if (query.flags.isTop !== undefined) conditions.push(eq(cmsContents.isTop, query.flags.isTop));
  if (query.flags.isRecommend !== undefined) conditions.push(eq(cmsContents.isRecommend, query.flags.isRecommend));
  if (query.flags.isHot !== undefined) conditions.push(eq(cmsContents.isHot, query.flags.isHot));
  if (query.flags.isOriginal !== undefined) conditions.push(eq(cmsContents.isOriginal, query.flags.isOriginal));

  conditions.push(...dateRangeConditions(cmsContents.publishedAt, query.publishedFrom, query.publishedTo));

  if (query.keyword) {
    // 与站内搜索共用分词与 tsquery 构造，保证同一关键词结果集一致
    const condition = buildCmsSearchCondition(query.keyword, site.id);
    conditions.push(condition ?? sql`false`);
  }

  conditions.push(...await buildExtendConditions(site.id, query.extendFilters));
  return conditions;
}

// ─── 输出映射 ────────────────────────────────────────────────────────────────

/** 开放 API 的内容输出形态（与 CmsOpenContentDTO 对齐：除 id 外均可被裁剪掉） */
export type CmsOpenContentOutput = { id: number } & Record<string, unknown>;

interface MapOpenContentOptions {
  channelMap: Map<number, { code: string; path: string; detailPathRule: CmsContentRow['contentType'] extends never ? never : string }>;
  modelMap: Map<number, string>;
  includes: Set<string>;
  tags?: Map<number, { name: string; slug: string }[]>;
  relations?: Map<number, number[]>;
  bodyExtend?: Map<number, { body: string | null; extend: Record<string, unknown> }>;
}

function mapOpenContent(row: CmsContentRow & { coverThumb: string | null }, opts: MapOpenContentOptions): CmsOpenContentOutput {
  const channel = opts.channelMap.get(row.channelId);
  const out: Record<string, unknown> = {
    id: row.id,
    siteId: row.siteId,
    channelId: row.channelId,
    channelCode: channel?.code ?? null,
    modelCode: row.modelId ? (opts.modelMap.get(row.modelId) ?? null) : null,
    contentType: row.contentType,
    title: row.title,
    subTitle: row.subTitle ?? null,
    shortTitle: row.shortTitle ?? null,
    slug: row.slug ?? null,
    summary: row.summary ?? null,
    coverImage: row.coverImage ?? null,
    coverThumb: row.coverThumb ?? null,
    author: row.author ?? null,
    editor: row.editor ?? null,
    source: row.source ?? null,
    sourceUrl: row.sourceUrl ?? null,
    isOriginal: row.isOriginal,
    externalLink: row.externalLink ?? null,
    isTop: row.isTop,
    topWeight: row.topWeight,
    isRecommend: row.isRecommend,
    isHot: row.isHot,
    hasImage: row.hasImage,
    hasVideo: row.hasVideo,
    hasAttachment: row.hasAttachment,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    favoriteCount: row.favoriteCount,
    sort: row.sort,
    version: row.version,
    seoTitle: row.seoTitle ?? null,
    seoKeywords: row.seoKeywords ?? null,
    seoDescription: row.seoDescription ?? null,
    publishedAt: formatNullableDateTime(row.publishedAt),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
    url: channel
      ? contentUrl('', { path: channel.path, detailPathRule: channel.detailPathRule as never }, row)
      : null,
  };
  if (opts.includes.has('attachments')) out.attachments = row.attachments ?? [];
  if (opts.includes.has('tags')) out.tags = opts.tags?.get(row.id) ?? [];
  if (opts.includes.has('relations')) out.relations = opts.relations?.get(row.id) ?? [];
  if (opts.includes.has('channel')) {
    out.channel = channel ? { id: row.channelId, code: channel.code, path: channel.path } : null;
  }
  if (opts.includes.has('body')) out.body = opts.bodyExtend?.get(row.id)?.body ?? null;
  if (opts.includes.has('extend')) out.extend = opts.bodyExtend?.get(row.id)?.extend ?? {};
  if (row.contentType !== 'article') out.mediaData = row.mediaData ?? {};
  return out as CmsOpenContentOutput;
}

async function buildMapOptions(
  siteId: number,
  rows: readonly CmsContentRow[],
  includes: Set<string>,
): Promise<MapOpenContentOptions> {
  const channels = await db.select({
    id: cmsChannels.id, code: cmsChannels.code, path: cmsChannels.path,
    detailPathRule: cmsChannels.detailPathRule, status: cmsChannels.status,
  }).from(cmsChannels).where(eq(cmsChannels.siteId, siteId));
  const channelMap = new Map(channels.map((row) => [row.id, { code: row.code, path: row.path, detailPathRule: row.detailPathRule as never }]));

  const modelIds = [...new Set(rows.map((row) => row.modelId).filter((id): id is number => id != null))];
  const models = modelIds.length > 0
    ? await db.select({ id: cmsModels.id, code: cmsModels.code }).from(cmsModels).where(inArray(cmsModels.id, modelIds))
    : [];
  const modelMap = new Map(models.map((row) => [row.id, row.code]));

  const ids = rows.map((row) => row.id);
  const opts: MapOpenContentOptions = { channelMap, modelMap, includes };

  if (includes.has('tags') && ids.length > 0) {
    const rowsTags = await db.select({ contentId: cmsContentTags.contentId, name: cmsTags.name, slug: cmsTags.slug })
      .from(cmsContentTags)
      .innerJoin(cmsTags, eq(cmsContentTags.tagId, cmsTags.id))
      .where(inArray(cmsContentTags.contentId, ids));
    const map = new Map<number, { name: string; slug: string }[]>();
    for (const row of rowsTags) {
      const list = map.get(row.contentId) ?? [];
      list.push({ name: row.name, slug: row.slug });
      map.set(row.contentId, list);
    }
    opts.tags = map;
  }

  if (includes.has('relations') && ids.length > 0) {
    const rowsRel = await db.select({ contentId: cmsContentRelations.contentId, relatedId: cmsContentRelations.relatedId })
      .from(cmsContentRelations)
      .where(inArray(cmsContentRelations.contentId, ids))
      .orderBy(asc(cmsContentRelations.sort));
    const map = new Map<number, number[]>();
    for (const row of rowsRel) {
      const list = map.get(row.contentId) ?? [];
      list.push(row.relatedId);
      map.set(row.contentId, list);
    }
    opts.relations = map;
  }

  if ((includes.has('body') || includes.has('extend')) && rows.length > 0) {
    // 映射内容的正文透传来源行：先批量取回全部来源，再整批解析素材句柄。
    // 逐行 await 会退化成 100~200 次串行往返（resolveCmsContentRows 本就是为批量取数设计的）
    const sourceIds = [...new Set(rows.map((row) => row.mappingSourceId).filter((id): id is number => id != null))];
    const sources = sourceIds.length > 0
      ? await db.select({ id: cmsContents.id, body: cmsContents.body, extend: cmsContents.extend })
          .from(cmsContents).where(inArray(cmsContents.id, sourceIds))
      : [];
    const sourceById = new Map(sources.map((row) => [row.id, row]));
    const raw = rows.map((row) => {
      const source = row.mappingSourceId ? sourceById.get(row.mappingSourceId) : null;
      return {
        id: row.id,
        coverImage: null,
        body: source ? source.body ?? null : row.body ?? null,
        extend: (source ? source.extend : row.extend) ?? {},
      };
    });
    const resolvedBodies = await resolveCmsContentRows(raw);
    opts.bodyExtend = new Map(resolvedBodies.map((row) => [
      row.id,
      { body: row.body ?? null, extend: (row.extend ?? {}) as Record<string, unknown> },
    ]));
  }
  return opts;
}

// ─── 列表 ────────────────────────────────────────────────────────────────────

export async function listOpenCmsContents(site: CmsSiteRow, query: ParsedCmsOpenQuery) {
  const conditions = await buildListConditions(site, query);
  const baseWhere = and(...conditions)!;
  const order = orderByOf(query.sort);

  const [total, rows] = await Promise.all([
    db.$count(cmsContents, baseWhere),
    db.select().from(cmsContents).where(baseWhere).orderBy(...order)
      .limit(query.pageSize).offset(pageOffset(query.page, query.pageSize)),
  ]);
  const resolved = await resolveCmsContentRows(rows);
  const opts = await buildMapOptions(site.id, rows, query.includes);
  return {
    list: resolved.map((row) => pickCmsOpenFields(mapOpenContent(row, opts), query.fields)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * 游标翻页：keyset 推进，深翻不退化为大 offset，且期间新增内容不会让结果错行。
 * 适合客户端做全量首次拉取。
 */
export async function listOpenCmsContentsByCursor(site: CmsSiteRow, query: ParsedCmsOpenQuery) {
  assertCursorSortable(query.sort);
  const conditions = await buildListConditions(site, query);
  const cursor = query.cursor;
  const primaryField = query.sort[0].field;
  const isTimeSort = TIME_SORT_FIELDS.has(primaryField);
  // 时间列的游标值必须取 PG 的微秒原值：JS Date 只有毫秒，回写的边界永远小于真实值
  const rows = await db.select({
    row: cmsContents,
    micros: isTimeSort ? microsOf(SORT_COLUMNS[primaryField]) : sql<string | null>`null`,
  }).from(cmsContents)
    .where(cursor ? and(and(...conditions)!, cursorCondition(query.sort, cursor)) : and(...conditions)!)
    .orderBy(...orderByOf(query.sort))
    .limit(query.pageSize + 1);
  const hasMore = rows.length > query.pageSize;
  const pageRows = rows.slice(0, query.pageSize);
  const page = pageRows.map((item) => item.row);
  const resolved = await resolveCmsContentRows(page);
  const opts = await buildMapOptions(site.id, page, query.includes);
  const last = pageRows.at(-1);
  const lastValue = last
    ? (isTimeSort ? (last.micros == null ? null : Number(last.micros)) : cursorValueOf(last.row, primaryField))
    : null;
  return {
    list: resolved.map((row) => pickCmsOpenFields(mapOpenContent(row, opts), query.fields)),
    pageSize: query.pageSize,
    hasMore,
    nextCursor: hasMore && last ? encodeCmsOpenCursor({ value: lastValue, id: last.row.id }) : null,
  };
}

// ─── 详情 ────────────────────────────────────────────────────────────────────

export async function getOpenCmsContent(site: CmsSiteRow, idOrSlug: string, query: ParsedCmsOpenQuery) {
  const numericId = /^\d+$/.test(idOrSlug) ? Number(idOrSlug) : null;
  const matcher = numericId !== null ? eq(cmsContents.id, numericId) : eq(cmsContents.slug, idOrSlug);
  const [row] = await db.select().from(cmsContents).where(and(publicWhere(site.id), matcher)).limit(1);
  if (!row) throw new HTTPException(404, { message: '内容不存在或未发布' });
  // 详情默认返回正文与扩展字段，无需显式 include
  const includes = new Set([...query.includes, 'body', 'extend', 'tags', 'attachments', 'channel']);
  const [resolved] = await resolveCmsContentRows([row]);
  const opts = await buildMapOptions(site.id, [row], includes);
  return pickCmsOpenFields(mapOpenContent(resolved, opts), query.fields);
}

// ─── 增量同步 ────────────────────────────────────────────────────────────────

/**
 * 按 `updated_at` keyset 输出变更集，元素带 `op`。
 *
 * - `upsert`：当前公开可见的内容
 * - `delete`：不再公开（下线/回收/归档）或已被彻底删除（墓碑表）
 *
 * **两路数据合并为同一个游标流**：内容按 `(updated_at, id)`、墓碑按 `(deleted_at, content_id)`，
 * 两者用同一把 `(时间, id)` 尺子排序并合并后统一截断。早期实现给墓碑单独加 limit、
 * 且不参与 `hasMore` 与 `nextCursor`，一旦某个区间的硬删除超过一页就会被永久丢弃，
 * 客户端缓存里的已删内容再也清不掉。
 */
export async function syncOpenCmsContents(
  site: CmsSiteRow,
  input: { since?: string | null; cursor?: { value: number | null; id: number } | null; pageSize: number; includes: Set<string> },
) {
  const pageSize = Math.min(CMS_OPEN_SYNC_PAGE_SIZE_MAX, Math.max(1, input.pageSize));
  /**
   * 游标时间以**微秒**为单位（与游标列表端点共用 `microsOf` / `microsToTimestamp`）。
   *
   * PG 的 `timestamp` 是微秒精度，而 JS `Date` 只到毫秒：若游标只带毫秒，
   * `updated_at = 11:16:13.818587` 会永远满足 `> 11:16:13.818000`，同一页无限重复。
   * 2026 年的微秒数约 1.78e15，仍在 `Number.MAX_SAFE_INTEGER`（9.0e15）之内。
   */
  let anchor: { micros: number; id: number } | null = null;
  if (input.cursor) {
    anchor = { micros: input.cursor.value ?? 0, id: input.cursor.id };
  } else if (input.since) {
    const parsed = parseDateTimeInput(input.since);
    if (!parsed) throw new OpenQueryError('since 时间格式不正确（YYYY-MM-DD HH:mm:ss）');
    // 首次同步没有 id 锚点：用 -1 让「等于 since 且 id >= 0」的行也进入结果
    anchor = { micros: parsed.getTime() * 1000, id: -1 };
  }
  const anchorTs = anchor ? microsToTimestamp(anchor.micros) : null;

  /** (时间, id) 严格大于锚点 */
  const after = (atColumn: PgColumn, idColumn: PgColumn): SQL | undefined =>
    anchor && anchorTs
      ? or(gt(atColumn, anchorTs), and(eq(atColumn, anchorTs), gt(idColumn, anchor.id)))!
      : undefined;

  const [rows, tombstoneRows] = await Promise.all([
    db.select({ row: cmsContents, micros: microsOf(cmsContents.updatedAt) }).from(cmsContents)
      .where(and(eq(cmsContents.siteId, site.id), after(cmsContents.updatedAt, cmsContents.id)))
      .orderBy(asc(cmsContents.updatedAt), asc(cmsContents.id))
      .limit(pageSize + 1),
    db.select({ row: cmsContentTombstones, micros: microsOf(cmsContentTombstones.deletedAt) }).from(cmsContentTombstones)
      .where(and(
        eq(cmsContentTombstones.siteId, site.id),
        after(cmsContentTombstones.deletedAt, cmsContentTombstones.contentId),
      ))
      .orderBy(asc(cmsContentTombstones.deletedAt), asc(cmsContentTombstones.contentId))
      .limit(pageSize + 1),
  ]);

  type Entry = { micros: number; at: Date; id: number; row?: CmsContentRow };
  const merged: Entry[] = [
    ...rows.map((item) => ({ micros: Number(item.micros), at: item.row.updatedAt, id: item.row.id, row: item.row })),
    ...tombstoneRows.map((item) => ({ micros: Number(item.micros), at: item.row.deletedAt, id: item.row.contentId })),
  ].sort((a, b) => (a.micros - b.micros) || (a.id - b.id));

  const hasMore = merged.length > pageSize;
  const page = merged.slice(0, pageSize);

  // 可见性判定与 publicWhere 保持一致：栏目停用等同下线，这类内容以 delete 下发，
  // 否则集成方会一直保留一份在前台已经看不到的内容。
  const enabledChannelIds = new Set(
    (await db.select({ id: cmsChannels.id }).from(cmsChannels)
      .where(and(eq(cmsChannels.siteId, site.id), eq(cmsChannels.status, 'enabled')))).map((row) => row.id),
  );
  const visible = page
    .map((entry) => entry.row)
    .filter((row): row is CmsContentRow =>
      !!row && row.status === 'published' && !row.deletedAt && !row.archivedAt
      && enabledChannelIds.has(row.channelId));
  const resolved = await resolveCmsContentRows(visible);
  const opts = await buildMapOptions(site.id, visible, input.includes);
  const byId = new Map(resolved.map((row) => [row.id, row]));

  const changes = page.map((entry): { op: 'upsert' | 'delete'; id: number; updatedAt: string; content?: CmsOpenContentOutput } => {
    const resolvedRow = byId.get(entry.id);
    if (!resolvedRow) return { op: 'delete', id: entry.id, updatedAt: formatDateTime(entry.at) };
    return { op: 'upsert', id: entry.id, updatedAt: formatDateTime(entry.at), content: mapOpenContent(resolvedRow, opts) };
  });

  const last = page.at(-1);
  return {
    changes,
    pageSize,
    hasMore,
    nextCursor: hasMore && last ? encodeCmsOpenCursor({ value: last.micros, id: last.id }) : null,
  };
}
