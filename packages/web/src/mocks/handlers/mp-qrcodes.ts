import { http } from 'msw';
import { ok, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockMpQrcodes, getNextMpQrcodeId } from '@/mocks/data/mp-qrcodes';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpQrcode } from '@zenith/shared/mp';

export const mpQrcodesHandlers = [
  http.get('/api/mp/qrcodes', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const type = url.searchParams.get('type') ?? '';
    const keyword = url.searchParams.get('keyword') ?? '';
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockMpQrcodes.filter((q) => {
      if (q.accountId !== accountId) return false;
      if (type && q.type !== type) return false;
      if (keyword && !q.name.includes(keyword) && !q.sceneStr.includes(keyword)) return false;
      return true;
    });
    const total = filtered.length;
    const list = [...filtered].sort((a, b) => b.id - a.id).slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  http.post('/api/mp/qrcodes', async ({ request }) => {
    const body = await request.json() as Partial<MpQrcode> & { accountId: number };
    const now = mockDateTime();
    const ticket = `MOCK_TICKET_${Date.now()}`;
    const item: MpQrcode = {
      id: getNextMpQrcodeId(), accountId: body.accountId, type: body.type ?? 'permanent', sceneStr: body.sceneStr ?? '',
      name: body.name ?? '', ticket, url: `https://mp.weixin.qq.com/cgi-bin/showqrcode?ticket=${ticket}`,
      expireSeconds: body.type === 'temporary' ? (body.expireSeconds ?? 604800) : null, scanCount: 0, rewardPoints: body.rewardPoints ?? 0, createdAt: now, updatedAt: now,
    };
    mockMpQrcodes.push(item);
    return ok(item, '生成成功');
  }),

  http.delete('/api/mp/qrcodes/:id', ({ params }) => {
    const idx = mockMpQrcodes.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('二维码不存在', { status: 404 });
    mockMpQrcodes.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
