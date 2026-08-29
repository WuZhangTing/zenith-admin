import { describe, expect, it } from 'vitest';
import { parseSnapshotOutput } from './hosts.service';

describe('parseSnapshotOutput', () => {
  it('解析 Linux 主机资源快照', () => {
    const result = parseSnapshotOutput([
      '@@KERNEL',
      'Linux 6.1.0-amd64',
      '@@OS',
      'Debian GNU/Linux 12 (bookworm)',
      '@@UPTIME',
      '12345.67 999.00',
      '@@CPU',
      '8',
      '@@LOAD',
      '1.25 0.80 0.50 1/200 123',
      '@@MEM',
      'Mem: 16000000000 6000000000 10000000000 0 0 0',
      '@@DISK',
      '/dev/sda1 200000000000 50000000000 150000000000 25% /',
      '',
    ].join('\n'));

    expect(result).toEqual({
      kernel: 'Linux 6.1.0-amd64',
      osName: 'Debian GNU/Linux 12 (bookworm)',
      uptimeSeconds: 12345,
      cpuCores: 8,
      load1: 1.25,
      memTotalBytes: 16_000_000_000,
      memUsedBytes: 6_000_000_000,
      memUsagePercent: 38,
      diskTotalBytes: 200_000_000_000,
      diskUsedBytes: 50_000_000_000,
      diskUsagePercent: 25,
    });
  });

  it('缺失命令时对应字段返回 null', () => {
    expect(parseSnapshotOutput('@@KERNEL\nLinux\n@@MEM\n')).toEqual({
      kernel: 'Linux',
      osName: null,
      uptimeSeconds: null,
      cpuCores: null,
      load1: null,
      memTotalBytes: null,
      memUsedBytes: null,
      memUsagePercent: null,
      diskTotalBytes: null,
      diskUsedBytes: null,
      diskUsagePercent: null,
    });
  });
});
