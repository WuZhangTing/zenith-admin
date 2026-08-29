/**
 * 会话回放服务：分片 ingest（首分片 upsert 会话）、列表/详情查询、
 * 分片拉流、僵尸会话收尾与保留清理。
 *
 * 设计要点：
 * - 回放会话 ID 由客户端生成（UUID），(replayId, seq) 唯一 → 分片重传幂等；
 * - 分片二进制（rrweb events JSON.gz）bytea 直存，删除与元数据事务一致；
 * - startedAt/fromTs/toTs 为客户端时钟（与 rrweb 事件时间戳同源），
 *   lastActivityAt 为服务端时钟（僵尸收尾判定不信任客户端）。
 */
import { and, eq, desc, sql, inArray, lt, gte } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { replaySessions, replaySegments, errorEvents } from '../../db/schema';
import type { ReplaySessionRow, ReplaySegmentRow } from '../../db/schema';
import type { ReplaySegmentMetaInput } from '@zenith/shared/analytics';
import { currentUserOrNull } from '../../lib/context';
import { currentMemberOrNull } from '../../lib/member-context';
import { tenantScope, getCreateTenantId } from '../../lib/tenant';
import { mergeWhere } from '../../lib/where-helpers';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { pageOffset } from '../../lib/pagination';
import { parseClientEnv, resolveIngestPlatformFields } from '../../lib/analytics-helpers';
import { isSiteOriginAllowed, resolveSiteByKey } from './analytics-sites.service';

/** 单分片 gz 上限（防滥用；rrweb 10s 分片 gz 后通常 <200KB） */
export const REPLAY_SEGMENT_MAX_BYTES = 2 * 1024 * 1024;
/** 单会话分片数上限（10s/片 ≈ 100 分钟） */
const REPLAY_MAX_SEGMENTS = 600;
/** recording 会话无活动超时（服务端收尾判定） */
const REPLAY_STALE_MINUTES = 10;

export interface ReplayReqCtx { ua: string; siteKey?: string | null; origin?: string | null }

export function mapReplaySession(row: ReplaySessionRow) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    mode: row.mode,
    status: row.status,
    triggers: row.triggers ?? [],
    startedAt: formatDateTime(row.startedAt),
    lastActivityAt: formatDateTime(row.lastActivityAt),
    endedAt: formatNullableDateTime(row.endedAt),
    durationMs: row.durationMs,
    segmentCount: row.segmentCount,
    totalBytes: row.totalBytes,
    errorCount: row.errorCount,
    pageCount: row.pageCount,
    clickCount: row.clickCount,
    entryPageUrl: row.entryPageUrl,
    source: row.source,
    appId: row.appId,
    environment: row.environment,
    userId: row.userId,
    username: row.username,
    memberId: row.memberId,
    browser: row.browser,
    os: row.os,
    deviceType: row.deviceType,
    sdkVersion: row.sdkVersion,
    createdAt: formatDateTime(row.createdAt),
  };
}

function mapSegmentMeta(row: Omit<ReplaySegmentRow, 'data'>) {
  return {
    id: row.id,
    replayId: row.replayId,
    seq: row.seq,
    fromTs: formatDateTime(row.fromTs),
    toTs: formatDateTime(row.toTs),
    byteSize: row.byteSize,
    eventCount: row.eventCount,
    hasFullSnapshot: row.hasFullSnapshot,
  };
}

// ─── ingest ──────────────────────────────────────────────────────────────────
/**
 * 接收一个回放分片：首分片 upsert 会话行，后续分片累加聚合。
 * 幂等：(replayId, seq) 冲突时丢弃重复分片（不重复累加聚合）。
 */
export async function ingestReplaySegment(meta: ReplaySegmentMetaInput, data: Buffer, reqCtx: ReplayReqCtx): Promise<void> {
  if (data.byteLength === 0) throw new HTTPException(400, { message: '分片数据为空' });
  if (data.byteLength > REPLAY_SEGMENT_MAX_BYTES) throw new HTTPException(400, { message: '分片超出大小上限' });
  if (meta.toTs < meta.fromTs) throw new HTTPException(400, { message: '分片时间范围非法' });

  const user = currentUserOrNull();
  const member = user ? undefined : currentMemberOrNull();
  // 匿名上报凭 site key 归属租户（与错误上报同一规则）
  const site = (!user && !member) ? await resolveSiteByKey(reqCtx.siteKey).catch(() => null) : null;
  if (site && !isSiteOriginAllowed(reqCtx.origin, site.allowedOrigins)) return;
  const tenantId = user ? getCreateTenantId(user) : member ? (member.tenantId ?? null) : (site?.tenantId ?? null);
  const env = parseClientEnv(reqCtx.ua);
  const platform = resolveIngestPlatformFields(meta, { hasAdmin: !!user, hasMember: !!member });
  if (!user && !member && site) platform.appId = site.appId;

  const startedAt = new Date(meta.startedAt);
  const fromTs = new Date(meta.fromTs);
  const toTs = new Date(meta.toTs);
  const durationMs = Math.max(0, meta.toTs - meta.startedAt);

  await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(replaySessions)
      .values({
        id: meta.replayId,
        tenantId,
        sessionId: meta.sessionId,
        mode: meta.mode,
        status: meta.final ? 'completed' : 'recording',
        triggers: meta.triggers,
        startedAt,
        endedAt: meta.final ? toTs : null,
        durationMs,
        entryPageUrl: meta.entryPageUrl?.slice(0, 512) ?? null,
        source: platform.source,
        appId: platform.appId,
        environment: platform.environment,
        userId: user?.userId ?? null,
        username: user?.username ?? null,
        memberId: member?.memberId ?? null,
        browser: env.browser,
        os: env.os,
        deviceType: env.deviceType,
        sdkVersion: meta.sdkVersion ?? null,
      })
      .onConflictDoUpdate({
        target: replaySessions.id,
        set: {
          // triggers 全量覆盖：SDK 侧维护累积数组，后到分片携带最全集合
          triggers: meta.triggers,
          ...(meta.final ? { status: 'completed' as const, endedAt: toTs } : {}),
          durationMs: sql`GREATEST(${replaySessions.durationMs}, ${durationMs})`,
          lastActivityAt: new Date(),
        },
      })
      .returning({ id: replaySessions.id, segmentCount: replaySessions.segmentCount });
    if (!session) return;
    if (session.segmentCount >= REPLAY_MAX_SEGMENTS) throw new HTTPException(400, { message: '回放分片数已达上限' });

    const inserted = await tx
      .insert(replaySegments)
      .values({
        replayId: meta.replayId,
        seq: meta.seq,
        data,
        fromTs,
        toTs,
        byteSize: data.byteLength,
        eventCount: meta.eventCount,
        hasFullSnapshot: meta.hasFullSnapshot,
      })
      .onConflictDoNothing()
      .returning({ id: replaySegments.id });

    // 重复分片（重传）：跳过聚合累加
    if (inserted.length > 0) {
      await tx
        .update(replaySessions)
        .set({
          segmentCount: sql`${replaySessions.segmentCount} + 1`,
          totalBytes: sql`${replaySessions.totalBytes} + ${data.byteLength}`,
          pageCount: sql`${replaySessions.pageCount} + ${meta.pageCount}`,
          clickCount: sql`${replaySessions.clickCount} + ${meta.clickCount}`,
        })
        .where(eq(replaySessions.id, meta.replayId));
    }
  });
}

/** 错误上报到达时回填回放会话的错误计数（错误服务调用） */
export async function bumpReplayErrorCount(replayId: string): Promise<void> {
  await db
    .update(replaySessions)
    .set({ errorCount: sql`${replaySessions.errorCount} + 1` })
    .where(eq(replaySessions.id, replayId));
}

// ─── 查询 ─────────────────────────────────────────────────────────────────────
export interface ReplayListQuery {
  page: number;
  pageSize: number;
  status?: string;
  mode?: string;
  triggerType?: string;
  keyword?: string;
  hasError?: boolean;
  source?: string;
}

export async function listReplaySessions(query: ReplayListQuery) {
  const conditions = [
    query.status ? eq(replaySessions.status, query.status as ReplaySessionRow['status']) : undefined,
    query.mode ? eq(replaySessions.mode, query.mode as ReplaySessionRow['mode']) : undefined,
    query.source ? eq(replaySessions.source, query.source as ReplaySessionRow['source']) : undefined,
    query.hasError ? gte(replaySessions.errorCount, 1) : undefined,
    // triggers jsonb 数组按类型匹配（@> 走 GIN 语义，量级可控走 seq scan 亦可）
    query.triggerType ? sql`${replaySessions.triggers} @> ${JSON.stringify([{ type: query.triggerType }])}::jsonb` : undefined,
    query.keyword
      ? sql`(${replaySessions.username} ILIKE ${`%${query.keyword}%`} OR ${replaySessions.entryPageUrl} ILIKE ${`%${query.keyword}%`} OR ${replaySessions.id} = ${query.keyword} OR ${replaySessions.sessionId} = ${query.keyword})`
      : undefined,
  ];
  const where = mergeWhere(tenantScope(replaySessions), and(...conditions.filter(Boolean)));

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(replaySessions).where(where)
      .orderBy(desc(replaySessions.startedAt))
      .limit(query.pageSize).offset(pageOffset(query.page, query.pageSize)),
    db.select({ total: sql<number>`count(*)::int` }).from(replaySessions).where(where),
  ]);
  return { list: rows.map(mapReplaySession), total, page: query.page, pageSize: query.pageSize };
}

export async function getReplaySessionDetail(id: string) {
  const where = mergeWhere(tenantScope(replaySessions), eq(replaySessions.id, id));
  const [row] = await db.select().from(replaySessions).where(where).limit(1);
  if (!row) throw new HTTPException(404, { message: '回放会话不存在' });

  const [segments, errors] = await Promise.all([
    db.select({
      id: replaySegments.id,
      replayId: replaySegments.replayId,
      seq: replaySegments.seq,
      fromTs: replaySegments.fromTs,
      toTs: replaySegments.toTs,
      byteSize: replaySegments.byteSize,
      eventCount: replaySegments.eventCount,
      hasFullSnapshot: replaySegments.hasFullSnapshot,
      createdAt: replaySegments.createdAt,
    }).from(replaySegments)
      .where(eq(replaySegments.replayId, id))
      .orderBy(replaySegments.seq),
    db.select({
      id: errorEvents.id,
      groupId: errorEvents.groupId,
      errorType: errorEvents.errorType,
      level: errorEvents.level,
      message: errorEvents.message,
      createdAt: errorEvents.createdAt,
    }).from(errorEvents)
      .where(eq(errorEvents.replayId, id))
      .orderBy(errorEvents.createdAt)
      .limit(100),
  ]);

  return {
    ...mapReplaySession(row),
    segments: segments.map(mapSegmentMeta),
    errors: errors.map((e) => ({ ...e, createdAt: formatDateTime(e.createdAt) })),
  };
}

/** 拉取分片二进制（gzip JSON，路由以 Content-Encoding: gzip 透传，浏览器自动解压） */
export async function getReplaySegmentData(replayId: string, seq: number): Promise<Buffer> {
  const where = mergeWhere(tenantScope(replaySessions), eq(replaySessions.id, replayId));
  const [session] = await db.select({ id: replaySessions.id }).from(replaySessions).where(where).limit(1);
  if (!session) throw new HTTPException(404, { message: '回放会话不存在' });
  const [segment] = await db
    .select({ data: replaySegments.data })
    .from(replaySegments)
    .where(and(eq(replaySegments.replayId, replayId), eq(replaySegments.seq, seq)))
    .limit(1);
  if (!segment) throw new HTTPException(404, { message: '回放分片不存在' });
  return segment.data;
}

export async function deleteReplaySessions(ids: string[]): Promise<number> {
  const where = mergeWhere(tenantScope(replaySessions), inArray(replaySessions.id, ids));
  const deleted = await db.delete(replaySessions).where(where).returning({ id: replaySessions.id });
  return deleted.length;
}

// ─── 运维 ─────────────────────────────────────────────────────────────────────
/** 收尾僵尸会话：recording 且超过阈值无新分片 → expired（endedAt 取最后分片时间） */
export async function finalizeStaleReplays(): Promise<number> {
  const cutoff = new Date(Date.now() - REPLAY_STALE_MINUTES * 60_000);
  const stale = await db
    .update(replaySessions)
    .set({
      status: 'expired',
      endedAt: sql`COALESCE((SELECT MAX(${replaySegments.toTs}) FROM ${replaySegments} WHERE ${replaySegments.replayId} = ${replaySessions.id}), ${replaySessions.lastActivityAt})`,
    })
    .where(and(eq(replaySessions.status, 'recording'), lt(replaySessions.lastActivityAt, cutoff)))
    .returning({ id: replaySessions.id });
  return stale.length;
}
