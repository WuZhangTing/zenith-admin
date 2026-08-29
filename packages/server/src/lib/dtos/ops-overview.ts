/**
 * 运维概览 DTO
 */
import { z } from '@hono/zod-openapi';

/** 分区包装:单项探测失败只标记不可用,不影响其他分区 */
function sectionOf<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    available: z.boolean(),
    reason: z.string().nullable(),
    data: data.nullable(),
  });
}

const HostSnapshotDTO = z.object({
  hostname: z.string(),
  platform: z.string(),
  uptimeSeconds: z.number(),
  cpuUsage: z.number(),
  cpuCores: z.number(),
  load1: z.number(),
  memUsagePercent: z.number(),
  memTotal: z.number(),
  memUsed: z.number(),
  diskUsagePercent: z.number().nullable(),
  diskTotal: z.number().nullable(),
  diskUsed: z.number().nullable(),
  diskMount: z.string().nullable(),
  databaseOk: z.boolean(),
  databaseConnections: z.number().nullable(),
  redisOk: z.boolean(),
});

export const OpsOverviewDTO = z
  .object({
    host: sectionOf(HostSnapshotDTO),
    docker: sectionOf(z.object({ total: z.number(), running: z.number(), stopped: z.number() })),
    services: sectionOf(z.object({ total: z.number(), active: z.number(), failed: z.number() })),
    ssl: sectionOf(z.object({ total: z.number(), expiring: z.number(), expired: z.number() })),
    firewall: sectionOf(z.object({ type: z.string(), enabled: z.boolean() })),
    nginx: sectionOf(z.object({
      version: z.string().nullable(),
      running: z.boolean(),
      siteCount: z.number(),
      enabledCount: z.number(),
    })),
    terminals: sectionOf(z.object({ active: z.number() })),
    ports: sectionOf(z.object({ listening: z.number() })),
    generatedAt: z.string(),
  })
  .openapi('OpsOverview');
