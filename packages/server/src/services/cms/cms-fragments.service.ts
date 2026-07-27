import { eq, asc, and, or, like, inArray, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { cmsFragments } from '../../db/schema';
import type { CmsFragmentRow, CmsSiteRow } from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { mergeWhere, escapeLike, withPagination } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import type { CreateCmsFragmentInput, UpdateCmsFragmentInput, CmsFragmentType } from '@zenith/shared';
import { assertCompleteCmsBatch } from './cms-access';
import { assertSiteAccess, ensureCmsSiteExists } from './cms-sites.service';
import { sanitizeCmsFragmentContent, cmsFragmentRenderChanged } from './cms-fragment-content';
import { canonicalizeCmsResourceContent, deleteCmsResourceRefsForOwner, syncCmsResourceRefs, resolveCmsResourcePayload } from './cms-resource-refs.service';
import { bumpCmsTemplateRefsRevision, lockCmsSiteForMutation } from './cms-site-publish-lock.service';
import { enqueueCmsPublishOutboxes, insertCmsSiteRefsRebuildOutbox } from './cms-publish-outbox.service';
import { invalidateCmsSitePageCache } from './cms-page-cache.service';
import type { AsyncTask } from '@zenith/shared';
import type { DbTransaction } from '../../db/types';

/**
 * 碎片改动后的前台生效链路。
 *
 * 碎片被主题模板（`<HtmlFragment code=... />`）与搭建页 `fragment` 区块引用，
 * 引用位置无法静态推断，因此重建粒度只能是**站点级**，与栏目 / 搭建页一致。
 *
 * 不接这条链路的话：static 模式改完碎片前台永远是旧产物、hybrid 模式命中旧静态文件、
 * dynamic 模式最长 10 分钟才过期——「应急公告」「合规文案」这类核心用法直接失效。
 */
async function insertFragmentRebuildOutbox(tx: DbTransaction, site: CmsSiteRow, reason: string): Promise<AsyncTask> {
  const revision = await bumpCmsTemplateRefsRevision(tx, site.id);
  return insertCmsSiteRefsRebuildOutbox(
    tx,
    { ...site, templateRefsRevision: revision },
    reason,
    `site:${site.id}:refs:${revision}`,
  );
}

/**
 * 事务开头锁站点行，锁序与栏目 / 搭建页保持一致（站点 → 业务行）。
 *
 * 若先写碎片再拿站点锁，就会与「持站点锁再写素材引用」的其它 CMS 变更形成反向等待，
 * 在 `cms_resources` 唯一索引上撞成死锁。多站点批量时按 id 升序，避免批次之间互等。
 */
async function lockFragmentSites(tx: DbTransaction, siteIds: readonly number[]): Promise<Map<number, CmsSiteRow>> {
  const locked = new Map<number, CmsSiteRow>();
  for (const siteId of [...new Set(siteIds)].sort((a, b) => a - b)) {
    locked.set(siteId, await lockCmsSiteForMutation(tx, siteId));
  }
  return locked;
}

/** 提交后置：入队重建任务并清掉 dynamic 模式的页面缓存 */
async function flushFragmentRebuild(tasks: readonly AsyncTask[], siteIds: Iterable<number>, source: string): Promise<void> {
  await enqueueCmsPublishOutboxes(tasks, source);
  for (const siteId of siteIds) await invalidateCmsSitePageCache(siteId);
}

/**
 * 是否影响前台渲染。判定逻辑在纯函数模块里（`cmsFragmentRenderChanged`），此处仅做转发。
 */
function fragmentRenderChanged(before: CmsFragmentRow, after: CmsFragmentRow): boolean {
  return cmsFragmentRenderChanged(before, after);
}

// ─── 数据映射 ─────────────────────────────────────────────────────────────────
export function mapCmsFragment(row: CmsFragmentRow) {
  return {
    id: row.id,
    siteId: row.siteId,
    code: row.code,
    name: row.name,
    type: row.type,
    content: row.content ?? null,
    status: row.status,
    remark: row.remark ?? null,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

// ─── 前置校验 ─────────────────────────────────────────────────────────────────
export async function ensureCmsFragmentExists(id: number): Promise<CmsFragmentRow> {
  const [row] = await db.select().from(cmsFragments).where(eq(cmsFragments.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '碎片不存在' });
  return row;
}

export async function getCmsFragment(id: number) {
  const row = await ensureCmsFragmentExists(id);
  await assertSiteAccess(row.siteId);
  return resolveCmsResourcePayload(mapCmsFragment(row));
}

// ─── 列表 ─────────────────────────────────────────────────────────────────────
export interface ListCmsFragmentsQuery {
  siteId: number;
  keyword?: string;
  type?: CmsFragmentType;
  page: number;
  pageSize: number;
}

export async function listCmsFragments(q: ListCmsFragmentsQuery) {
  await ensureCmsSiteExists(q.siteId);
  await assertSiteAccess(q.siteId);
  const conditions: SQL[] = [eq(cmsFragments.siteId, q.siteId)];
  if (q.keyword) {
    const kw = or(
      like(cmsFragments.name, `%${escapeLike(q.keyword)}%`),
      like(cmsFragments.code, `%${escapeLike(q.keyword)}%`),
    );
    if (kw) conditions.push(kw);
  }
  if (q.type) conditions.push(eq(cmsFragments.type, q.type));
  const where = mergeWhere(and(...conditions));
  const [total, list] = await Promise.all([
    db.$count(cmsFragments, where),
    withPagination(
      db.select().from(cmsFragments).where(where).orderBy(asc(cmsFragments.id)).$dynamic(),
      q.page,
      q.pageSize,
    ),
  ]);
  return { list: await resolveCmsResourcePayload(list.map(mapCmsFragment)), total, page: q.page, pageSize: q.pageSize };
}

/** 前台渲染上下文用：站点全部启用碎片 code → { type, content } 映射 */
export async function getFragmentMap(siteId: number): Promise<Record<string, { type: CmsFragmentType; content: string }>> {
  const rows = await db.select().from(cmsFragments)
    .where(and(eq(cmsFragments.siteId, siteId), eq(cmsFragments.status, 'enabled')));
  const map: Record<string, { type: CmsFragmentType; content: string }> = {};
  for (const row of rows) {
    map[row.code] = { type: row.type, content: row.content ?? '' };
  }
  return resolveCmsResourcePayload(map);
}

// ─── 创建 / 更新 / 删除 ────────────────────────────────────────────────────────
export async function createCmsFragment(data: CreateCmsFragmentInput) {
  await ensureCmsSiteExists(data.siteId);
  await assertSiteAccess(data.siteId);
  try {
    const mutation = await db.transaction(async (tx) => {
      const site = (await lockFragmentSites(tx, [data.siteId])).get(data.siteId)!;
      const [created] = await tx.insert(cmsFragments).values({
        ...data,
        content: await canonicalizeCmsResourceContent(
          tx,
          data.siteId,
          sanitizeCmsFragmentContent(data.type ?? 'html', data.content),
        ),
      }).returning();
      await syncCmsResourceRefs(tx, 'fragment', created.id, created.siteId, created);
      // 新建即启用的碎片会让模板里原本空着的插槽开始出内容 → 需要重建
      const task = created.status === 'enabled'
        ? await insertFragmentRebuildOutbox(tx, site, '碎片创建')
        : null;
      return { created, task };
    });
    if (mutation.task) {
      await flushFragmentRebuild([mutation.task], [mutation.created.siteId], `碎片 #${mutation.created.id} 创建`);
    }
    return resolveCmsResourcePayload(mapCmsFragment(mutation.created));
  } catch (err) {
    rethrowPgUniqueViolation(err, '同站点下碎片标识已存在');
  }
}

export async function updateCmsFragment(id: number, data: UpdateCmsFragmentInput) {
  const current = await ensureCmsFragmentExists(id);
  await assertSiteAccess(current.siteId);
  const type = data.type ?? current.type;
  const content = data.content === undefined ? current.content : data.content;
  /**
   * 仅在**正文本身被提交**或**类型被显式改动**时才重新净化。
   *
   * 不加这个判断会把已落库的正文再洗一遍，内联样式里不在白名单的属性被静默抹掉——
   * 改个备注就破坏了运营排版。
   */
  const needsContentRewrite = data.content !== undefined || data.type !== undefined;
  try {
    const mutation = await db.transaction(async (tx) => {
      const site = (await lockFragmentSites(tx, [current.siteId])).get(current.siteId)!;
      const [updated] = await tx.update(cmsFragments).set({
        ...data,
        ...(needsContentRewrite
          ? {
              content: await canonicalizeCmsResourceContent(
                tx,
                current.siteId,
                sanitizeCmsFragmentContent(type, content),
              ),
            }
          : {}),
      }).where(and(
        eq(cmsFragments.id, id),
      )).returning();
      if (!updated) throw new HTTPException(404, { message: '碎片不存在' });
      await syncCmsResourceRefs(tx, 'fragment', updated.id, updated.siteId, updated);
      const task = fragmentRenderChanged(current, updated)
        ? await insertFragmentRebuildOutbox(tx, site, '碎片更新')
        : null;
      return { updated, task };
    });
    if (mutation.task) {
      await flushFragmentRebuild([mutation.task], [mutation.updated.siteId], `碎片 #${id} 更新`);
    }
    return resolveCmsResourcePayload(mapCmsFragment(mutation.updated));
  } catch (err) {
    rethrowPgUniqueViolation(err, '同站点下碎片标识已存在');
  }
}

export async function deleteCmsFragment(id: number) {
  const current = await ensureCmsFragmentExists(id);
  await assertSiteAccess(current.siteId);
  const mutation = await db.transaction(async (tx) => {
    const site = (await lockFragmentSites(tx, [current.siteId])).get(current.siteId)!;
    const [row] = await tx.delete(cmsFragments).where(and(
      eq(cmsFragments.id, id),
    )).returning();
    if (!row) throw new HTTPException(404, { message: '碎片不存在' });
    await deleteCmsResourceRefsForOwner(tx, 'fragment', [row.id]);
    // 停用中的碎片本来就没进渲染上下文，删除不改变前台产物
    const task = row.status === 'enabled'
      ? await insertFragmentRebuildOutbox(tx, site, '碎片删除')
      : null;
    return { task, siteId: row.siteId };
  });
  if (mutation.task) {
    await flushFragmentRebuild([mutation.task], [mutation.siteId], `碎片 #${id} 删除`);
  }
}

export async function batchDeleteCmsFragments(ids: number[]) {
  if (ids.length === 0) return;
  const rows = await db.select({ id: cmsFragments.id, siteId: cmsFragments.siteId, status: cmsFragments.status })
    .from(cmsFragments)
    .where(inArray(cmsFragments.id, ids));
  assertCompleteCmsBatch(ids, rows.map((row) => row.id), '碎片');
  for (const siteId of new Set(rows.map((row) => row.siteId))) await assertSiteAccess(siteId);
  // 每站一次重建即可，无需按碎片条数重复入队
  const affectedSiteIds = [...new Set(rows.filter((row) => row.status === 'enabled').map((row) => row.siteId))];
  const tasks = await db.transaction(async (tx) => {
    const sites = await lockFragmentSites(tx, affectedSiteIds);
    await tx.delete(cmsFragments).where(inArray(cmsFragments.id, ids));
    await deleteCmsResourceRefsForOwner(tx, 'fragment', rows.map((row) => row.id));
    const created: AsyncTask[] = [];
    for (const siteId of affectedSiteIds) {
      created.push(await insertFragmentRebuildOutbox(tx, sites.get(siteId)!, '碎片批量删除'));
    }
    return created;
  });
  if (tasks.length > 0) await flushFragmentRebuild(tasks, affectedSiteIds, `碎片批量删除（${ids.length} 条）`);
}
