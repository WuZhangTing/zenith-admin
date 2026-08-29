import { describe, expect, it } from 'vitest';
import { parseSsOutput } from './ports.service';

describe('parseSsOutput', () => {
  it('解析现代 ss -tulnp 输出的协议、地址、端口与进程', () => {
    const rows = parseSsOutput([
      'Netid State  Recv-Q Send-Q Local Address:Port Peer Address:PortProcess',
      'tcp   LISTEN 0      128          0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=1,fd=6))',
      'udp   UNCONN 0      0          127.0.0.1:53        0.0.0.0:*    users:(("dnsmasq",pid=42,fd=5))',
    ].join('\n'));
    expect(rows).toEqual([
      {
        protocol: 'tcp',
        localAddress: '0.0.0.0',
        localPort: 22,
        state: 'LISTEN',
        pid: 1,
        processName: 'sshd',
        serviceName: null,
      },
      {
        protocol: 'udp',
        localAddress: '127.0.0.1',
        localPort: 53,
        state: 'UNCONN',
        pid: 42,
        processName: 'dnsmasq',
        serviceName: null,
      },
    ]);
  });
});
