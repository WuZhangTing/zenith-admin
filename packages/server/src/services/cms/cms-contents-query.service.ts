import { eq, asc, desc, and, or, like, inArray, notInArray, isNull, isNotNull, ne, lt, gt, sql, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { cmsContents, cmsContentTags, cmsContentChannels, cmsContentRelations } from '../../db/schema';
import type { CmsContentRow, CmsTagRow } from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { dateRangeConditions, escapeLike, mergeWhere, withPagination } from '../../lib/where-helpers';
import { config } from '../../config';
import redis from '../../lib/redis';
import { getAccessibleChannelIds, assertChannelAccess } from './cms-channels.service';
import { assertSiteAccess, ensureCmsSiteExists } from './cms-sites.service';
import { getDataScopeCondition } from '../../lib/data-scope';
import { currentUserOrNull } from '../../lib/context';
import type { CmsContentStatus } from '@zenith/shared/cms';
import { pageOffset } from '../../lib/pagination';
import { resolveCmsContentRow, resolveCmsContentRows } from './cms-resource-refs.service';

// ─── 数据映射 ─────────────────────────────────────────────────────────────────

/**
 * 已解析素材句柄的内容行。
 *
 * `coverThumb` 不再是数据库列，而是由封面素材派生（媒体库选图同样有缩略图，
 * 且替换素材后自动跟随）；正文/形态数据/扩展字段中的 `cms-res://` 也已还原为真实 URL。
 */
export type ResolvedCmsContentRow = CmsContentRow & { coverThumb: string | null };

export function mapCmsContent(row: CmsContentRow & { coverThumb?: string | null }, extra?: { channelName?: string | null; tags?: CmsTagRow[]; extraChannelIds?: number[]; relatedIds?: number[]; mappingSourceTitle?: string | null; lockedByName?: string | null }) {
  return {
    id: row.id,
    siteId: row.siteId,
    channelId: row.channelId,
    channelName: extra?.channelName ?? null,
    modelId: row.modelId ?? null,
    contentType: row.contentType,
    mediaData: row.mediaData ?? {},
    title: row.title,
    titleStyle: row.titleStyle ?? {},
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
    body: row.body ?? null,
    attachments: row.attachments ?? [],
    extend: row.extend ?? {},
    externalLink: row.externalLink ?? null,
    detailTemplate: row.detailTemplate ?? null,
    staticPath: row.staticPath ?? null,
    isTop: row.isTop,
    topWeight: row.topWeight,
    topExpireAt: formatNullableDateTime(row.topExpireAt),
    isRecommend: row.isRecommend,
    isHot: row.isHot,
    hasImage: row.hasImage,
    hasVideo: row.hasVideo,
    hasAttachment: row.hasAttachment,
    status: row.status,
    rejectReason: row.rejectReason ?? null,
    publishedAt: formatNullableDateTime(row.publishedAt),
    scheduledAt: formatNullableDateTime(row.scheduledAt),
    expireAt: formatNullableDateTime(row.expireAt),
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    favoriteCount: row.favoriteCount,
    version: row.version,
    sort: row.sort,
    seoTitle: row.seoTitle ?? null,
    seoKeywords: row.seoKeywords ?? null,
    seoDescription: row.seoDescription ?? null,
    socialImageAlt: row.socialImageAlt ?? null,
    twitterCreator: row.twitterCreator ?? null,
    memberId: row.memberId ?? null,
    archivedAt: formatNullableDateTime(row.archivedAt),
    mappingSourceId: row.mappingSourceId ?? null,
    mappingSourceTitle: extra?.mappingSourceTitle ?? null,
    distributionRuleId: row.distributionRuleId ?? null,
    distributionSourceId: row.distributionSourceId ?? null,
    distributionSourceVersion: row.distributionSourceVersion ?? null,
    lockedAt: formatNullableDateTime(row.lockedAt),
    lockedBy: row.lockedBy ?? null,
    lockedByName: extra?.lockedByName ?? null,
    lockReason: row.lockReason ?? null,
    ...(extra?.tags ? {
      tags: extra.tags.map((t) => ({
        id: t.id, siteId: t.siteId, name: t.name, slug: t.slug, groupName: t.groupName ?? null, contentCount: t.contentCount,
        createdAt: formatDateTime(t.createdAt), updatedAt: formatDateTime(t.updatedAt),
      })),
      tagIds: extra.tags.map((t) => t.id),
    } : {}),
    ...(extra?.extraChannelIds ? { extraChannelIds: extra.extraChannelIds } : {}),
    ...(extra?.relatedIds ? { relatedIds: extra.relatedIds } : {}),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

// ─── 前置校验 ─────────────────────────────────────────────────────────────────
export async function ensureCmsContentExists(id: number): Promise<CmsContentRow> {
  const [row] = await db.select().from(cmsContents).where(eq(cmsContents.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '内容不存在' });
  return row;
}

export async function getCmsContent(id: number) {
  const current = await ensureCmsContentExists(id);
  await assertSiteAccess(current.siteId);
  await assertChannelAccess(current.channelId);
  const row = await db.query.cmsContents.findFirst({
    where: eq(cmsContents.id, id),
    with: {
      channel: { columns: { name: true } },
      contentTags: { with: { tag: true } },
      extraChannels: { columns: { channelId: true } },
      relatedContents: { columns: { relatedId: true, sort: true } },
      mappingSource: { columns: { title: true, body: true, extend: true } },
      lockedByUser: { columns: { nickname: true } },
    },
  });
  if (!row) throw new HTTPException(404, { message: '内容不存在' });
  // 映射内容：正文/扩展字段透传来源内容（只读展示；本行自身不存正文）
  const source = row.mappingSourceId && row.mappingSource ? row.mappingSource : null;
  const resolved = await resolveCmsContentRow({
    ...row,
    ...(source ? { body: source.body ?? null, extend: source.extend ?? {} } : {}),
  });
  return mapCmsContent(resolved, {
    channelName: row.channel?.name,
    tags: row.contentTags.map((ct) => ct.tag),
    extraChannelIds: row.extraChannels.map((ec) => ec.channelId),
    relatedIds: [...row.relatedContents].sort((a, b) => a.sort - b.sort).map((r) => r.relatedId),
    mappingSourceTitle: row.mappingSource?.title ?? null,
    lockedByName: row.lockedByUser?.nickname ?? null,
  });
}

// ─── 列表 ─────────────────────────────────────────────────────────────────────
export interface ListCmsContentsQuery {
  siteId: number;
  channelId?: number;
  status?: CmsContentStatus;
  contentType?: 'article' | 'album' | 'media' | 'link';
  keyword?: string;
  isTop?: boolean;
  isRecommend?: boolean;
  isHot?: boolean;
  /** true = 回收站列表 */
  deleted?: boolean;
  /** true = 仅归档内容；false/未传 = 排除归档内容 */
  archived?: boolean;
  startTime?: string;
  endTime?: string;
  page: number;
  pageSize: number;
}

export async function listCmsContents(q: ListCmsContentsQuery) {
  await ensureCmsSiteExists(q.siteId);
  await assertSiteAccess(q.siteId);
  if (q.channelId) await assertChannelAccess(q.channelId);
  const conditions: SQL[] = [
    eq(cmsContents.siteId, q.siteId),
  ];
  const accessibleChannelIds = await getAccessibleChannelIds();
  if (accessibleChannelIds !== null) conditions.push(inArray(cmsContents.channelId, accessibleChannelIds));
  conditions.push(q.deleted ? isNotNull(cmsContents.deletedAt) : isNull(cmsContents.deletedAt));
  // 归档独立视图：默认列表排除归档，archived=true 仅看归档（回收站视图不叠加归档过滤）
  if (!q.deleted) conditions.push(q.archived ? isNotNull(cmsContents.archivedAt) : isNull(cmsContents.archivedAt));
  if (q.channelId) conditions.push(eq(cmsContents.channelId, q.channelId));
  if (q.status) conditions.push(eq(cmsContents.status, q.status));
  if (q.contentType) conditions.push(eq(cmsContents.contentType, q.contentType));
  if (q.isTop !== undefined) conditions.push(eq(cmsContents.isTop, q.isTop));
  if (q.isRecommend !== undefined) conditions.push(eq(cmsContents.isRecommend, q.isRecommend));
  if (q.isHot !== undefined) conditions.push(eq(cmsContents.isHot, q.isHot));
  if (q.keyword) {
    const kw = or(
      like(cmsContents.title, `%${escapeLike(q.keyword)}%`),
      like(cmsContents.author, `%${escapeLike(q.keyword)}%`),
    );
    if (kw) conditions.push(kw);
  }
  // 时间范围为闭区间：此前用 gt/lt 开区间，边界时刻创建的内容会被漏掉
  conditions.push(...dateRangeConditions(cmsContents.createdAt, q.startTime, q.endTime));

  // P5 部门数据权限：按创建时快照的部门/创建人过滤
  const scopeUser = currentUserOrNull();
  if (scopeUser) {
    const scopeCondition = await getDataScopeCondition({
      currentUserId: scopeUser.userId,
      deptColumn: cmsContents.deptId,
      ownerColumn: cmsContents.createdBy,
    });
    if (scopeCondition) conditions.push(scopeCondition);
  }

  const where = mergeWhere(and(...conditions));
  const [total, rows] = await Promise.all([
    db.$count(cmsContents, where),
    db.query.cmsContents.findMany({
      where,
      with: {
        channel: { columns: { name: true } },
        lockedByUser: { columns: { nickname: true } },
      },
      orderBy: [desc(cmsContents.isTop), desc(cmsContents.topWeight), desc(cmsContents.id)],
      limit: q.pageSize,
      offset: pageOffset(q.page, q.pageSize),
    }),
  ]);
  const resolvedRows = await resolveCmsContentRows(rows);
  return {
    list: resolvedRows.map((r) => mapCmsContent(r, {
      channelName: r.channel?.name,
      lockedByName: r.lockedByUser?.nickname ?? null,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

// ─── 标题查重（P4：编辑辅助提示，不阻断保存；排除回收站与自身）───────────────────
export async function checkCmsContentTitle(siteId: number, title: string, excludeId?: number) {
  await ensureCmsSiteExists(siteId);
  await assertSiteAccess(siteId);
  const conditions: SQL[] = [
    eq(cmsContents.siteId, siteId),
    eq(cmsContents.title, title.trim()),
    isNull(cmsContents.deletedAt),
  ];
  const accessibleChannelIds = await getAccessibleChannelIds();
  if (accessibleChannelIds !== null) conditions.push(inArray(cmsContents.channelId, accessibleChannelIds));
  if (excludeId) conditions.push(ne(cmsContents.id, excludeId));
  const rows = await db.select({ id: cmsContents.id, title: cmsContents.title, status: cmsContents.status, channelId: cmsContents.channelId })
    .from(cmsContents)
    .where(and(...conditions))
    .orderBy(desc(cmsContents.id))
    .limit(5);
  return {
    duplicate: rows.length > 0,
    matches: rows.map((r) => ({ id: r.id, title: r.title, status: r.status })),
  };
}

// ─── 前台查询（渲染上下文使用）────────────────────────────────────────────────
const publishedWhere = (siteId: number) => and(
  eq(cmsContents.siteId, siteId),
  eq(cmsContents.status, 'published'),
  isNull(cmsContents.deletedAt),
)!;

/** 栏目下已发布内容分页（含以此为副栏目的内容；归档内容不参与聚合；置顶权重优先，发布时间倒序） */
export async function listPublishedContents(siteId: number, channelId: number, page: number, pageSize: number) {
  const extraIdsQuery = db.select({ contentId: cmsContentChannels.contentId })
    .from(cmsContentChannels).where(and(
      eq(cmsContentChannels.channelId, channelId),
    ));
  const where = and(
    publishedWhere(siteId),
    isNull(cmsContents.archivedAt),
    or(eq(cmsContents.channelId, channelId), inArray(cmsContents.id, extraIdsQuery)),
  )!;
  const [total, rows] = await Promise.all([
    db.$count(cmsContents, where),
    withPagination(
      db.select().from(cmsContents).where(where)
        .orderBy(desc(cmsContents.isTop), desc(cmsContents.topWeight), desc(cmsContents.sort), desc(cmsContents.publishedAt), desc(cmsContents.id))
        .$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { total, rows: await resolveCmsContentRows(rows) };
}

/** 首页区块：最新 / 推荐 / 热门（归档内容不参与） */
export async function listHomeContents(siteId: number, limit = 10) {
  const base = and(publishedWhere(siteId), isNull(cmsContents.archivedAt))!;
  const [latest, recommended, hot] = await Promise.all([
    db.select().from(cmsContents).where(base).orderBy(desc(cmsContents.publishedAt), desc(cmsContents.id)).limit(limit),
    db.select().from(cmsContents).where(and(base, eq(cmsContents.isRecommend, true))).orderBy(desc(cmsContents.publishedAt)).limit(limit),
    db.select().from(cmsContents).where(and(base, eq(cmsContents.isHot, true))).orderBy(desc(cmsContents.viewCount)).limit(limit),
  ]);
  return {
    latest: await resolveCmsContentRows(latest),
    recommended: await resolveCmsContentRows(recommended),
    hot: await resolveCmsContentRows(hot),
  };
}

/** 前台详情（按 id 或 slug）；返回 null 表示 404 */
export async function getPublishedContent(siteId: number, channelId: number, idOrSlug: string): Promise<ResolvedCmsContentRow | null> {
  const numericId = /^\d+$/.test(idOrSlug) ? Number(idOrSlug) : null;
  const matcher = numericId !== null ? eq(cmsContents.id, numericId) : eq(cmsContents.slug, idOrSlug);
  const [row] = await db.select().from(cmsContents)
    .where(and(publishedWhere(siteId), eq(cmsContents.channelId, channelId), matcher))
    .limit(1);
  return row ? resolveCmsContentRow(row) : null;
}

/** 按 id 取站点内已发布内容（不限栏目；Headless API 用） */
export async function getPublishedContentById(siteId: number, id: number): Promise<ResolvedCmsContentRow | null> {
  const [row] = await db.select().from(cmsContents)
    .where(and(publishedWhere(siteId), eq(cmsContents.id, id)))
    .limit(1);
  return row ? resolveCmsContentRow(row) : null;
}

/**
 * 取内容的正文/扩展字段原始值（映射内容透传来源行），**保留 `cms-res://` 句柄**。
 *
 * 站群分发等「内容到内容」的复制场景要用这个：保留句柄意味着跨站引用仍被引用索引记录，
 * 来源站点删除素材时会被删除保护拦下；若写入解析后的绝对 URL，目标站的引用关系就断了。
 */
export async function getContentBodyExtendRaw(
  row: Pick<CmsContentRow, 'body' | 'extend' | 'mappingSourceId'>,
): Promise<{ body: string | null; extend: Record<string, unknown> }> {
  if (!row.mappingSourceId) return { body: row.body ?? null, extend: row.extend ?? {} };
  const [src] = await db.select({ body: cmsContents.body, extend: cmsContents.extend })
    .from(cmsContents).where(and(
      eq(cmsContents.id, row.mappingSourceId),
    )).limit(1);
  return { body: src?.body ?? null, extend: src?.extend ?? {} };
}

/**
 * 解析内容正文/扩展字段（映射内容透传来源行）：
 * 前台详情渲染、草稿预览、Headless API 输出正文前统一经过此函数。
 *
 * 输出同时完成素材句柄 → URL 的解析，调用方拿到的即是可直接渲染的正文。
 */
export async function resolveContentBodyExtend(row: Pick<CmsContentRow, 'body' | 'extend' | 'mappingSourceId'>): Promise<{ body: string | null; extend: Record<string, unknown> }> {
  const raw = await getContentBodyExtendRaw(row);
  const [resolved] = await resolveCmsContentRows([{ coverImage: null, body: raw.body, extend: raw.extend }]);
  return { body: resolved.body ?? null, extend: (resolved.extend ?? {}) as Record<string, unknown> };
}

/** 上一篇 / 下一篇（同栏目按发布时间序；跳过归档内容） */
export async function getAdjacentContents(row: CmsContentRow) {
  const base = and(publishedWhere(row.siteId), isNull(cmsContents.archivedAt), eq(cmsContents.channelId, row.channelId), ne(cmsContents.id, row.id))!;
  const anchor = row.publishedAt ?? row.createdAt;
  const [prevRows, nextRows] = await Promise.all([
    db.select().from(cmsContents).where(and(base, lt(cmsContents.publishedAt, anchor))).orderBy(desc(cmsContents.publishedAt)).limit(1),
    db.select().from(cmsContents).where(and(base, gt(cmsContents.publishedAt, anchor))).orderBy(asc(cmsContents.publishedAt)).limit(1),
  ]);
  return { prev: prevRows[0] ? await resolveCmsContentRow(prevRows[0]) : null, next: nextRows[0] ? await resolveCmsContentRow(nextRows[0]) : null };
}

/**
 * 浏览计数：Redis 缓冲累加（zenith:cms:viewbuf hash），周期任务批量落库，
 * 避免高并发下逐次 UPDATE 行锁排队；Redis 不可用时降级直写 DB。
 */
const VIEW_BUFFER_KEY = `${config.redis.keyPrefix}cms:viewbuf`;

export async function increaseViewCount(id: number): Promise<void> {
  try {
    await redis.hincrby(VIEW_BUFFER_KEY, String(id), 1);
  } catch {
    await db.update(cmsContents)
      .set({ viewCount: sql`${cmsContents.viewCount} + 1` })
      .where(eq(cmsContents.id, id));
  }
}

/** 浏览计数落库（系统周期任务调用，每分钟）：取走缓冲并批量累加 */
export async function flushViewCountBuffer(): Promise<number> {
  const buffer = await redis.hgetall(VIEW_BUFFER_KEY).catch(() => ({} as Record<string, string>));
  const entries = Object.entries(buffer).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return 0;
  await redis.del(VIEW_BUFFER_KEY).catch(() => undefined);
  for (const [idText, countText] of entries) {
    const id = Number(idText);
    const count = Number(countText);
    if (!Number.isInteger(id) || !Number.isInteger(count) || count <= 0) continue;
    await db.update(cmsContents)
      .set({ viewCount: sql`${cmsContents.viewCount} + ${count}` })
      .where(eq(cmsContents.id, id));
  }
  return entries.length;
}

/** 内容标签（前台详情页展示） */
export async function listContentTags(contentId: number): Promise<CmsTagRow[]> {
  const rows = await db.query.cmsContentTags.findMany({
    where: eq(cmsContentTags.contentId, contentId),
    with: { tag: true },
  });
  return rows.map((r) => r.tag);
}

/** 详情页相关文章：手动关联优先（按 sort），不足 limit 时按共同标签自动补齐 */
export async function listRelatedContents(row: CmsContentRow, limit = 5): Promise<CmsContentRow[]> {
  const manualRows = await db.query.cmsContentRelations.findMany({
    where: eq(cmsContentRelations.contentId, row.id),
    with: { related: true },
    orderBy: asc(cmsContentRelations.sort),
  });
  const result = manualRows
    .map((r) => r.related)
    .filter((c): c is CmsContentRow => !!c && c.status === 'published' && !c.deletedAt && !c.archivedAt)
    .slice(0, limit);
  if (result.length < limit) {
    const tagIdsQuery = db.select({ tagId: cmsContentTags.tagId }).from(cmsContentTags).where(and(
      eq(cmsContentTags.contentId, row.id),
    ));
    const candidateIdsQuery = db.select({ contentId: cmsContentTags.contentId }).from(cmsContentTags).where(and(
      inArray(cmsContentTags.tagId, tagIdsQuery),
    ));
    const excluded = [row.id, ...result.map((c) => c.id)];
    const fill = await db.select().from(cmsContents)
      .where(and(
        publishedWhere(row.siteId),
        isNull(cmsContents.archivedAt),
        inArray(cmsContents.id, candidateIdsQuery),
        notInArray(cmsContents.id, excluded),
      ))
      .orderBy(desc(cmsContents.publishedAt), desc(cmsContents.id))
      .limit(limit - result.length);
    result.push(...fill);
  }
  return result;
}

/** 标签聚合页：按标签取已发布内容分页（归档内容不参与） */
export async function listPublishedContentsByTag(siteId: number, tagId: number, page: number, pageSize: number) {
  const idsQuery = db.select({ contentId: cmsContentTags.contentId }).from(cmsContentTags).where(and(
    eq(cmsContentTags.tagId, tagId),
  ));
  const where = and(publishedWhere(siteId), isNull(cmsContents.archivedAt), inArray(cmsContents.id, idsQuery))!;
  const [total, rows] = await Promise.all([
    db.$count(cmsContents, where),
    withPagination(
      db.select().from(cmsContents).where(where)
        .orderBy(desc(cmsContents.publishedAt), desc(cmsContents.id))
        .$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { total, rows: await resolveCmsContentRows(rows) };
}
