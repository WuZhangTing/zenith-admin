/**
 * 运维概览聚合
 *
 * 一次请求并行探测系统运维目录各能力面的健康快照。每个分区独立容错:
 * 单项失败或超时只标记该分区 unavailable,绝不拖垮整个概览。
 * 各分区数据复用对应领域服务的既有函数,不重复实现采集逻辑。
 */
import { getMonitorStatus } from '../platform/monitor.service';
import { listEvents } from '../platform/monitor-alert.service';
import { listContainers } from './docker.service';
import { isSystemdAvailable, listServices } from './systemd.service';
import { listSslCertificates } from './ssl-certificates.service';
import { getFirewallStatus } from './firewall.service';
import { getNginxInfo, listNginxSites } from './nginx-sites.service';
import { getListeningPorts } from './ports.service';
import { listTerminalSessions } from './terminal-sessions.service';
import { formatDateTime } from '../../lib/datetime';

export interface OpsOverviewSection<T> {
  available: boolean;
  reason: string | null;
  data: T | null;
}

/** 单分区探测超时;超时按不可用处理,不阻塞整体响应 */
const SECTION_TIMEOUT_MS = 8000;
/** 主机快照聚合了磁盘 / DB / Redis / 温度等多路采集,Windows 下子命令较慢,单独放宽 */
const HOST_SECTION_TIMEOUT_MS = 20000;

async function section<T>(probe: () => Promise<T>, timeoutMs = SECTION_TIMEOUT_MS): Promise<OpsOverviewSection<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      probe(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('探测超时')), timeoutMs);
      }),
    ]);
    return { available: true, reason: null, data };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : String(err), data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface HostSnapshot {
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

async function probeHost(): Promise<HostSnapshot> {
  const status = await getMonitorStatus();
  return {
    hostname: status.os.hostname,
    platform: status.os.platform,
    uptimeSeconds: status.os.uptimeSeconds,
    cpuUsage: status.cpu.usage,
    cpuCores: status.cpu.cores,
    load1: status.cpu.loadAvg[0] ?? 0,
    memUsagePercent: status.memory.usagePercent,
    memTotal: status.memory.total,
    memUsed: status.memory.used,
    diskUsagePercent: status.disk?.usagePercent ?? null,
    diskTotal: status.disk?.total ?? null,
    diskUsed: status.disk?.used ?? null,
    diskMount: status.disk?.mount ?? null,
    databaseOk: status.database != null,
    databaseConnections: status.database?.totalConnections ?? null,
    redisOk: status.redis != null,
  };
}

export interface DockerSnapshot {
  total: number;
  running: number;
  stopped: number;
}

async function probeDocker(): Promise<DockerSnapshot> {
  const containers = await listContainers();
  const running = containers.filter((c) => c.state === 'running').length;
  return { total: containers.length, running, stopped: containers.length - running };
}

export interface ServicesSnapshot {
  total: number;
  active: number;
  failed: number;
}

async function probeServices(): Promise<ServicesSnapshot> {
  if (!(await isSystemdAvailable())) throw new Error('当前主机不支持 systemd');
  const services = await listServices();
  return {
    total: services.length,
    active: services.filter((s) => s.activeState === 'active').length,
    failed: services.filter((s) => s.activeState === 'failed').length,
  };
}

export interface SslSnapshot {
  total: number;
  expiring: number;
  expired: number;
}

async function probeSsl(): Promise<SslSnapshot> {
  const { list, total } = await listSslCertificates({ page: 1, pageSize: 500 });
  return {
    total,
    expiring: list.filter((c) => c.status === 'expiring').length,
    expired: list.filter((c) => c.status === 'expired').length,
  };
}

export interface FirewallSnapshot {
  type: string;
  enabled: boolean;
}

async function probeFirewall(): Promise<FirewallSnapshot> {
  const status = await getFirewallStatus();
  if (status.type === 'unknown') throw new Error('未检测到受支持的防火墙(ufw / firewalld / iptables)');
  return { type: status.type, enabled: status.enabled };
}

export interface NginxSnapshot {
  version: string | null;
  running: boolean;
  siteCount: number;
  enabledCount: number;
}

async function probeNginx(): Promise<NginxSnapshot> {
  const info = await getNginxInfo();
  if (!info.installed) throw new Error('当前主机未安装 Nginx');
  const sites = await listNginxSites();
  return {
    version: info.version,
    running: info.runningStatus === 'running',
    siteCount: sites.length,
    enabledCount: sites.filter((s) => s.enabled).length,
  };
}

export interface TerminalsSnapshot {
  active: number;
}

export interface PortsSnapshot {
  listening: number;
}

export interface AlertEventBrief {
  id: number;
  ruleName: string;
  metric: string;
  level: string;
  message: string;
  triggeredAt: string | null;
}

export interface AlertsSnapshot {
  firing: number;
  events: AlertEventBrief[];
}

async function probeAlerts(): Promise<AlertsSnapshot> {
  const { list, total } = await listEvents({ page: 1, pageSize: 5, status: 'firing' });
  return {
    firing: total,
    events: list.map((e) => ({
      id: e.id,
      ruleName: e.ruleName,
      metric: e.metric,
      level: e.level,
      message: e.message,
      triggeredAt: e.triggeredAt ?? null,
    })),
  };
}

export interface OpsOverview {
  host: OpsOverviewSection<HostSnapshot>;
  docker: OpsOverviewSection<DockerSnapshot>;
  services: OpsOverviewSection<ServicesSnapshot>;
  ssl: OpsOverviewSection<SslSnapshot>;
  firewall: OpsOverviewSection<FirewallSnapshot>;
  nginx: OpsOverviewSection<NginxSnapshot>;
  terminals: OpsOverviewSection<TerminalsSnapshot>;
  ports: OpsOverviewSection<PortsSnapshot>;
  alerts: OpsOverviewSection<AlertsSnapshot>;
  generatedAt: string;
}

export async function getOpsOverview(): Promise<OpsOverview> {
  const [host, docker, services, ssl, firewall, nginx, terminals, ports, alerts] = await Promise.all([
    section(probeHost, HOST_SECTION_TIMEOUT_MS),
    section(probeDocker),
    section(probeServices),
    section(probeSsl),
    section(probeFirewall),
    section(probeNginx),
    section(async () => ({ active: listTerminalSessions({ page: 1, pageSize: 1 }).total })),
    section(async () => ({ listening: (await getListeningPorts()).length })),
    section(probeAlerts),
  ]);
  return {
    host, docker, services, ssl, firewall, nginx, terminals, ports, alerts,
    generatedAt: formatDateTime(new Date()),
  };
}
