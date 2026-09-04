import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, gt, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { DriveNodeType, DriveRecentItem, DriveSearchItem, DriveSharedItem, DriveSubjectType } from '@zenith/shared/drive';
import { db } from '../../db';
import { driveNodePermissions, driveNodes, driveNodeStars, driveNodeTexts, driveRecentAccess, driveSpaces, type DriveNodeRow } from '../../db/schema';
import { currentUser, currentUserId } from '../../lib/context';
import { formatDateTime } from '../../lib/datetime';
import { tenantCondition } from '../../lib/tenant';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';
import { driveNodeAccessCondition, filterVisibleNodes, loadDriveSubjects, subjectPairsCondition } from './drive-access.service';
import { decorateNodes, ensureDriveNodeExists } from './drive-nodes.service';
import { ensureNodeRole } from './drive-access.service';

interface PagedQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: DriveNodeType;
}

async function spaceNameMap(rows: Array<{ spaceId: number }>): Promise<Map<number, string>> {
  const ids = [...new Set(rows.map((r) => r.spaceId))];
  if (ids.length === 0) return new Map();
  const spaces = await db.select({ id: driveSpaces.id, name: driveSpaces.name }).from(driveSpaces).where(inArray(driveSpaces.id, ids));
  return new Map(spaces.map((s) => [s.id, s.name]));
}

// ─── 收藏 ─────────────────────────────────────────────────────────────────────

export async function setDriveNodeStar(nodeId: number, starred: boolean): Promise<boolean> {
  const node = await ensureDriveNodeExists(nodeId);
  await ensureNodeRole(node, 'viewer', '没有该文件的访问权限');
  const uid = currentUserId();
  if (starred) {
    await db.insert(driveNodeStars).values({ userId: uid, nodeId }).onConflictDoNothing();
  } else {
    await db.delete(driveNodeStars).where(and(eq(driveNodeStars.userId, uid), eq(driveNodeStars.nodeId, nodeId)));
  }
  return starred;
}

export async function listStarredNodes(q: PagedQuery) {
  const { page = 1, pageSize = 20 } = q;
  const uid = currentUserId();
  const where = buildWhere(
    inArray(driveNodes.id, db.select({ id: driveNodeStars.nodeId }).from(driveNodeStars).where(eq(driveNodeStars.userId, uid))),
    isNull(driveNodes.deletedAt),
    q.type ? eq(driveNodes.type, q.type) : undefined,
    keywordCondition(q.keyword, [driveNodes.name], 'ilike'),
    tenantCondition(driveNodes, currentUser()),
  );
  const [total, rows] = await Promise.all([
    db.$count(driveNodes, where),
    withPagination(db.select().from(driveNodes).where(where).orderBy(desc(driveNodes.updatedAt), desc(driveNodes.id)).$dynamic(), page, pageSize),
  ]);
  const visible = await filterVisibleNodes(rows);
  const names = await spaceNameMap(visible);
  const list = await decorateNodes(visible, new Map(visible.map((r) => [r.id, r.myRole])));
  return { list: list.map((n) => ({ ...n, spaceName: names.get(n.spaceId) ?? '' })), total, page, pageSize };
}

// ─── 最近访问 ─────────────────────────────────────────────────────────────────

export async function listRecentNodes(q: PagedQuery) {
  const { page = 1, pageSize = 20 } = q;
  const uid = currentUserId();
  const where = buildWhere(
    eq(driveRecentAccess.userId, uid),
    isNull(driveNodes.deletedAt),
    q.type ? eq(driveNodes.type, q.type) : undefined,
    keywordCondition(q.keyword, [driveNodes.name], 'ilike'),
    tenantCondition(driveNodes, currentUser()),
  );
  const base = db.select({ node: driveNodes, lastAccessAt: driveRecentAccess.lastAccessAt, lastAction: driveRecentAccess.action })
    .from(driveRecentAccess)
    .innerJoin(driveNodes, eq(driveNodes.id, driveRecentAccess.nodeId))
    .where(where);
  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(driveRecentAccess).innerJoin(driveNodes, eq(driveNodes.id, driveRecentAccess.nodeId)).where(where),
    withPagination(base.orderBy(desc(driveRecentAccess.lastAccessAt)).$dynamic(), page, pageSize),
  ]);
  const nodeRows = rows.map((r) => r.node);
  const visible = await filterVisibleNodes(nodeRows);
  const visibleIds = new Set(visible.map((v) => v.id));
  const names = await spaceNameMap(visible);
  const decorated = await decorateNodes(visible, new Map(visible.map((r) => [r.id, r.myRole])));
  const decoratedMap = new Map(decorated.map((d) => [d.id, d]));
  const list: DriveRecentItem[] = rows
    .filter((r) => visibleIds.has(r.node.id))
    .map((r) => ({
      ...decoratedMap.get(r.node.id)!,
      spaceName: names.get(r.node.spaceId) ?? '',
      lastAccessAt: formatDateTime(r.lastAccessAt),
      lastAction: r.lastAction,
    }));
  return { list, total: countRows[0]?.count ?? 0, page, pageSize };
}

// ─── 与我共享 ─────────────────────────────────────────────────────────────────

export async function listSharedWithMe(q: PagedQuery) {
  const { page = 1, pageSize = 20 } = q;
  const subjects = await loadDriveSubjects();
  const grantWhere = and(
    subjectPairsCondition(driveNodePermissions, subjects),
    or(isNull(driveNodePermissions.expireAt), gt(driveNodePermissions.expireAt, new Date())),
  );
  const where = buildWhere(
    inArray(driveNodes.id, db.select({ id: driveNodePermissions.nodeId }).from(driveNodePermissions).where(grantWhere)),
    isNull(driveNodes.deletedAt),
    q.type ? eq(driveNodes.type, q.type) : undefined,
    keywordCondition(q.keyword, [driveNodes.name], 'ilike'),
    tenantCondition(driveNodes, currentUser()),
  );
  const [total, rows] = await Promise.all([
    db.$count(driveNodes, where),
    withPagination(db.select().from(driveNodes).where(where).orderBy(desc(driveNodes.updatedAt), desc(driveNodes.id)).$dynamic(), page, pageSize),
  ]);
  const grants = rows.length
    ? await db.select().from(driveNodePermissions).where(and(inArray(driveNodePermissions.nodeId, rows.map((r) => r.id)), grantWhere))
    : [];
  // 同一节点多条命中：直接授权给本人优先，其次角色高者
  const priority: Record<DriveSubjectType, number> = { user: 4, user_group: 3, role: 2, department: 1 };
  const grantMap = new Map<number, { via: DriveSubjectType; role: typeof grants[number]['role'] }>();
  for (const g of grants) {
    const cur = grantMap.get(g.nodeId);
    if (!cur || priority[g.subjectType] > priority[cur.via]) grantMap.set(g.nodeId, { via: g.subjectType, role: g.role });
  }
  const visible = await filterVisibleNodes(rows);
  const names = await spaceNameMap(visible);
  const decorated = await decorateNodes(visible, new Map(visible.map((r) => [r.id, r.myRole])));
  const list: DriveSharedItem[] = decorated.map((n) => ({
    ...n,
    spaceName: names.get(n.spaceId) ?? '',
    grantedVia: grantMap.get(n.id)?.via ?? 'user',
    grantedRole: grantMap.get(n.id)?.role ?? 'viewer',
  }));
  return { list, total, page, pageSize };
}

// ─── 搜索 ─────────────────────────────────────────────────────────────────────

export interface SearchDriveNodesQuery extends PagedQuery {
  spaceId?: number;
  extension?: string;
  startTime?: string;
  endTime?: string;
  /** 是否同时检索文本文件正文 */
  fullText?: boolean;
}

export async function searchDriveNodes(q: SearchDriveNodesQuery) {
  const { page = 1, pageSize = 20 } = q;
  const keyword = q.keyword?.trim();
  if (!keyword) throw new HTTPException(400, { message: '请输入搜索关键词' });
  const subjects = await loadDriveSubjects();
  const nameCondition = keywordCondition(keyword, [driveNodes.name], 'ilike');
  const textSub = db.select({ id: driveNodeTexts.nodeId }).from(driveNodeTexts)
    .where(sql`${driveNodeTexts.searchVector} @@ plainto_tsquery('simple', ${keyword})`);
  const matchCondition: SQL | undefined = q.fullText
    ? or(nameCondition!, inArray(driveNodes.id, textSub))
    : nameCondition;
  const where = buildWhere(
    matchCondition,
    isNull(driveNodes.deletedAt),
    q.spaceId !== undefined ? eq(driveNodes.spaceId, q.spaceId) : undefined,
    q.type ? eq(driveNodes.type, q.type) : undefined,
    q.extension ? eq(driveNodes.extension, q.extension.toLowerCase().replace(/^\./, '')) : undefined,
    ...dateRangeConditions(driveNodes.updatedAt, q.startTime, q.endTime),
    tenantCondition(driveNodes, currentUser()),
    driveNodeAccessCondition(subjects),
  );
  const [total, rows] = await Promise.all([
    db.$count(driveNodes, where),
    withPagination(db.select().from(driveNodes).where(where).orderBy(desc(driveNodes.updatedAt), desc(driveNodes.id)).$dynamic(), page, pageSize),
  ]);
  const visible = await filterVisibleNodes(rows);
  const names = await spaceNameMap(visible);
  const snippets = q.fullText && visible.length
    ? await db.select({
      nodeId: driveNodeTexts.nodeId,
      snippet: sql<string>`ts_headline('simple', ${driveNodeTexts.content}, plainto_tsquery('simple', ${keyword}), 'MaxFragments=2, MaxWords=24, MinWords=8')`,
    }).from(driveNodeTexts).where(and(
      inArray(driveNodeTexts.nodeId, visible.map((v) => v.id)),
      sql`${driveNodeTexts.searchVector} @@ plainto_tsquery('simple', ${keyword})`,
    ))
    : [];
  const snippetMap = new Map(snippets.map((s) => [s.nodeId, s.snippet]));
  const decorated = await decorateNodes(visible, new Map(visible.map((r) => [r.id, r.myRole])));
  const list: DriveSearchItem[] = decorated.map((n) => ({
    ...n,
    spaceName: names.get(n.spaceId) ?? '',
    snippet: snippetMap.get(n.id) ?? null,
  }));
  return { list, total, page, pageSize };
}

export type { DriveNodeRow };
