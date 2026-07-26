import { createHash } from 'node:crypto';
import { currentUser } from '../../lib/context';
import { submitAsyncTask } from '../../lib/task-center';
import { assertSiteAccess } from './cms-sites.service';
import { CMS_RESOURCE_GOVERNANCE_TASK, CMS_RESOURCE_REF_REBUILD_TASK } from './cms-resource-tasks';

export type CmsResourceTaskPayload =
  | { operation: 'scan' | 'cleanup'; siteId: number; dryRun: boolean }
  | { operation: 'move'; siteId: number; resourceIds: number[]; folderId: number | null };

export const CMS_RESOURCE_IDEMPOTENCY_WINDOW_MS = 30_000;

export function normalizeCmsResourceTaskPayload(payload: CmsResourceTaskPayload): CmsResourceTaskPayload {
  if (payload.operation === 'move') {
    return {
      operation: 'move',
      siteId: payload.siteId,
      resourceIds: [...new Set(payload.resourceIds)].sort((left, right) => left - right),
      folderId: payload.folderId ?? null,
    };
  }
  return {
    operation: payload.operation,
    siteId: payload.siteId,
    dryRun: payload.dryRun === true,
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildCmsResourceTaskIdempotencyKey(
  userId: number,
  payload: CmsResourceTaskPayload,
  nowMs = Date.now(),
): string {
  const normalized = normalizeCmsResourceTaskPayload(payload);
  const digest = createHash('sha256')
    .update(canonicalJson(normalized))
    .digest('hex')
    .slice(0, 32);
  const bucket = Math.floor(nowMs / CMS_RESOURCE_IDEMPOTENCY_WINDOW_MS);
  return `cms-resource:${userId}:${bucket}:${digest}`;
}

export async function submitCmsResourceTask(payload: CmsResourceTaskPayload, title: string) {
  await assertSiteAccess(payload.siteId);
  const userId = currentUser().userId;
  const normalized = normalizeCmsResourceTaskPayload(payload);
  return submitAsyncTask({
    taskType: CMS_RESOURCE_GOVERNANCE_TASK,
    title,
    payload: normalized,
    idempotencyKey: buildCmsResourceTaskIdempotencyKey(userId, normalized),
  });
}

/**
 * 提交素材引用索引重建任务。
 *
 * 引用索引由 owner 写事务实时维护，正常情况下不需要重建；本任务用于存量数据回填
 * 与索引疑似漂移时的修复，逐 owner 类型分阶段执行，可断点续跑。
 */
export async function submitCmsResourceRefRebuildTask(siteId: number) {
  await assertSiteAccess(siteId);
  const userId = currentUser().userId;
  const bucket = Math.floor(Date.now() / CMS_RESOURCE_IDEMPOTENCY_WINDOW_MS);
  return submitAsyncTask({
    taskType: CMS_RESOURCE_REF_REBUILD_TASK,
    title: 'CMS 素材引用索引重建',
    payload: { siteId },
    idempotencyKey: `cms-resource-refs:${userId}:${bucket}:${siteId}`,
  });
}
