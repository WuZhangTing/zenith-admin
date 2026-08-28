/**
 * 链路追踪查看器：按 traceId 聚合一次操作的全部留痕锚点为统一时间线。
 *
 * traceId = hono requestId（见 middleware/request-trace.ts 的合并说明）。
 * 五类锚点纯读聚合，无独立存储：
 *   request      ← operation_logs.request_id
 *   job / event  ← workflow_jobs.trace_id（event = job_type 'event_dispatch'，事件体在 payload 内）
 *   notification ← notification_outbox.trace_id + notification_dispatches（渠道级投递结果）
 *   task         ← async_tasks.trace_id
 */
import { desc, eq, inArray } from 'drizzle-orm';
import type { TraceNodeStatus, TraceTimeline, TraceTimelineNode } from '@zenith/shared/platform';
import { db } from '../../db';
import {
  asyncTasks, notificationDispatches, notificationOutbox, operationLogs, workflowJobs,
} from '../../db/schema';
import { formatDateTime } from '../../lib/datetime';
import { mergeWhere } from '../../lib/where-helpers';
import { currentUser } from '../../lib/context';
import { tenantCondition } from '../../lib/tenant';

const NODE_LIMIT_PER_KIND = 200;

const JOB_STATUS_MAP: Record<string, TraceNodeStatus> = {
  pending: 'pending',
  running: 'running',
  succeeded: 'success',
  failed: 'failed',
  dead: 'failed',
  canceled: 'failed',
};

const OUTBOX_STATUS_MAP: Record<string, TraceNodeStatus> = {
  pending: 'pending',
  done: 'success',
  failed: 'failed',
};

const TASK_STATUS_MAP: Record<string, TraceNodeStatus> = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  failed: 'failed',
  cancelled: 'failed',
};

/** event_dispatch 作业 payload 中的事件体（见 workflow-event-bus.emit） */
interface DispatchedEventPayload {
  event?: { type?: string; eventId?: string; occurredAt?: string; [k: string]: unknown };
}

function requestNodes(rows: (typeof operationLogs.$inferSelect)[]): TraceTimelineNode[] {
  return rows.map((r) => ({
    kind: 'request' as const,
    ts: formatDateTime(r.createdAt),
    title: `${r.method} ${r.path}`,
    status: (r.responseCode ?? 200) < 400 ? 'success' as const : 'failed' as const,
    durationMs: r.durationMs ?? null,
    refId: r.id,
    detail: {
      description: r.description,
      module: r.module,
      username: r.username,
      responseCode: r.responseCode,
      ip: r.ip,
      requestBody: r.requestBody,
      hasDiff: Boolean(r.beforeData || r.afterData),
    },
  }));
}

function jobNodes(rows: (typeof workflowJobs.$inferSelect)[]): TraceTimelineNode[] {
  return rows.map((r) => {
    if (r.jobType === 'event_dispatch') {
      const event = (r.payload as DispatchedEventPayload | null)?.event;
      return {
        kind: 'event' as const,
        ts: formatDateTime(r.createdAt),
        title: event?.type ?? '领域事件',
        status: JOB_STATUS_MAP[r.status] ?? 'pending',
        durationMs: null,
        refId: r.id,
        detail: {
          eventId: event?.eventId,
          attempts: r.attempts,
          lastError: r.lastError,
          payload: event,
        },
      };
    }
    return {
      kind: 'job' as const,
      ts: formatDateTime(r.createdAt),
      title: r.jobType,
      status: JOB_STATUS_MAP[r.status] ?? 'pending',
      durationMs: null,
      refId: r.id,
      detail: {
        jobType: r.jobType,
        nodeKey: r.nodeKey,
        instanceId: r.instanceId,
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        runAt: formatDateTime(r.runAt),
        lastError: r.lastError,
        result: r.result,
      },
    };
  });
}

function taskNodes(rows: (typeof asyncTasks.$inferSelect)[]): TraceTimelineNode[] {
  return rows.map((r) => ({
    kind: 'task' as const,
    ts: formatDateTime(r.createdAt),
    title: r.title,
    status: TASK_STATUS_MAP[r.status] ?? 'pending',
    durationMs: r.startedAt && r.completedAt ? r.completedAt.getTime() - r.startedAt.getTime() : null,
    refId: r.id,
    detail: {
      taskType: r.taskType,
      processedCount: r.processedCount,
      totalCount: r.totalCount,
      failedCount: r.failedCount,
      progressNote: r.progressNote,
      errorMessage: r.errorMessage,
      attempts: r.attempts,
    },
  }));
}

async function notificationNodes(traceId: string): Promise<TraceTimelineNode[]> {
  const user = currentUser();
  const outboxRows = await db.select().from(notificationOutbox)
    .where(mergeWhere(eq(notificationOutbox.traceId, traceId), tenantCondition(notificationOutbox, user)))
    .orderBy(desc(notificationOutbox.id))
    .limit(NODE_LIMIT_PER_KIND);
  if (outboxRows.length === 0) return [];

  const dispatchRows = await db.select({
    outboxId: notificationDispatches.outboxId,
    channel: notificationDispatches.channel,
    decision: notificationDispatches.decision,
    reasonCode: notificationDispatches.reasonCode,
    recipientType: notificationDispatches.recipientType,
    recipientId: notificationDispatches.recipientId,
  }).from(notificationDispatches)
    .where(inArray(notificationDispatches.outboxId, outboxRows.map((r) => r.id)));

  const byOutbox = new Map<number, typeof dispatchRows>();
  for (const d of dispatchRows) {
    if (d.outboxId === null) continue;
    const list = byOutbox.get(d.outboxId) ?? [];
    list.push(d);
    byOutbox.set(d.outboxId, list);
  }

  return outboxRows.map((r) => ({
    kind: 'notification' as const,
    ts: formatDateTime(r.createdAt),
    title: r.eventKey,
    status: OUTBOX_STATUS_MAP[r.status] ?? 'pending',
    durationMs: null,
    refId: r.id,
    detail: {
      eventKey: r.eventKey,
      recipientCount: Array.isArray(r.recipients) ? r.recipients.length : 0,
      attempts: r.attempts,
      lastError: r.lastError,
      dispatches: (byOutbox.get(r.id) ?? []).map((d) => ({
        channel: d.channel,
        decision: d.decision,
        reasonCode: d.reasonCode,
        recipientType: d.recipientType,
        recipientId: d.recipientId,
      })),
    },
  }));
}

/** 按 traceId 聚合时间线（五类锚点并行查询，按时间升序归并） */
export async function getTraceTimeline(traceId: string): Promise<TraceTimeline> {
  const user = currentUser();
  const [logRows, jobRows, taskRows, notifNodes] = await Promise.all([
    db.select().from(operationLogs)
      .where(mergeWhere(eq(operationLogs.requestId, traceId), tenantCondition(operationLogs, user)))
      .orderBy(desc(operationLogs.id))
      .limit(NODE_LIMIT_PER_KIND),
    db.select().from(workflowJobs)
      .where(mergeWhere(eq(workflowJobs.traceId, traceId), tenantCondition(workflowJobs, user)))
      .orderBy(desc(workflowJobs.id))
      .limit(NODE_LIMIT_PER_KIND),
    db.select().from(asyncTasks)
      .where(mergeWhere(eq(asyncTasks.traceId, traceId), tenantCondition(asyncTasks, user)))
      .orderBy(desc(asyncTasks.id))
      .limit(NODE_LIMIT_PER_KIND),
    notificationNodes(traceId),
  ]);

  const nodes = [
    ...requestNodes(logRows),
    ...jobNodes(jobRows),
    ...taskNodes(taskRows),
    ...notifNodes,
  ].sort((a, b) => a.ts.localeCompare(b.ts) || a.refId - b.refId);

  return { traceId, nodes };
}
