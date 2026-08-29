import { describe, expect, it } from 'vitest';
import { parseUnixProcessList } from './processes.service';

describe('parseUnixProcessList', () => {
  it('解析 Linux ps 固定字段输出', () => {
    const rows = parseUnixProcessList([
      '1 0 root S 0.1 0.2 2048 1 0 init',
      '42 1 app R 12.5 3.4 40960 8 5 node worker',
    ].join('\n'));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      pid: 1, ppid: 0, user: 'root', name: 'init', status: 'sleeping',
      memory: 2 * 1024 * 1024, threads: 1, nice: 0,
    });
    expect(rows[1]).toMatchObject({
      pid: 42, ppid: 1, user: 'app', name: 'node worker', status: 'running',
      cpu: 12.5, memoryPercent: 3.4, memory: 40 * 1024 * 1024, threads: 8, nice: 5,
    });
  });

  it('忽略格式不完整和无效 PID 行', () => {
    expect(parseUnixProcessList('header\n0 0 root S 0 0 0 1 0 bad\n')).toEqual([]);
  });
});
