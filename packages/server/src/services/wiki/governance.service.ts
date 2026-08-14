import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import type { ImportWikiDocsInput, WikiGovernanceKind } from '@zenith/shared/wiki';
import { WIKI_SETTING_KEYS } from '@zenith/shared/wiki';
import { db } from '../../db';
import {
  businessFiles, users, wikiDocVersions, wikiDocs, wikiReviewRecords, wikiSearchLogs, wikiSpaces,
} from '../../db/schema';
import { currentUser, currentUserId } from '../../lib/context';
import { formatDateTime, parseDateTimeInput } from '../../lib/datetime';
import logger from '../../lib/logger';
import { getConfigNumber } from '../../lib/system-config';
import { getCreateTenantId, tenantCondition } from '../../lib/tenant';
import { buildWhere, withPagination } from '../../lib/where-helpers';
import { sendSystemInApp } from '../messaging/in-app-messages.service';
import { wikiSpaceAccessCondition } from './access';
import { ensureSpaceRole } from './spaces.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 180;
const DRAFT_BACKLOG_DAYS = 30;
const REVIEW_BACKLOG_DAYS = 7;

// ─── 治理清单 ─────────────────────────────────────────────────────────────────

function governanceKindCondition(kind: WikiGovernanceKind) {
  const now = new Date();
  switch (kind) {
    case 'expired':
      return buildWhere(eq(wikiDocs.isArchived, false), isNotNull(wikiDocs.expireAt), lte(wikiDocs.expireAt, now));
    case 'review-due':
      return buildWhere(eq(wikiDocs.isArchived, false), isNotNull(wikiDocs.nextReviewAt), lte(wikiDocs.nextReviewAt, now));
    case 'stale':
      return buildWhere(
        eq(wikiDocs.isArchived, false),
        eq(wikiDocs.status, 'published'),
        lt(wikiDocs.updatedAt, new Date(Date.now() - STALE_DAYS * DAY_MS)),
      );
    case 'no-owner':
      return buildWhere(eq(wikiDocs.isArchived, false), isNull(wikiDocs.ownerId));
    case 'draft-backlog':
      return buildWhere(
        eq(wikiDocs.isArchived, false),
        eq(wikiDocs.status, 'draft'),
        lt(wikiDocs.updatedAt, new Date(Date.now() - DRAFT_BACKLOG_DAYS * DAY_MS)),
      );
    case 'review-backlog':
      return buildWhere(
        eq(wikiDocs.isArchived, false),
        eq(wikiDocs.status, 'pending'),
        lt(wikiDocs.updatedAt, new Date(Date.now() - REVIEW_BACKLOG_DAYS * DAY_MS)),
      );
    case 'archived':
      return eq(wikiDocs.isArchived, true);
  }
}

function governanceScope() {
  return buildWhere(
    isNull(wikiDocs.deletedAt),
    tenantCondition(wikiDocs, currentUser()),
    wikiSpaceAccessCondition(),
  );
}

export async function listGovernanceDocs(kind: WikiGovernanceKind, q: { page?: number; pageSize?: number }) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildWhere(governanceScope(), governanceKindCondition(kind));

  const [total, rows] = await Promise.all([
    db.$count(wikiDocs, where),
    withPagination(
      db.select({
        doc: wikiDocs,
        spaceName: wikiSpaces.name,
        ownerName: users.nickname,
      }).from(wikiDocs)
        .innerJoin(wikiSpaces, eq(wikiDocs.spaceId, wikiSpaces.id))
        .leftJoin(users, eq(wikiDocs.ownerId, users.id))
        .where(where)
        .orderBy(wikiDocs.updatedAt).$dynamic(),
      page,
      pageSize,
    ),
  ]);

  return {
    list: rows.map((r) => ({
      id: r.doc.id,
      spaceId: r.doc.spaceId,
      spaceName: r.spaceName,
      title: r.doc.title,
      status: r.doc.status,
      ownerId: r.doc.ownerId ?? null,
      ownerName: r.ownerName ?? null,
      expireAt: r.doc.expireAt ? formatDateTime(r.doc.expireAt) : null,
      reviewCycleDays: r.doc.reviewCycleDays ?? null,
      nextReviewAt: r.doc.nextReviewAt ? formatDateTime(r.doc.nextReviewAt) : null,
      isArchived: r.doc.isArchived,
      updatedAt: formatDateTime(r.doc.updatedAt),
    })),
    total,
    page,
    pageSize,
  };
}

/** 无结果搜索关键词（近 30 天，知识缺口） */
export async function listNoResultKeywords(limit = 20) {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await db.select({
    keyword: wikiSearchLogs.keyword,
    searchCount: sql<number>`count(*)::int`,
    lastSearchedAt: sql<string>`max(${wikiSearchLogs.createdAt})`,
  }).from(wikiSearchLogs)
    .where(buildWhere(
      eq(wikiSearchLogs.resultCount, 0),
      gte(wikiSearchLogs.createdAt, since),
      tenantCondition(wikiSearchLogs, currentUser()),
    ))
    .groupBy(wikiSearchLogs.keyword)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => ({ ...r, lastSearchedAt: formatDateTime(new Date(r.lastSearchedAt)) }));
}

// ─── 批量操作 ─────────────────────────────────────────────────────────────────

/** 治理批量操作的行级边界：只允许操作当前租户+可访问空间内的未删除文档 */
async function pickGovernedIds(ids: number[]): Promise<number[]> {
  const rows = await db.select({ id: wikiDocs.id }).from(wikiDocs)
    .where(buildWhere(inArray(wikiDocs.id, ids), governanceScope()));
  return rows.map((r) => r.id);
}

/** 批量提醒负责人（无负责人时提醒作者） */
export async function remindGovernanceOwners(ids: number[]) {
  const governed = await pickGovernedIds(ids);
  if (governed.length === 0) return 0;
  const rows = await db.select({
    id: wikiDocs.id,
    title: wikiDocs.title,
    tenantId: wikiDocs.tenantId,
    targetId: sql<number | null>`coalesce(${wikiDocs.ownerId}, ${wikiDocs.createdBy})`,
  }).from(wikiDocs).where(inArray(wikiDocs.id, governed));

  let sent = 0;
  for (const row of rows) {
    if (row.targetId === null) continue;
    await sendSystemInApp({
      userIds: [row.targetId],
      title: '知识文档待维护提醒',
      content: `你负责的文档《${row.title}》需要复核更新，请前往知识中心处理。`,
      type: 'warning',
      tenantId: row.tenantId ?? null,
    });
    sent += 1;
  }
  return sent;
}

export async function archiveGovernanceDocs(ids: number[], archived: boolean) {
  const governed = await pickGovernedIds(ids);
  if (governed.length === 0) return 0;
  const updated = await db.update(wikiDocs).set({ isArchived: archived })
    .where(inArray(wikiDocs.id, governed))
    .returning({ id: wikiDocs.id });
  return updated.length;
}

export async function setGovernanceOwner(ids: number[], ownerId: number) {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).limit(1);
  if (!owner) throw new HTTPException(400, { message: '指定的负责人不存在' });
  const governed = await pickGovernedIds(ids);
  if (governed.length === 0) return 0;
  const updated = await db.update(wikiDocs).set({ ownerId })
    .where(inArray(wikiDocs.id, governed))
    .returning({ id: wikiDocs.id });
  return updated.length;
}

export async function setGovernanceReview(ids: number[], reviewCycleDays: number, expireAt?: string | null) {
  const governed = await pickGovernedIds(ids);
  if (governed.length === 0) return 0;
  const nextReviewAt = new Date(Date.now() + reviewCycleDays * DAY_MS);
  const updated = await db.update(wikiDocs).set({
    reviewCycleDays,
    nextReviewAt,
    ...(expireAt !== undefined ? { expireAt: expireAt === null ? null : parseDateTimeInput(expireAt) } : {}),
  }).where(inArray(wikiDocs.id, governed)).returning({ id: wikiDocs.id });
  return updated.length;
}

// ─── Markdown 导入 ────────────────────────────────────────────────────────────

/** 批量导入 Markdown 文件为草稿（标题取首个 # 标题，否则取文件名） */
export async function importWikiDocs(data: ImportWikiDocsInput) {
  await ensureSpaceRole(data.spaceId, 'editor');
  if (data.parentId) {
    const [parent] = await db.select({ id: wikiDocs.id, spaceId: wikiDocs.spaceId }).from(wikiDocs)
      .where(buildWhere(eq(wikiDocs.id, data.parentId), isNull(wikiDocs.deletedAt)));
    if (!parent || parent.spaceId !== data.spaceId) {
      throw new HTTPException(400, { message: '父文档不存在或不在同一空间' });
    }
  }

  const created: number[] = [];
  await db.transaction(async (tx) => {
    for (const file of data.files) {
      const headingMatch = /^#\s+(.+)$/m.exec(file.content);
      const title = (headingMatch?.[1] ?? file.name.replace(/\.(md|markdown|txt|html?)$/i, '')).trim().slice(0, 200);
      const [doc] = await tx.insert(wikiDocs).values({
        spaceId: data.spaceId,
        parentId: data.parentId ?? null,
        title: title || file.name.slice(0, 200),
        content: file.content,
        ownerId: currentUserId(),
        tenantId: getCreateTenantId(currentUser()),
      }).returning({ id: wikiDocs.id, title: wikiDocs.title, content: wikiDocs.content });
      await tx.insert(wikiDocVersions).values({
        docId: doc.id, version: 1, title: doc.title, content: doc.content, changeNote: '批量导入', authorId: currentUserId(),
      });
      created.push(doc.id);
    }
  });
  return { importedCount: created.length, docIds: created };
}

// ─── 运营统计（知识统计页扩展）────────────────────────────────────────────────

export async function getWikiOpsStats() {
  const since30d = new Date(Date.now() - 30 * DAY_MS);
  const scope = governanceScope();
  const tenantLogs = tenantCondition(wikiSearchLogs, currentUser());

  const [trendRows, spaceRows, searchCount30d, noResultCount30d, approvedCount30d, rejectedCount30d,
    pendingBacklog, expiredCount, reviewDueCount, noOwnerCount, archivedCount] = await Promise.all([
    db.select({
      date: sql<string>`to_char(${wikiDocs.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    }).from(wikiDocs)
      .where(buildWhere(gte(wikiDocs.createdAt, since30d), scope))
      .groupBy(sql`to_char(${wikiDocs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${wikiDocs.createdAt}, 'YYYY-MM-DD')`),
    db.select({
      spaceName: wikiSpaces.name,
      count: sql<number>`count(*)::int`,
    }).from(wikiDocs)
      .innerJoin(wikiSpaces, eq(wikiDocs.spaceId, wikiSpaces.id))
      .where(scope)
      .groupBy(wikiSpaces.name)
      .orderBy(desc(sql`count(*)`)),
    db.$count(wikiSearchLogs, buildWhere(gte(wikiSearchLogs.createdAt, since30d), tenantLogs)),
    db.$count(wikiSearchLogs, buildWhere(gte(wikiSearchLogs.createdAt, since30d), eq(wikiSearchLogs.resultCount, 0), tenantLogs)),
    db.$count(wikiReviewRecords, and(gte(wikiReviewRecords.createdAt, since30d), eq(wikiReviewRecords.action, 'approve'))),
    db.$count(wikiReviewRecords, and(gte(wikiReviewRecords.createdAt, since30d), eq(wikiReviewRecords.action, 'reject'))),
    db.$count(wikiDocs, buildWhere(eq(wikiDocs.status, 'pending'), scope)),
    db.$count(wikiDocs, buildWhere(scope, governanceKindCondition('expired'))),
    db.$count(wikiDocs, buildWhere(scope, governanceKindCondition('review-due'))),
    db.$count(wikiDocs, buildWhere(scope, governanceKindCondition('no-owner'))),
    db.$count(wikiDocs, buildWhere(scope, governanceKindCondition('archived'))),
  ]);

  return {
    createdTrend: trendRows,
    spaceDistribution: spaceRows,
    searchCount30d,
    noResultCount30d,
    approvedCount30d,
    rejectedCount30d,
    pendingBacklog,
    expiredCount,
    reviewDueCount,
    noOwnerCount,
    archivedCount,
  };
}

// ─── 定时任务（system-tasks.registry 注册）───────────────────────────────────

/**
 * 每日治理扫描：
 * 1) 过期 / 到期复审文档提醒负责人（dedupeKey 按天去重）
 * 2) 回收站超期彻底清理（wiki.recycleRetentionDays，0 = 不清理）
 */
export async function runWikiGovernanceTick(): Promise<string> {
  const now = new Date();
  const today = formatDateTime(now).slice(0, 10);

  // 1) 到期提醒（全租户扫描，通知按文档租户投递）
  const dueDocs = await db.select({
    id: wikiDocs.id,
    title: wikiDocs.title,
    tenantId: wikiDocs.tenantId,
    targetId: sql<number | null>`coalesce(${wikiDocs.ownerId}, ${wikiDocs.createdBy})`,
    expired: sql<boolean>`(${wikiDocs.expireAt} is not null and ${wikiDocs.expireAt} <= now())`,
  }).from(wikiDocs)
    .where(buildWhere(
      isNull(wikiDocs.deletedAt),
      eq(wikiDocs.isArchived, false),
      sql`((${wikiDocs.expireAt} is not null and ${wikiDocs.expireAt} <= now())
        or (${wikiDocs.nextReviewAt} is not null and ${wikiDocs.nextReviewAt} <= now()))`,
    ));

  let reminded = 0;
  for (const doc of dueDocs) {
    if (doc.targetId === null) continue;
    const { sentCount } = await sendSystemInApp({
      userIds: [doc.targetId],
      title: doc.expired ? '知识文档已过有效期' : '知识文档复审到期',
      content: `文档《${doc.title}》${doc.expired ? '已过有效期' : '复审时间已到'}，请前往知识中心更新或归档。`,
      type: 'warning',
      tenantId: doc.tenantId ?? null,
      dedupeKey: `wiki-governance:${doc.id}:${today}`,
    });
    reminded += sentCount;
  }

  // 2) 回收站超期清理（平台级设置）
  let purged = 0;
  try {
    const retentionDays = await getConfigNumber(WIKI_SETTING_KEYS.recycleRetentionDays, 0);
    if (retentionDays > 0) {
      const threshold = new Date(Date.now() - retentionDays * DAY_MS);
      const expired = await db.select({ id: wikiDocs.id }).from(wikiDocs)
        .where(and(isNotNull(wikiDocs.deletedAt), lt(wikiDocs.deletedAt, threshold)));
      if (expired.length > 0) {
        const ids = expired.map((r) => r.id);
        await db.transaction(async (tx) => {
          await tx.delete(businessFiles)
            .where(and(eq(businessFiles.businessType, 'wiki_doc'), inArray(businessFiles.businessId, ids)));
          await tx.delete(wikiDocs).where(inArray(wikiDocs.id, ids));
        });
        purged = ids.length;
      }
    }
  } catch (err) {
    logger.warn('[wiki] 回收站超期清理失败', err);
  }

  return `提醒 ${reminded} 人，清理回收站 ${purged} 篇`;
}
