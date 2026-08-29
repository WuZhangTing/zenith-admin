/**
 * 运维主机 DTO(多主机管理)
 */
import { z } from '@hono/zod-openapi';
import { OPS_HOST_AUTH_TYPES, OPS_HOST_STATUSES } from '@zenith/shared/ops';

const OpsHostSnapshotDTO = z.object({
  kernel: z.string().nullable(),
  osName: z.string().nullable(),
  uptimeSeconds: z.number().nullable(),
  cpuCores: z.number().nullable(),
  load1: z.number().nullable(),
  memTotalBytes: z.number().nullable(),
  memUsedBytes: z.number().nullable(),
  memUsagePercent: z.number().nullable(),
  diskTotalBytes: z.number().nullable(),
  diskUsedBytes: z.number().nullable(),
  diskUsagePercent: z.number().nullable(),
});

export const OpsHostDTO = z
  .object({
    id: z.number(),
    name: z.string(),
    host: z.string(),
    port: z.number(),
    username: z.string(),
    authType: z.enum(OPS_HOST_AUTH_TYPES),
    hasPassword: z.boolean(),
    hasKeyContent: z.boolean(),
    hasKeyPassphrase: z.boolean(),
    hostKeyFingerprint: z.string().nullable(),
    status: z.enum(OPS_HOST_STATUSES),
    snapshot: OpsHostSnapshotDTO.nullable(),
    probedAt: z.string().nullable(),
    probeError: z.string().nullable(),
    enabled: z.boolean(),
    remark: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('OpsHost');

export const OpsHostTestResultDTO = z
  .object({
    ok: z.boolean(),
    message: z.string(),
    latencyMs: z.number().nullable(),
  })
  .openapi('OpsHostTestResult');
