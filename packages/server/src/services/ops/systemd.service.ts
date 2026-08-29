import { resolveExecutor } from '../../lib/host-exec';

export interface ServiceInfo {
  name: string;
  description: string;
  loadState: string;
  activeState: string;
  subState: string;
}

export async function isSystemdAvailable(hostId?: number | null): Promise<boolean> {
  try {
    await (await resolveExecutor(hostId)).exec('systemctl', ['--version'], { timeoutMs: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function listServices(hostId?: number | null): Promise<ServiceInfo[]> {
  const { stdout } = await (await resolveExecutor(hostId)).exec('systemctl', [
    'list-units', '--type=service', '--all', '--no-pager', '--plain', '--no-legend',
  ], { timeoutMs: 15000 });

  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        name: (parts[0] ?? '').replace(/\.service$/, ''),
        loadState: parts[1] ?? '',
        activeState: parts[2] ?? '',
        subState: parts[3] ?? '',
        description: parts.slice(4).join(' '),
      };
    });
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable' | 'mask' | 'unmask';

export async function controlService(
  name: string,
  action: ServiceAction,
  hostId?: number | null,
): Promise<void> {
  await (await resolveExecutor(hostId)).exec('systemctl', [action, `${name}.service`], { timeoutMs: 30000 });
}

/** 获取服务详情（systemctl show 选取关键字段） */
export async function getServiceDetail(name: string, hostId?: number | null): Promise<Record<string, string>> {
  const props = [
    'Id', 'Description', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState',
    'MainPID', 'ExecMainStartTimestamp', 'MemoryCurrent', 'CPUUsageNSec',
    'Restart', 'FragmentPath', 'TriggeredBy', 'Requires', 'WantedBy',
  ];
  try {
    const { stdout } = await (await resolveExecutor(hostId)).exec('systemctl', [
      'show', `${name}.service`, '--no-pager', '-p', props.join(','),
    ], { timeoutMs: 10000 });
    const detail: Record<string, string> = {};
    for (const line of stdout.trim().split('\n')) {
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      detail[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return detail;
  } catch {
    return {};
  }
}

export async function getServiceLogs(name: string, lines = 100, hostId?: number | null): Promise<string> {
  try {
    const { stdout } = await (await resolveExecutor(hostId)).exec('journalctl', [
      '-u', `${name}.service`, '-n', String(lines), '--no-pager', '--output=short-iso',
    ], { timeoutMs: 10000 });
    return stdout;
  } catch {
    return '';
  }
}

/** 流式 journalctl -f（本机与远端统一走 HostExecutor） */
export async function tailServiceLogs(
  name: string,
  onData: (chunk: string) => void,
  onExit: (code: number | null) => void,
  hostId?: number | null,
): Promise<{ kill: () => void }> {
  return (await resolveExecutor(hostId)).execStream(
    'journalctl',
    ['-u', `${name}.service`, '-f', '--no-pager', '--output=short-iso'],
    { onData, onExit },
  );
}
