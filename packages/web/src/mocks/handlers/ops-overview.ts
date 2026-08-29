import { http } from 'msw';
import { ok } from '@/mocks/utils/handlers';
import { mockDateTime } from '@/mocks/utils/date';

const API = import.meta.env.VITE_API_BASE_URL || '';

function section<T>(data: T) {
  return { available: true, reason: null, data };
}

export const opsOverviewHandlers = [
  http.get(`${API}/api/ops-overview`, () =>
    ok({
      host: section({
        hostname: 'demo-server',
        platform: 'linux',
        uptimeSeconds: 86400 * 12 + 3600 * 5,
        cpuUsage: 32,
        cpuCores: 8,
        load1: 1.24,
        memUsagePercent: 58,
        memTotal: 16 * 1024 ** 3,
        memUsed: 9.3 * 1024 ** 3,
        diskUsagePercent: 71,
        diskTotal: 512 * 1024 ** 3,
        diskUsed: 363 * 1024 ** 3,
        diskMount: '/',
        databaseOk: true,
        databaseConnections: 12,
        redisOk: true,
      }),
      docker: section({ total: 6, running: 5, stopped: 1 }),
      services: section({ total: 128, active: 96, failed: 1 }),
      ssl: section({ total: 4, expiring: 1, expired: 0 }),
      firewall: section({ type: 'ufw', enabled: true }),
      nginx: section({ version: '1.24.0', running: true, siteCount: 3, enabledCount: 2 }),
      terminals: section({ active: 2 }),
      ports: section({ listening: 18 }),
      hosts: section([
        {
          id: 1,
          name: '生产应用节点',
          address: 'ops@10.0.10.21:22',
          status: 'online',
          snapshot: { cpuCores: 8, load1: 1.2, memUsagePercent: 56, diskUsagePercent: 52 },
          probedAt: mockDateTime(),
          probeError: null,
        },
        {
          id: 2,
          name: '测试节点',
          address: 'deploy@10.0.20.31:22',
          status: 'offline',
          snapshot: null,
          probedAt: mockDateTime(),
          probeError: 'SSH 连接超时',
        },
      ]),
      generatedAt: mockDateTime(),
    })),
];
