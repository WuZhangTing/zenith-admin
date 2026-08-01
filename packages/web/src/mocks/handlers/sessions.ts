import { http } from 'msw';
import { ok, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockOnlineSessions } from '@/mocks/data/system';

export const sessionsHandlers = [
  // 在线用户列表
  http.get('/api/sessions', ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const username = url.searchParams.get('username') ?? '';

    let list = mockOnlineSessions.filter((s) => {
      if (username && !s.username.includes(username)) return false;
      return true;
    });
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  // 强制下线（demo 模式仅从列表中移除）
  http.delete('/api/sessions/:tokenId', ({ params }) => {
    const index = mockOnlineSessions.findIndex((s) => s.tokenId === params.tokenId);
    if (index === -1) return notFound('会话不存在');
    mockOnlineSessions.splice(index, 1);
    return ok(null, '已强制下线');
  }),
];
