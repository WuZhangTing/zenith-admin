import { useQuery } from '@tanstack/react-query';
import { request } from '@/utils/request';
import { unwrap } from '@/lib/query';

export interface OpsOverviewSection<T> {
  available: boolean;
  reason: string | null;
  data: T | null;
}

export interface OpsHostSnapshot {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpuUsage: number;
  cpuCores: number;
  load1: number;
  memUsagePercent: number;
  memTotal: number;
  memUsed: number;
  diskUsagePercent: number | null;
  diskTotal: number | null;
  diskUsed: number | null;
  diskMount: string | null;
  databaseOk: boolean;
  databaseConnections: number | null;
  redisOk: boolean;
}

export interface OpsOverview {
  host: OpsOverviewSection<OpsHostSnapshot>;
  docker: OpsOverviewSection<{ total: number; running: number; stopped: number }>;
  services: OpsOverviewSection<{ total: number; active: number; failed: number }>;
  ssl: OpsOverviewSection<{ total: number; expiring: number; expired: number }>;
  firewall: OpsOverviewSection<{ type: string; enabled: boolean }>;
  nginx: OpsOverviewSection<{ version: string | null; running: boolean; siteCount: number; enabledCount: number }>;
  terminals: OpsOverviewSection<{ active: number }>;
  ports: OpsOverviewSection<{ listening: number }>;
  generatedAt: string;
}

export const opsOverviewKeys = {
  all: ['ops-overview'] as const,
};

export function useOpsOverview() {
  return useQuery({
    queryKey: opsOverviewKeys.all,
    queryFn: () => request.get<OpsOverview>('/api/ops-overview').then(unwrap),
    // 概览是运行态快照,页面停留期间保持轮询
    refetchInterval: 30_000,
  });
}
