import { HTTPException } from 'hono/http-exception';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  directorySyncSources, directorySyncRuns, directorySyncRunItems, directorySyncConflicts,
  directorySyncUserLinks, tenantIdentityProviders, users,
  type DirectorySyncSourceRow, type DirectorySyncRunRow, type DirectorySyncRunItemRow, type DirectorySyncConflictRow,
} from '../../db/schema';
import type {
  CreateDirectorySyncSourceInput, UpdateDirectorySyncSourceInput, ResolveDirectorySyncConflictInput,
  DirectorySyncRunStatus, DirectorySyncSourceType, DirectorySyncConflictStatus, DirectorySyncEntityType, DirectorySyncTriggerType, DirectorySyncItemAction,
  DirectorySyncMatchKey, DirectorySyncConflictPolicy, DirectorySyncConflictType, DirectorySyncResolution,
} from '@zenith/shared/identity';
import { formatDateTime, formatNullableDateTime } from '../../lib/datetime';
import { buildWhere, dateRangeConditions, keywordCondition, withPagination } from '../../lib/where-helpers';
import { pageOffset } from '../../lib/pagination';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import { submitAsyncTask, mapAsyncTask } from '../../lib/task-center';
import { buildDirectoryConnector, type DirectoryConnectorTestResult } from './directory-sync-connectors';
import { computeNextRunAt, DIRECTORY_SYNC_TASK_TYPE } from './directory-sync-engine';

// ─── 数据映射 ─────────────────────────────────────────────────────────────────
export function mapDirectorySyncSource(row: DirectorySyncSourceRow & { identityProvider?: { name: string } | null }) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    tenantId: row.tenantId ?? null,
    identityProviderId: row.identityProviderId ?? null,
    identityProviderName: row.identityProvider?.name ?? null,
    oauthProvider: row.oauthProvider ?? null,
    matchKey: row.matchKey as DirectorySyncMatchKey,
    fieldMapping: row.fieldMapping ?? {},
    scopeConfig: row.scopeConfig ?? {},
    conflictPolicy: row.conflictPolicy as DirectorySyncConflictPolicy,
    lifecycle: row.lifecycle,
    syncDepartments: row.syncDepartments,
    cronExpression: row.cronExpression ?? null,
    circuitBreakerPercent: row.circuitBreakerPercent,
    nextRunAt: formatNullableDateTime(row.nextRunAt),
    lastRunAt: formatNullableDateTime(row.lastRunAt),
    lastRunStatus: row.lastRunStatus ?? null,
    remark: row.remark ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

export function mapDirectorySyncRun(row: DirectorySyncRunRow & { source?: { name: string } | null }) {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.source?.name ?? null,
    triggerType: row.triggerType as DirectorySyncTriggerType,
    dryRun: row.dryRun,
    status: row.status,
    totalFetched: row.totalFetched,
    deptCreated: row.deptCreated,
    deptUpdated: row.deptUpdated,
    userCreated: row.userCreated,
    userLinked: row.userLinked,
    userUpdated: row.userUpdated,
    userDisabled: row.userDisabled,
    skipped: row.skipped,
    conflictCount: row.conflictCount,
    failedCount: row.failedCount,
    message: row.message ?? null,
    errorMessage: row.errorMessage ?? null,
    triggeredBy: row.triggeredBy ?? null,
    startedAt: formatDateTime(row.startedAt),
    finishedAt: formatNullableDateTime(row.finishedAt),
    createdAt: formatDateTime(row.createdAt),
  };
}

export function mapDirectorySyncRunItem(row: DirectorySyncRunItemRow) {
  return {
    id: row.id,
    runId: row.runId,
    entityType: row.entityType as DirectorySyncEntityType,
    externalId: row.externalId,
    name: row.name ?? null,
    action: row.action as DirectorySyncItemAction,
    applied: row.applied,
    diff: row.diff ?? null,
    message: row.message ?? null,
    createdAt: formatDateTime(row.createdAt),
  };
}

export function mapDirectorySyncConflict(row: DirectorySyncConflictRow & { source?: { name: string } | null; resolvedByUser?: { nickname: string } | null }) {
  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceName: row.source?.name ?? null,
    runId: row.runId ?? null,
    entityType: row.entityType as DirectorySyncEntityType,
    externalId: row.externalId,
    name: row.name ?? null,
    conflictType: row.conflictType as DirectorySyncConflictType,
    sourceData: row.sourceData ?? null,
    localData: row.localData ?? null,
    candidateUserIds: row.candidateUserIds ?? [],
    status: row.status,
    resolution: (row.resolution ?? null) as DirectorySyncResolution | null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedByNickname: row.resolvedByUser?.nickname ?? null,
    resolvedAt: formatNullableDateTime(row.resolvedAt),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

// ─── 同步源 CRUD ──────────────────────────────────────────────────────────────
export interface ListDirectorySyncSourcesQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: DirectorySyncSourceType;
  status?: 'enabled' | 'disabled';
}

function buildSourceWhere(q: ListDirectorySyncSourcesQuery & { id?: number }) {
  return buildWhere(
    q.id !== undefined ? eq(directorySyncSources.id, q.id) : undefined,
    keywordCondition(q.keyword, [directorySyncSources.name, directorySyncSources.remark]),
    q.type ? eq(directorySyncSources.type, q.type) : undefined,
    q.status ? eq(directorySyncSources.status, q.status) : undefined,
  );
}

export async function listDirectorySyncSources(q: ListDirectorySyncSourcesQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildSourceWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(directorySyncSources, where),
    db.query.directorySyncSources.findMany({
      where,
      with: { identityProvider: { columns: { name: true } } },
      orderBy: desc(directorySyncSources.id),
      limit: pageSize,
      offset: pageOffset(page, pageSize),
    }),
  ]);
  return { list: rows.map(mapDirectorySyncSource), total, page, pageSize };
}

export async function ensureDirectorySyncSourceExists(id: number): Promise<DirectorySyncSourceRow> {
  const [row] = await db.select().from(directorySyncSources).where(eq(directorySyncSources.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '同步源不存在' });
  return row;
}

export async function getDirectorySyncSource(id: number) {
  const row = await db.query.directorySyncSources.findFirst({
    where: eq(directorySyncSources.id, id),
    with: { identityProvider: { columns: { name: true } } },
  });
  if (!row) throw new HTTPException(404, { message: '同步源不存在' });
  return mapDirectorySyncSource(row);
}

async function ensureBindingsValid(input: { type?: string; identityProviderId?: number | null; cronExpression?: string | null }) {
  if (input.identityProviderId) {
    const [provider] = await db.select({ id: tenantIdentityProviders.id, type: tenantIdentityProviders.type })
      .from(tenantIdentityProviders).where(eq(tenantIdentityProviders.id, input.identityProviderId)).limit(1);
    if (!provider) throw new HTTPException(400, { message: '绑定的企业身份源不存在' });
    if (provider.type !== 'ldap' && provider.type !== 'ad') {
      throw new HTTPException(400, { message: '绑定的企业身份源必须是 LDAP/AD 类型' });
    }
  }
  if (input.cronExpression?.trim() && !computeNextRunAt(input.cronExpression)) {
    throw new HTTPException(400, { message: 'cron 表达式无效' });
  }
}

export async function createDirectorySyncSource(data: CreateDirectorySyncSourceInput) {
  await ensureBindingsValid(data);
  try {
    const [row] = await db.insert(directorySyncSources).values({
      name: data.name,
      type: data.type,
      status: data.status,
      tenantId: data.tenantId ?? null,
      identityProviderId: data.identityProviderId ?? null,
      oauthProvider: data.oauthProvider ?? null,
      matchKey: data.matchKey,
      fieldMapping: data.fieldMapping,
      scopeConfig: data.scopeConfig,
      conflictPolicy: data.conflictPolicy,
      lifecycle: data.lifecycle,
      syncDepartments: data.syncDepartments,
      cronExpression: data.cronExpression ?? null,
      circuitBreakerPercent: data.circuitBreakerPercent,
      nextRunAt: data.status === 'enabled' ? computeNextRunAt(data.cronExpression) : null,
      remark: data.remark ?? null,
    }).returning();
    return getDirectorySyncSource(row.id);
  } catch (err) {
    rethrowPgUniqueViolation(err, '同名同步源已存在');
    throw err;
  }
}

export async function updateDirectorySyncSource(id: number, data: UpdateDirectorySyncSourceInput) {
  const before = await ensureDirectorySyncSourceExists(id);
  await ensureBindingsValid(data);
  const cron = data.cronExpression !== undefined ? data.cronExpression : before.cronExpression;
  const status = data.status ?? before.status;
  try {
    await db.update(directorySyncSources).set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.tenantId !== undefined ? { tenantId: data.tenantId } : {}),
      ...(data.identityProviderId !== undefined ? { identityProviderId: data.identityProviderId } : {}),
      ...(data.oauthProvider !== undefined ? { oauthProvider: data.oauthProvider } : {}),
      ...(data.matchKey !== undefined ? { matchKey: data.matchKey } : {}),
      ...(data.fieldMapping !== undefined ? { fieldMapping: data.fieldMapping } : {}),
      ...(data.scopeConfig !== undefined ? { scopeConfig: data.scopeConfig } : {}),
      ...(data.conflictPolicy !== undefined ? { conflictPolicy: data.conflictPolicy } : {}),
      ...(data.lifecycle !== undefined ? { lifecycle: data.lifecycle } : {}),
      ...(data.syncDepartments !== undefined ? { syncDepartments: data.syncDepartments } : {}),
      ...(data.cronExpression !== undefined ? { cronExpression: data.cronExpression } : {}),
      ...(data.circuitBreakerPercent !== undefined ? { circuitBreakerPercent: data.circuitBreakerPercent } : {}),
      ...(data.remark !== undefined ? { remark: data.remark } : {}),
      // 启停或表达式变化后重算下次运行时间
      nextRunAt: status === 'enabled' ? computeNextRunAt(cron) : null,
    }).where(eq(directorySyncSources.id, id));
  } catch (err) {
    rethrowPgUniqueViolation(err, '同名同步源已存在');
    throw err;
  }
  return getDirectorySyncSource(id);
}

export async function deleteDirectorySyncSource(id: number) {
  await ensureDirectorySyncSourceExists(id);
  await db.delete(directorySyncSources).where(eq(directorySyncSources.id, id));
}

// ─── 连接测试与同步提交 ────────────────────────────────────────────────────────
export async function testDirectorySyncSourceConnection(id: number): Promise<DirectoryConnectorTestResult> {
  const source = await ensureDirectorySyncSourceExists(id);
  return buildDirectoryConnector(source).test();
}

export async function submitDirectorySyncTask(id: number, dryRun: boolean) {
  const source = await ensureDirectorySyncSourceExists(id);
  const row = await submitAsyncTask({
    taskType: DIRECTORY_SYNC_TASK_TYPE,
    title: dryRun ? `通讯录差异预览（${source.name}）` : `通讯录同步（${source.name}）`,
    payload: { sourceId: id, dryRun },
  });
  return mapAsyncTask(row);
}

// ─── 同步记录 ─────────────────────────────────────────────────────────────────
export interface ListDirectorySyncRunsQuery {
  page?: number;
  pageSize?: number;
  sourceId?: number;
  status?: DirectorySyncRunStatus;
  startTime?: string;
  endTime?: string;
}

function buildRunWhere(q: ListDirectorySyncRunsQuery) {
  return buildWhere(
    q.sourceId !== undefined ? eq(directorySyncRuns.sourceId, q.sourceId) : undefined,
    q.status ? eq(directorySyncRuns.status, q.status) : undefined,
    ...dateRangeConditions(directorySyncRuns.startedAt, q.startTime, q.endTime),
  );
}

export async function listDirectorySyncRuns(q: ListDirectorySyncRunsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildRunWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(directorySyncRuns, where),
    db.query.directorySyncRuns.findMany({
      where,
      with: { source: { columns: { name: true } } },
      orderBy: desc(directorySyncRuns.id),
      limit: pageSize,
      offset: pageOffset(page, pageSize),
    }),
  ]);
  return { list: rows.map(mapDirectorySyncRun), total, page, pageSize };
}

export async function getDirectorySyncRun(id: number) {
  const row = await db.query.directorySyncRuns.findFirst({
    where: eq(directorySyncRuns.id, id),
    with: { source: { columns: { name: true } } },
  });
  if (!row) throw new HTTPException(404, { message: '同步记录不存在' });
  return mapDirectorySyncRun(row);
}

export interface ListDirectorySyncRunItemsQuery {
  page?: number;
  pageSize?: number;
  action?: DirectorySyncItemAction;
  entityType?: DirectorySyncEntityType;
}

export async function listDirectorySyncRunItems(runId: number, q: ListDirectorySyncRunItemsQuery) {
  const { page = 1, pageSize = 20 } = q;
  const where = buildWhere(
    eq(directorySyncRunItems.runId, runId),
    q.action ? eq(directorySyncRunItems.action, q.action) : undefined,
    q.entityType ? eq(directorySyncRunItems.entityType, q.entityType) : undefined,
  );
  const [total, rows] = await Promise.all([
    db.$count(directorySyncRunItems, where),
    withPagination(
      db.select().from(directorySyncRunItems).where(where).orderBy(directorySyncRunItems.id).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  return { list: rows.map(mapDirectorySyncRunItem), total, page, pageSize };
}

/** 失败重试：对该记录所属同步源重新提交一次全量同步（引擎幂等，仅失败项会产生变化） */
export async function retryDirectorySyncRun(runId: number) {
  const [run] = await db.select().from(directorySyncRuns).where(eq(directorySyncRuns.id, runId)).limit(1);
  if (!run) throw new HTTPException(404, { message: '同步记录不存在' });
  if (run.status === 'running') throw new HTTPException(400, { message: '该记录仍在执行中' });
  return submitDirectorySyncTask(run.sourceId, false);
}

// ─── 冲突处理 ─────────────────────────────────────────────────────────────────
export interface ListDirectorySyncConflictsQuery {
  page?: number;
  pageSize?: number;
  sourceId?: number;
  status?: DirectorySyncConflictStatus;
  keyword?: string;
}

function buildConflictWhere(q: ListDirectorySyncConflictsQuery) {
  return buildWhere(
    q.sourceId !== undefined ? eq(directorySyncConflicts.sourceId, q.sourceId) : undefined,
    q.status ? eq(directorySyncConflicts.status, q.status) : undefined,
    keywordCondition(q.keyword, [directorySyncConflicts.name, directorySyncConflicts.externalId]),
  );
}

export async function listDirectorySyncConflicts(q: ListDirectorySyncConflictsQuery) {
  const { page = 1, pageSize = 10 } = q;
  const where = buildConflictWhere(q);
  const [total, rows] = await Promise.all([
    db.$count(directorySyncConflicts, where),
    db.query.directorySyncConflicts.findMany({
      where,
      with: {
        source: { columns: { name: true } },
        resolvedByUser: { columns: { nickname: true } },
      },
      orderBy: desc(directorySyncConflicts.id),
      limit: pageSize,
      offset: pageOffset(page, pageSize),
    }),
  ]);
  return { list: rows.map(mapDirectorySyncConflict), total, page, pageSize };
}

export async function ensureDirectorySyncConflictExists(id: number): Promise<DirectorySyncConflictRow> {
  const [row] = await db.select().from(directorySyncConflicts).where(eq(directorySyncConflicts.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '冲突记录不存在' });
  return row;
}

/** 将源侧快照字段应用到本地用户 */
async function applySourceDataToUser(userId: number, sourceData: Record<string, unknown>, onlyFields?: string[]) {
  const patch: Record<string, unknown> = {};
  const fields = onlyFields ?? ['nickname', 'email', 'phone'];
  for (const field of fields) {
    if (field in sourceData && sourceData[field] != null && ['nickname', 'email', 'phone'].includes(field)) {
      patch[field] = field === 'nickname' ? String(sourceData[field]).slice(0, 32) : sourceData[field];
    }
  }
  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, userId));
  }
}

export async function resolveDirectorySyncConflict(id: number, input: ResolveDirectorySyncConflictInput, resolvedBy: number) {
  const conflict = await ensureDirectorySyncConflictExists(id);
  if (conflict.status !== 'pending') throw new HTTPException(400, { message: '该冲突已处理' });

  if (input.resolution === 'source') {
    if (conflict.conflictType === 'multi_match') {
      const targetUserId = input.targetUserId;
      if (!targetUserId) throw new HTTPException(400, { message: '请选择要绑定的本地账号' });
      if (!conflict.candidateUserIds.includes(targetUserId)) {
        throw new HTTPException(400, { message: '所选账号不在候选列表中' });
      }
      await db.transaction(async (tx) => {
        await tx.insert(directorySyncUserLinks).values({
          sourceId: conflict.sourceId,
          externalId: conflict.externalId,
          userId: targetUserId,
          externalData: conflict.sourceData,
          lastSeenAt: new Date(),
        }).onConflictDoNothing();
        if (conflict.sourceData) {
          const patch: Record<string, unknown> = {};
          for (const field of ['nickname', 'email', 'phone'] as const) {
            const value = conflict.sourceData[field];
            if (value != null) patch[field] = field === 'nickname' ? String(value).slice(0, 32) : value;
          }
          if (Object.keys(patch).length > 0) {
            await tx.update(users).set(patch).where(eq(users.id, targetUserId));
          }
        }
      });
    } else {
      const [link] = await db.select().from(directorySyncUserLinks).where(and(
        eq(directorySyncUserLinks.sourceId, conflict.sourceId),
        eq(directorySyncUserLinks.externalId, conflict.externalId),
      )).limit(1);
      if (!link) throw new HTTPException(400, { message: '未找到该外部用户的本地绑定' });
      const conflictedFields = conflict.localData ? Object.keys(conflict.localData) : undefined;
      if (conflict.sourceData) {
        await applySourceDataToUser(link.userId, conflict.sourceData, conflictedFields);
        await db.update(directorySyncUserLinks).set({ externalData: conflict.sourceData }).where(eq(directorySyncUserLinks.id, link.id));
      }
    }
  }
  // resolution=local / manual：保留本地现状，仅登记裁决结果；引擎会跳过源数据未变化的已裁决冲突

  await db.update(directorySyncConflicts).set({
    status: 'resolved',
    resolution: input.resolution,
    resolvedBy,
    resolvedAt: new Date(),
  }).where(eq(directorySyncConflicts.id, id));
  return listConflictById(id);
}

async function listConflictById(id: number) {
  const row = await db.query.directorySyncConflicts.findFirst({
    where: eq(directorySyncConflicts.id, id),
    with: {
      source: { columns: { name: true } },
      resolvedByUser: { columns: { nickname: true } },
    },
  });
  if (!row) throw new HTTPException(404, { message: '冲突记录不存在' });
  return mapDirectorySyncConflict(row);
}

export async function ignoreDirectorySyncConflicts(ids: number[], resolvedBy: number) {
  const updated = await db.update(directorySyncConflicts).set({
    status: 'ignored',
    resolution: 'local',
    resolvedBy,
    resolvedAt: new Date(),
  }).where(and(
    inArray(directorySyncConflicts.id, ids),
    eq(directorySyncConflicts.status, 'pending'),
  )).returning({ id: directorySyncConflicts.id });
  return updated.length;
}
