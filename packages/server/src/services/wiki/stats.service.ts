import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { UpdateWikiSettingsInput, WikiSettings, WikiSpaceVisibility } from '@zenith/shared/wiki';
import { WIKI_SETTING_KEYS } from '@zenith/shared/wiki';
import { db } from '../../db';
import { systemConfigs, users, wikiComments, wikiDocViews, wikiDocs, wikiSpaces } from '../../db/schema';
import { currentUser } from '../../lib/context';
import { formatDateTime } from '../../lib/datetime';
import { getConfigBoolean, getConfigNumber, getConfigValue } from '../../lib/system-config';
import { tenantCondition } from '../../lib/tenant';
import { buildWhere } from '../../lib/where-helpers';
import { wikiDocStatusVisibilityCondition, wikiSpaceAccessCondition } from './access';

// ─── 统计 ─────────────────────────────────────────────────────────────────────

export async function getWikiStatsOverview() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tenantDocs = tenantCondition(wikiDocs, currentUser());
  const spaceAccess = wikiSpaceAccessCondition();
  const statusVisible = wikiDocStatusVisibilityCondition();
  const notDeleted = isNull(wikiDocs.deletedAt);
  const docScope = buildWhere(notDeleted, tenantDocs, spaceAccess, statusVisible);

  // 评论与浏览量跟随文档的租户与访问边界（追加型日志表自身无 tenant_id）
  const countComments = async () => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(wikiComments)
      .innerJoin(wikiDocs, eq(wikiComments.docId, wikiDocs.id))
      .where(buildWhere(eq(wikiComments.status, 'visible'), docScope));
    return row?.count ?? 0;
  };
  const countWeekViews = async () => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(wikiDocViews)
      .innerJoin(wikiDocs, eq(wikiDocViews.docId, wikiDocs.id))
      .where(buildWhere(gte(wikiDocViews.createdAt, weekAgo), docScope));
    return row?.count ?? 0;
  };

  const [spaceCount, docCount, publishedCount, pendingCount, commentCount, weekNewDocs, weekViews] = await Promise.all([
    db.$count(wikiSpaces, tenantCondition(wikiSpaces, currentUser())),
    db.$count(wikiDocs, docScope),
    db.$count(wikiDocs, buildWhere(eq(wikiDocs.status, 'published'), docScope)),
    db.$count(wikiDocs, buildWhere(eq(wikiDocs.status, 'pending'), docScope)),
    countComments(),
    db.$count(wikiDocs, buildWhere(gte(wikiDocs.createdAt, weekAgo), docScope)),
    countWeekViews(),
  ]);

  return { spaceCount, docCount, publishedCount, pendingCount, commentCount, weekNewDocs, weekViews };
}

/** 热门文档 Top N（按浏览量） */
export async function listWikiHotDocs(limit = 10) {
  const rows = await db.select({
    id: wikiDocs.id,
    title: wikiDocs.title,
    spaceName: wikiSpaces.name,
    viewCount: wikiDocs.viewCount,
  }).from(wikiDocs)
    .innerJoin(wikiSpaces, eq(wikiDocs.spaceId, wikiSpaces.id))
    .where(buildWhere(
      isNull(wikiDocs.deletedAt),
      eq(wikiDocs.status, 'published'),
      tenantCondition(wikiDocs, currentUser()),
      wikiSpaceAccessCondition(),
    ))
    .orderBy(desc(wikiDocs.viewCount), desc(wikiDocs.id))
    .limit(limit);
  return rows;
}

/** 贡献榜 Top N（按创建文档数） */
export async function listWikiContributors(limit = 10) {
  const rows = await db.select({
    userId: wikiDocs.createdBy,
    nickname: users.nickname,
    docCount: sql<number>`count(*)::int`,
  }).from(wikiDocs)
    .innerJoin(users, eq(wikiDocs.createdBy, users.id))
    .where(buildWhere(
      isNull(wikiDocs.deletedAt),
      tenantCondition(wikiDocs, currentUser()),
      wikiSpaceAccessCondition(),
      wikiDocStatusVisibilityCondition(),
    ))
    .groupBy(wikiDocs.createdBy, users.nickname)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows
    .filter((r): r is typeof r & { userId: number } => r.userId !== null)
    .map((r) => ({ userId: r.userId, nickname: r.nickname, docCount: r.docCount }));
}

/** 沉睡文档：已发布但超过 staleDays 未更新 */
export async function listWikiStaleDocs(limit = 10, staleDays = 90) {
  const threshold = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
  const rows = await db.select({
    id: wikiDocs.id,
    title: wikiDocs.title,
    spaceName: wikiSpaces.name,
    updatedAt: wikiDocs.updatedAt,
  }).from(wikiDocs)
    .innerJoin(wikiSpaces, eq(wikiDocs.spaceId, wikiSpaces.id))
    .where(buildWhere(
      isNull(wikiDocs.deletedAt),
      eq(wikiDocs.status, 'published'),
      lt(wikiDocs.updatedAt, threshold),
      tenantCondition(wikiDocs, currentUser()),
      wikiSpaceAccessCondition(),
    ))
    .orderBy(wikiDocs.updatedAt)
    .limit(limit);
  return rows.map((r) => ({ ...r, updatedAt: formatDateTime(r.updatedAt) }));
}

// ─── 全局设置 ─────────────────────────────────────────────────────────────────

export async function getWikiSettings(): Promise<WikiSettings> {
  const [requireApproval, defaultVisibility, aiSyncEnabled, aiSyncKbId] = await Promise.all([
    getConfigBoolean(WIKI_SETTING_KEYS.requireApproval, true),
    getConfigValue(WIKI_SETTING_KEYS.defaultVisibility, 'public'),
    getConfigBoolean(WIKI_SETTING_KEYS.aiSyncEnabled, false),
    getConfigNumber(WIKI_SETTING_KEYS.aiSyncKbId, 0),
  ]);
  return {
    requireApproval,
    defaultVisibility: (defaultVisibility === 'private' ? 'private' : 'public') as WikiSpaceVisibility,
    aiSyncEnabled,
    aiSyncKbId: aiSyncKbId > 0 ? aiSyncKbId : null,
  };
}

const SETTING_META: Record<string, { name: string; type: 'string' | 'boolean' | 'number' }> = {
  [WIKI_SETTING_KEYS.requireApproval]: { name: '知识库-发布需审核', type: 'boolean' },
  [WIKI_SETTING_KEYS.defaultVisibility]: { name: '知识库-空间默认可见性', type: 'string' },
  [WIKI_SETTING_KEYS.aiSyncEnabled]: { name: '知识库-同步 AI 知识库', type: 'boolean' },
  [WIKI_SETTING_KEYS.aiSyncKbId]: { name: '知识库-AI 同步目标', type: 'number' },
};

async function upsertConfig(key: string, value: string) {
  const meta = SETTING_META[key];
  const [existing] = await db.select({ id: systemConfigs.id }).from(systemConfigs)
    .where(and(eq(systemConfigs.configKey, key), isNull(systemConfigs.tenantId)))
    .limit(1);
  if (existing) {
    await db.update(systemConfigs).set({ configValue: value }).where(eq(systemConfigs.id, existing.id));
  } else {
    await db.insert(systemConfigs).values({
      configKey: key,
      configName: meta.name,
      configValue: value,
      configType: meta.type,
      description: meta.name,
      tenantId: null,
    });
  }
}

export async function updateWikiSettings(data: UpdateWikiSettingsInput): Promise<WikiSettings> {
  await upsertConfig(WIKI_SETTING_KEYS.requireApproval, String(data.requireApproval));
  await upsertConfig(WIKI_SETTING_KEYS.defaultVisibility, data.defaultVisibility);
  await upsertConfig(WIKI_SETTING_KEYS.aiSyncEnabled, String(data.aiSyncEnabled));
  await upsertConfig(WIKI_SETTING_KEYS.aiSyncKbId, String(data.aiSyncKbId ?? 0));
  return getWikiSettings();
}
