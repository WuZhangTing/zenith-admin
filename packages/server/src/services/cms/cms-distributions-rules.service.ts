import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { createCmsDistributionRuleSchema } from '@zenith/shared/cms';
import type { CmsDistributionFilters, CmsDistributionMode, CreateCmsDistributionRuleInput, UpdateCmsDistributionRuleInput } from '@zenith/shared/cms';
import { db } from '../../db';
import {
  cmsContents,
  cmsDistributionRules,
  type CmsDistributionRuleRow,
} from '../../db/schema';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { pageOffset } from '../../lib/pagination';
import { escapeLike } from '../../lib/where-helpers';
import {
  assertChannelAccess,
  ensureCmsChannelExists,
} from './cms-channels.service';
import {
  assertSiteAccess,
  ensureCmsSiteExists,
  getAccessibleSiteIds,
} from './cms-sites.service';
import { assertCmsDistributionScope } from './cms-distribution-policy';
import { ensureRuleAccessible, nextSchedule, normalizedFilters } from './cms-distributions-shared';

async function validateRuleScope(input: {
  sourceSiteId: number;
  sourceChannelId: number | null;
  targetSiteId: number;
  targetChannelId: number;
  mode: CmsDistributionMode;
  scheduleCron: string | null;
  filters: CmsDistributionFilters;
}) {
  assertCmsDistributionScope(input);
  const [sourceSite, targetSite, targetChannel] = await Promise.all([
    ensureCmsSiteExists(input.sourceSiteId),
    ensureCmsSiteExists(input.targetSiteId),
    ensureCmsChannelExists(input.targetChannelId),
  ]);
  await assertSiteAccess(sourceSite.id);
  await assertSiteAccess(targetSite.id);
  await assertChannelAccess(targetChannel.id);
  if (sourceSite.status !== 'enabled' || targetSite.status !== 'enabled') {
    throw new HTTPException(400, { message: '来源站点与目标站点必须均为启用状态' });
  }
  if (targetChannel.siteId !== targetSite.id) {
    throw new HTTPException(400, { message: '目标栏目不属于目标站点' });
  }
  if (input.sourceChannelId != null) {
    const sourceChannel = await ensureCmsChannelExists(input.sourceChannelId);
    await assertChannelAccess(sourceChannel.id);
    if (sourceChannel.siteId !== sourceSite.id) {
      throw new HTTPException(400, { message: '来源栏目不属于来源站点' });
    }
  }
}

function mapRule(row: CmsDistributionRuleRow & {
  sourceSite: { name: string };
  sourceChannel?: { name: string } | null;
  targetSite: { name: string };
  targetChannel: { name: string };
}) {
  return {
    id: row.id,
    name: row.name,
    sourceSiteId: row.sourceSiteId,
    sourceSiteName: row.sourceSite.name,
    sourceChannelId: row.sourceChannelId ?? null,
    sourceChannelName: row.sourceChannel?.name ?? null,
    targetSiteId: row.targetSiteId,
    targetSiteName: row.targetSite.name,
    targetChannelId: row.targetChannelId,
    targetChannelName: row.targetChannel.name,
    mode: row.mode,
    conflictStrategy: row.conflictStrategy,
    filters: normalizedFilters(row.filters),
    scheduleCron: row.scheduleCron ?? null,
    nextRunAt: formatNullableDateTime(row.nextRunAt),
    lastRunAt: formatNullableDateTime(row.lastRunAt),
    status: row.status,
    revision: row.revision,
    remark: row.remark ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

async function ruleAccessConditions(): Promise<SQL[]> {
  const accessible = await getAccessibleSiteIds();
  if (accessible === null) return [];
  if (accessible.length === 0) return [sql`false`];
  return [
    inArray(cmsDistributionRules.sourceSiteId, accessible),
    inArray(cmsDistributionRules.targetSiteId, accessible),
  ];
}

export interface ListCmsDistributionRulesQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  sourceSiteId?: number;
  targetSiteId?: number;
  mode?: CmsDistributionRuleRow['mode'];
  status?: CmsDistributionRuleRow['status'];
}

export async function listCmsDistributionRules(query: ListCmsDistributionRulesQuery) {
  const conditions = await ruleAccessConditions();
  if (query.keyword?.trim()) {
    conditions.push(ilike(cmsDistributionRules.name, `%${escapeLike(query.keyword.trim())}%`));
  }
  if (query.sourceSiteId) {
    await assertSiteAccess(query.sourceSiteId);
    conditions.push(eq(cmsDistributionRules.sourceSiteId, query.sourceSiteId));
  }
  if (query.targetSiteId) {
    await assertSiteAccess(query.targetSiteId);
    conditions.push(eq(cmsDistributionRules.targetSiteId, query.targetSiteId));
  }
  if (query.mode) conditions.push(eq(cmsDistributionRules.mode, query.mode));
  if (query.status) conditions.push(eq(cmsDistributionRules.status, query.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const [total, rows] = await Promise.all([
    db.$count(cmsDistributionRules, where),
    db.query.cmsDistributionRules.findMany({
      where,
      with: {
        sourceSite: { columns: { name: true } },
        sourceChannel: { columns: { name: true } },
        targetSite: { columns: { name: true } },
        targetChannel: { columns: { name: true } },
      },
      orderBy: [desc(cmsDistributionRules.id)],
      limit: query.pageSize,
      offset: pageOffset(query.page, query.pageSize),
    }),
  ]);
  return { list: rows.map(mapRule), total, page: query.page, pageSize: query.pageSize };
}

export async function getCmsDistributionRule(id: number) {
  return mapRule(await ensureRuleAccessible(id));
}

export async function createCmsDistributionRule(input: CreateCmsDistributionRuleInput) {
  const filters = normalizedFilters(input.filters);
  const scope = {
    sourceSiteId: input.sourceSiteId,
    sourceChannelId: input.sourceChannelId ?? null,
    targetSiteId: input.targetSiteId,
    targetChannelId: input.targetChannelId,
    mode: input.mode ?? 'copy',
    scheduleCron: input.scheduleCron ?? null,
    filters,
  };
  await validateRuleScope(scope);
  const [row] = await db.insert(cmsDistributionRules).values({
    name: input.name.trim(),
    ...scope,
    conflictStrategy: input.conflictStrategy ?? 'skip',
    nextRunAt: input.status !== 'disabled' && scope.mode === 'scheduled'
      ? nextSchedule(scope.scheduleCron)
      : null,
    status: input.status ?? 'enabled',
    remark: input.remark ?? null,
  }).returning();
  return getCmsDistributionRule(row.id);
}

export async function updateCmsDistributionRule(id: number, input: UpdateCmsDistributionRuleInput) {
  const current = await ensureRuleAccessible(id);
  if (input.mode && input.mode !== current.mode) {
    const materialized = await db.$count(cmsContents, eq(cmsContents.distributionRuleId, id));
    if (materialized > 0) {
      throw new HTTPException(409, { message: '规则已有物化内容，不能切换分发模式；请新建规则' });
    }
  }
  const merged = {
    name: input.name ?? current.name,
    sourceSiteId: input.sourceSiteId ?? current.sourceSiteId,
    sourceChannelId: input.sourceChannelId === undefined ? current.sourceChannelId : input.sourceChannelId,
    targetSiteId: input.targetSiteId ?? current.targetSiteId,
    targetChannelId: input.targetChannelId ?? current.targetChannelId,
    mode: input.mode ?? current.mode,
    conflictStrategy: input.conflictStrategy ?? current.conflictStrategy,
    filters: normalizedFilters(input.filters ?? current.filters),
    scheduleCron: input.scheduleCron === undefined ? current.scheduleCron : input.scheduleCron,
    status: input.status ?? current.status,
    remark: input.remark === undefined ? current.remark : input.remark,
  };
  const parsed = createCmsDistributionRuleSchema.safeParse(merged);
  if (!parsed.success) throw new HTTPException(400, { message: parsed.error.issues[0]?.message ?? '分发规则无效' });
  await validateRuleScope({
    sourceSiteId: merged.sourceSiteId,
    sourceChannelId: merged.sourceChannelId,
    targetSiteId: merged.targetSiteId,
    targetChannelId: merged.targetChannelId,
    mode: merged.mode,
    scheduleCron: merged.scheduleCron,
    filters: merged.filters,
  });
  const [updated] = await db.update(cmsDistributionRules).set({
    ...merged,
    nextRunAt: merged.status === 'enabled' && merged.mode === 'scheduled'
      ? nextSchedule(merged.scheduleCron)
      : null,
    revision: sql`${cmsDistributionRules.revision} + 1`,
  }).where(eq(cmsDistributionRules.id, id)).returning();
  if (!updated) throw new HTTPException(404, { message: '分发规则不存在' });
  return getCmsDistributionRule(id);
}
