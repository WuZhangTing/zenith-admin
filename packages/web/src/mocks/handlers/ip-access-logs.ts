import { http } from 'msw';
import { ok, pageParams } from '@/mocks/utils/handlers';
import { mockIpAccessLogs } from '@/mocks/data/logs';

export const ipAccessLogsHandlers = [
  http.get('/api/ip-access-logs', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url, 20);
    const ip = url.searchParams.get('ip') ?? '';
    const blockType = url.searchParams.get('blockType') ?? '';

    let list = mockIpAccessLogs.filter((log) => {
      if (ip && !log.ip.includes(ip)) return false;
      if (blockType && log.blockType !== blockType) return false;
      return true;
    });
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),
];
