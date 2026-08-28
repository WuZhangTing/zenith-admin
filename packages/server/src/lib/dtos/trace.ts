/**
 * 链路追踪 DTO
 */
import { z } from '@hono/zod-openapi';
import { TRACE_NODE_KINDS, TRACE_NODE_STATUSES } from '@zenith/shared/platform';

export const TraceTimelineNodeDTO = z
  .object({
    kind: z.enum(TRACE_NODE_KINDS),
    ts: z.string().openapi({ example: '2026-08-28 12:00:00' }),
    title: z.string(),
    status: z.enum(TRACE_NODE_STATUSES),
    durationMs: z.number().int().nullable(),
    refId: z.number().int(),
    detail: z.record(z.string(), z.unknown()),
  })
  .openapi('TraceTimelineNode');

export const TraceTimelineDTO = z
  .object({
    traceId: z.string(),
    nodes: z.array(TraceTimelineNodeDTO),
  })
  .openapi('TraceTimeline');
