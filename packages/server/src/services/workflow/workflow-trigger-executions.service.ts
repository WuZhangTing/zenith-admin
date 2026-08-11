import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { workflowJobExecutions, workflowJobs } from '../../db/schema';
import { HTTPException } from 'hono/http-exception';
import { currentUser } from '../../lib/context';
import { tenantCondition } from '../../lib/tenant';
import { pageOffset } from '../../lib/pagination';
import { formatDateTime } from '../../lib/datetime';

type TriggerExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'retrying';

type TriggerExecutionRow = {
  execution: typeof workflowJobExecutions.$inferSelect;
  job: typeof workflowJobs.$inferSelect;
};

function getPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function mapExecutionStatus(row: TriggerExecutionRow): TriggerExecutionStatus {
  if (row.execution.status === 'succeeded') return 'success';
  if (row.execution.status === 'running') return 'running';
  // 本次尝试已失败但父作业仍有重试预算 → retrying；预算耗尽才是终态 failed
  if (row.job.status === 'failed' && row.job.attempts < row.job.maxAttempts) return 'retrying';
  return 'failed';
}

export function mapTriggerExecution(row: TriggerExecutionRow) {
  const triggerType = getPayloadString(row.job.payload, 'triggerType')
    ?? getPayloadString(row.job.payload, 'type')
    ?? 'webhook';
  return {
    id: row.execution.id,
    instanceId: row.job.instanceId ?? 0,
    taskId: row.job.taskId ?? null,
    nodeKey: row.job.nodeKey ?? getPayloadString(row.job.payload, 'nodeKey') ?? '',
    nodeName: getPayloadString(row.job.payload, 'nodeName'),
    triggerType,
    status: mapExecutionStatus(row),
    attempt: row.execution.attempt,
    requestUrl: row.execution.requestUrl ?? null,
    requestMethod: row.execution.requestMethod ?? null,
    requestBody: row.execution.requestBody ?? null,
    responseStatus: row.execution.responseStatus ?? null,
    responseBody: row.execution.responseBody ?? null,
    errorMessage: row.execution.errorMessage ?? row.job.lastError ?? null,
    durationMs: row.execution.durationMs ?? null,
    tenantId: row.execution.tenantId ?? row.job.tenantId ?? null,
    createdAt: formatDateTime(row.execution.createdAt),
  };
}

export interface ListTriggerExecutionsParams {
  page?: number;
  pageSize?: number;
  instanceId?: number;
  nodeKey?: string;
  status?: TriggerExecutionStatus;
}

export async function listTriggerExecutions(params: ListTriggerExecutionsParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;
  const tc = tenantCondition(workflowJobExecutions, currentUser());
  const conds: SQL[] = [eq(workflowJobExecutions.jobType, 'trigger_dispatch')];
  if (tc) conds.push(tc);
  if (params.instanceId) conds.push(eq(workflowJobs.instanceId, params.instanceId));
  if (params.nodeKey) conds.push(eq(workflowJobs.nodeKey, params.nodeKey));
  if (params.status === 'success') conds.push(eq(workflowJobExecutions.status, 'succeeded'));
  else if (params.status === 'running') conds.push(eq(workflowJobExecutions.status, 'running'));
  else if (params.status === 'failed') conds.push(eq(workflowJobExecutions.status, 'failed'));
  else if (params.status === 'retrying') conds.push(and(eq(workflowJobExecutions.status, 'failed'), sql`${workflowJobs.attempts} < ${workflowJobs.maxAttempts}`)!);
  else if (params.status === 'pending') conds.push(sql`false`);
  const where = and(...conds);

  const [total, rows] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` })
      .from(workflowJobExecutions)
      .innerJoin(workflowJobs, eq(workflowJobExecutions.jobId, workflowJobs.id))
      .where(where)
      .then((r) => r[0]?.c ?? 0),
    db.select({ execution: workflowJobExecutions, job: workflowJobs }).from(workflowJobExecutions)
      .innerJoin(workflowJobs, eq(workflowJobExecutions.jobId, workflowJobs.id))
      .where(where)
      .orderBy(desc(workflowJobExecutions.id))
      .limit(pageSize)
      .offset(pageOffset(page, pageSize)),
  ]);
  return { list: rows.map(mapTriggerExecution), total, page, pageSize };
}

export async function getTriggerExecution(id: number) {
  const tc = tenantCondition(workflowJobExecutions, currentUser());
  const conds: SQL[] = [eq(workflowJobExecutions.id, id), eq(workflowJobExecutions.jobType, 'trigger_dispatch')];
  if (tc) conds.push(tc);
  const [row] = await db.select({ execution: workflowJobExecutions, job: workflowJobs })
    .from(workflowJobExecutions)
    .innerJoin(workflowJobs, eq(workflowJobExecutions.jobId, workflowJobs.id))
    .where(and(...conds))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: '触发器执行记录不存在' });
  return mapTriggerExecution(row);
}
