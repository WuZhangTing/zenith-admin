import { http } from 'msw';
import type { OpsHost } from '@zenith/shared/ops';
import { mockDateTime } from '@/mocks/utils/date';
import { ok, notFound } from '@/mocks/utils/handlers';

const API = import.meta.env.VITE_API_BASE_URL || '';

let nextId = 3;
const hosts: OpsHost[] = [
  {
    id: 1,
    name: '生产应用节点',
    host: '10.0.10.21',
    port: 22,
    username: 'ops',
    authType: 'key_content',
    hasPassword: false,
    hasKeyContent: true,
    hasKeyPassphrase: false,
    hostKeyFingerprint: 'demo-fingerprint-production',
    status: 'online',
    snapshot: {
      kernel: 'Linux 6.1.0',
      osName: 'Debian GNU/Linux 12',
      uptimeSeconds: 725400,
      cpuCores: 8,
      load1: 1.2,
      memTotalBytes: 16 * 1024 ** 3,
      memUsedBytes: 9 * 1024 ** 3,
      memUsagePercent: 56,
      diskTotalBytes: 256 * 1024 ** 3,
      diskUsedBytes: 132 * 1024 ** 3,
      diskUsagePercent: 52,
    },
    probedAt: mockDateTime(),
    probeError: null,
    enabled: true,
    remark: '生产应用服务',
    createdAt: mockDateTime(),
    updatedAt: mockDateTime(),
  },
  {
    id: 2,
    name: '测试节点',
    host: '10.0.20.31',
    port: 22,
    username: 'deploy',
    authType: 'password',
    hasPassword: true,
    hasKeyContent: false,
    hasKeyPassphrase: false,
    hostKeyFingerprint: null,
    status: 'offline',
    snapshot: null,
    probedAt: mockDateTime(),
    probeError: 'SSH 连接超时',
    enabled: true,
    remark: null,
    createdAt: mockDateTime(),
    updatedAt: mockDateTime(),
  },
];

export const opsHostHandlers = [
  http.get(`${API}/api/ops-hosts`, () => ok(hosts)),
  http.get(`${API}/api/ops-hosts/:id`, ({ params }) => {
    const host = hosts.find((item) => item.id === Number(params.id));
    return host ? ok(host) : notFound('主机不存在', { status: 404 });
  }),
  http.post(`${API}/api/ops-hosts`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = mockDateTime();
    const host: OpsHost = {
      id: nextId++,
      name: String(body.name),
      host: String(body.host),
      port: Number(body.port ?? 22),
      username: String(body.username),
      authType: body.authType === 'key_content' ? 'key_content' : 'password',
      hasPassword: !!body.password,
      hasKeyContent: !!body.keyContent,
      hasKeyPassphrase: !!body.keyPassphrase,
      hostKeyFingerprint: null,
      status: 'unknown',
      snapshot: null,
      probedAt: null,
      probeError: null,
      enabled: body.enabled !== false,
      remark: typeof body.remark === 'string' ? body.remark : null,
      createdAt: now,
      updatedAt: now,
    };
    hosts.unshift(host);
    return ok(host, '已创建');
  }),
  http.post(`${API}/api/ops-hosts/import-ssh-profile/:profileId`, ({ params }) => {
    const id = Number(params.profileId);
    const now = mockDateTime();
    const host: OpsHost = {
      id: nextId++,
      name: `SSH 配置 ${id}`,
      host: `ssh-${id}.example.internal`,
      port: 22,
      username: 'ops',
      authType: 'key_content',
      hasPassword: false,
      hasKeyContent: true,
      hasKeyPassphrase: false,
      hostKeyFingerprint: null,
      status: 'unknown',
      snapshot: null,
      probedAt: null,
      probeError: null,
      enabled: true,
      remark: `从 SSH 配置 ${id} 导入`,
      createdAt: now,
      updatedAt: now,
    };
    hosts.unshift(host);
    return ok(host, '已导入');
  }),
  http.put(`${API}/api/ops-hosts/:id`, async ({ params, request }) => {
    const index = hosts.findIndex((item) => item.id === Number(params.id));
    if (index < 0) return notFound('主机不存在', { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const current = hosts[index];
    const {
      password,
      keyContent,
      keyPassphrase,
      ...safeBody
    } = body;
    hosts[index] = {
      ...current,
      ...Object.fromEntries(Object.entries(safeBody).filter(([, value]) => value !== undefined)),
      id: current.id,
      authType: body.authType === 'key_content' ? 'key_content' : body.authType === 'password' ? 'password' : current.authType,
      hasPassword: password ? true : current.hasPassword,
      hasKeyContent: keyContent ? true : current.hasKeyContent,
      hasKeyPassphrase: keyPassphrase ? true : current.hasKeyPassphrase,
      updatedAt: mockDateTime(),
    } as OpsHost;
    return ok(hosts[index], '已更新');
  }),
  http.delete(`${API}/api/ops-hosts/:id`, ({ params }) => {
    const index = hosts.findIndex((item) => item.id === Number(params.id));
    if (index < 0) return notFound('主机不存在', { status: 404 });
    hosts.splice(index, 1);
    return ok(null, '已删除');
  }),
  http.post(`${API}/api/ops-hosts/probe-all`, () => ok(hosts)),
  http.post(`${API}/api/ops-hosts/:id/test`, ({ params }) => {
    const host = hosts.find((item) => item.id === Number(params.id));
    return host ? ok({ ok: host.status !== 'offline', message: host.status === 'offline' ? 'SSH 连接超时' : '连接成功', latencyMs: host.status === 'offline' ? null : 32 }) : notFound('主机不存在', { status: 404 });
  }),
  http.post(`${API}/api/ops-hosts/:id/probe`, ({ params }) => {
    const host = hosts.find((item) => item.id === Number(params.id));
    return host ? ok(host) : notFound('主机不存在', { status: 404 });
  }),
  http.post(`${API}/api/ops-hosts/:id/reset-host-key`, ({ params }) => {
    const host = hosts.find((item) => item.id === Number(params.id));
    if (!host) return notFound('主机不存在', { status: 404 });
    host.hostKeyFingerprint = null;
    return ok(null, '已重置');
  }),
];
