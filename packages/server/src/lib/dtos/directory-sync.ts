import { z } from '@hono/zod-openapi';
import {
  DIRECTORY_SYNC_SOURCE_TYPES, DIRECTORY_SYNC_MATCH_KEYS, DIRECTORY_SYNC_CONFLICT_POLICIES,
  DIRECTORY_SYNC_RUN_STATUSES, DIRECTORY_SYNC_TRIGGER_TYPES, DIRECTORY_SYNC_ITEM_ACTIONS,
  DIRECTORY_SYNC_ENTITY_TYPES, DIRECTORY_SYNC_CONFLICT_TYPES, DIRECTORY_SYNC_CONFLICT_STATUSES,
  DIRECTORY_SYNC_RESOLUTIONS,
} from '@zenith/shared/identity';
import { auditFields } from './_audit';

const diffSchema = z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })).nullable();

export const DirectorySyncSourceDTO = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.enum(DIRECTORY_SYNC_SOURCE_TYPES),
    status: z.enum(['enabled', 'disabled']),
    tenantId: z.number().int().nullable(),
    identityProviderId: z.number().int().nullable(),
    identityProviderName: z.string().nullable().optional(),
    oauthProvider: z.string().nullable(),
    matchKey: z.enum(DIRECTORY_SYNC_MATCH_KEYS),
    fieldMapping: z.record(z.string(), z.string()),
    scopeConfig: z.object({
      deptExternalIds: z.array(z.string()).optional(),
      excludeUserExternalIds: z.array(z.string()).optional(),
    }),
    conflictPolicy: z.enum(DIRECTORY_SYNC_CONFLICT_POLICIES),
    lifecycle: z.object({
      disableOnLeave: z.boolean(),
      kickSessions: z.boolean(),
      defaultRoleIds: z.array(z.number().int()),
    }),
    syncDepartments: z.boolean(),
    cronExpression: z.string().nullable(),
    circuitBreakerPercent: z.number().int(),
    contactSecretSet: z.boolean().optional(),
    nextRunAt: z.string().nullable(),
    lastRunAt: z.string().nullable(),
    lastRunStatus: z.enum(DIRECTORY_SYNC_RUN_STATUSES).nullable(),
    remark: z.string().nullable(),
    ...auditFields,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DirectorySyncSource');

export const DirectorySyncRunDTO = z
  .object({
    id: z.number().int(),
    sourceId: z.number().int(),
    sourceName: z.string().nullable().optional(),
    triggerType: z.enum(DIRECTORY_SYNC_TRIGGER_TYPES),
    dryRun: z.boolean(),
    status: z.enum(DIRECTORY_SYNC_RUN_STATUSES),
    totalFetched: z.number().int(),
    deptCreated: z.number().int(),
    deptUpdated: z.number().int(),
    userCreated: z.number().int(),
    userLinked: z.number().int(),
    userUpdated: z.number().int(),
    userDisabled: z.number().int(),
    skipped: z.number().int(),
    conflictCount: z.number().int(),
    failedCount: z.number().int(),
    message: z.string().nullable(),
    errorMessage: z.string().nullable(),
    triggeredBy: z.number().int().nullable(),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('DirectorySyncRun');

export const DirectorySyncRunItemDTO = z
  .object({
    id: z.number().int(),
    runId: z.number().int(),
    entityType: z.enum(DIRECTORY_SYNC_ENTITY_TYPES),
    externalId: z.string(),
    name: z.string().nullable(),
    action: z.enum(DIRECTORY_SYNC_ITEM_ACTIONS),
    applied: z.boolean(),
    diff: diffSchema,
    message: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi('DirectorySyncRunItem');

export const DirectorySyncConflictDTO = z
  .object({
    id: z.number().int(),
    sourceId: z.number().int(),
    sourceName: z.string().nullable().optional(),
    runId: z.number().int().nullable(),
    entityType: z.enum(DIRECTORY_SYNC_ENTITY_TYPES),
    externalId: z.string(),
    name: z.string().nullable(),
    conflictType: z.enum(DIRECTORY_SYNC_CONFLICT_TYPES),
    sourceData: z.record(z.string(), z.unknown()).nullable(),
    localData: z.record(z.string(), z.unknown()).nullable(),
    candidateUserIds: z.array(z.number().int()),
    status: z.enum(DIRECTORY_SYNC_CONFLICT_STATUSES),
    resolution: z.enum(DIRECTORY_SYNC_RESOLUTIONS).nullable(),
    resolvedBy: z.number().int().nullable(),
    resolvedByNickname: z.string().nullable().optional(),
    resolvedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('DirectorySyncConflict');

export const DirectorySyncConnectionTestDTO = z
  .object({
    ok: z.boolean(),
    message: z.string(),
    sampleUsers: z.array(z.object({
      externalId: z.string(),
      username: z.string(),
      nickname: z.string(),
    })),
  })
  .openapi('DirectorySyncConnectionTest');
