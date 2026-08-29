/**
 * 会话回放 DTO
 */
import { z } from '@hono/zod-openapi';
import { ANALYTICS_ENVIRONMENTS, ANALYTICS_EVENT_SOURCES } from '@zenith/shared/analytics';

const replayModeEnum = z.enum(['buffer', 'stream']);
const replayStatusEnum = z.enum(['recording', 'completed', 'expired']);
const replayTriggerTypeEnum = z.enum(['error', 'sampled', 'manual', 'rage_click', 'white_screen']);

export const ReplayTriggerDTO = z
  .object({
    type: replayTriggerTypeEnum,
    at: z.string(),
    refId: z.string().optional(),
  })
  .openapi('ReplayTrigger');

export const ReplaySessionDTO = z
  .object({
    id: z.string(),
    sessionId: z.string(),
    mode: replayModeEnum,
    status: replayStatusEnum,
    triggers: z.array(ReplayTriggerDTO),
    startedAt: z.string(),
    lastActivityAt: z.string(),
    endedAt: z.string().nullable(),
    durationMs: z.number().int(),
    segmentCount: z.number().int(),
    totalBytes: z.number().int(),
    errorCount: z.number().int(),
    pageCount: z.number().int(),
    clickCount: z.number().int(),
    pagePaths: z.array(z.string()),
    clickLabels: z.array(z.string()),
    entryPageUrl: z.string().nullable(),
    source: z.enum(ANALYTICS_EVENT_SOURCES),
    appId: z.string(),
    environment: z.enum(ANALYTICS_ENVIRONMENTS),
    userId: z.number().int().nullable(),
    username: z.string().nullable(),
    memberId: z.number().int().nullable(),
    browser: z.string().nullable(),
    os: z.string().nullable(),
    deviceType: z.string().nullable(),
    sdkVersion: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('ReplaySession');

export const ReplaySegmentMetaDTO = z
  .object({
    id: z.number().int(),
    replayId: z.string(),
    seq: z.number().int(),
    fromTs: z.string(),
    toTs: z.string(),
    byteSize: z.number().int(),
    eventCount: z.number().int(),
    hasFullSnapshot: z.boolean(),
  })
  .openapi('ReplaySegmentMeta');

export const ReplaySessionDetailDTO = ReplaySessionDTO
  .extend({
    segments: z.array(ReplaySegmentMetaDTO),
    errors: z.array(z.object({
      id: z.number().int(),
      groupId: z.number().int(),
      errorType: z.string(),
      level: z.string(),
      message: z.string(),
      createdAt: z.string(),
    })),
    perfEvents: z.array(z.object({
      metricName: z.string(),
      metricValue: z.number(),
      createdAt: z.string(),
    })),
    siblings: z.array(z.object({
      id: z.string(),
      status: z.enum(['recording', 'completed', 'expired']),
      startedAt: z.string(),
      durationMs: z.number().int(),
      errorCount: z.number().int(),
      entryPageUrl: z.string().nullable(),
    })),
  })
  .openapi('ReplaySessionDetail');
