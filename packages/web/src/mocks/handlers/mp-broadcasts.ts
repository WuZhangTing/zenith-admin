import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockMpBroadcasts, getNextMpBroadcastId } from '@/mocks/data/mp-broadcasts';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpBroadcast } from '@zenith/shared/mp';

export const mpBroadcastsHandlers = [
  http.get('/api/mp/broadcasts', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockMpBroadcasts.filter((b) => b.accountId === accountId && (!status || b.status === status));
    const total = filtered.length;
    const list = [...filtered].sort((a, b) => b.id - a.id).slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  http.post('/api/mp/broadcasts', async ({ request }) => {
    const body = await request.json() as Partial<MpBroadcast> & { accountId: number };
    const now = mockDateTime();
    const item: MpBroadcast = {
      id: getNextMpBroadcastId(), accountId: body.accountId, msgType: body.msgType ?? 'text', target: body.target ?? 'all',
      tagId: body.target === 'tag' ? (body.tagId ?? null) : null,
      content: body.msgType === 'text' ? (body.content ?? null) : null,
      mediaId: body.msgType === 'text' ? null : (body.mediaId ?? null),
      status: 'draft', wechatMsgId: null, scheduledAt: body.scheduledAt ?? null, errorMsg: null, sentAt: null, createdAt: now, updatedAt: now,
    };
    mockMpBroadcasts.push(item);
    return ok(item, '已创建群发草稿');
  }),

  http.put('/api/mp/broadcasts/:id', async ({ params, request }) => {
    const b = mockMpBroadcasts.find((x) => x.id === Number(params.id));
    if (!b) return notFound('群发记录不存在', { status: 404 });
    if (b.status === 'sent') return badRequest('已发送的群发不可修改', { status: 400 });
    const body = await request.json() as Partial<MpBroadcast>;
    Object.assign(b, body, { updatedAt: mockDateTime() });
    if (b.target === 'all') b.tagId = null;
    if (b.msgType === 'text') b.mediaId = null; else b.content = null;
    return ok(b, '更新成功');
  }),

  http.post('/api/mp/broadcasts/:id/send', ({ params }) => {
    const b = mockMpBroadcasts.find((x) => x.id === Number(params.id));
    if (!b) return notFound('群发记录不存在', { status: 404 });
    if (b.status === 'sent') return badRequest('该群发已发送', { status: 400 });
    b.status = 'sent';
    b.wechatMsgId = `mock_mass_${Date.now()}`;
    b.errorMsg = null;
    b.sentAt = mockDateTime();
    b.updatedAt = mockDateTime();
    return ok(b, '发送成功');
  }),

  http.post('/api/mp/broadcasts/:id/preview', async ({ params }) => {
    const b = mockMpBroadcasts.find((x) => x.id === Number(params.id));
    if (!b) return notFound('群发记录不存在', { status: 404 });
    return ok(null, '预览已发送');
  }),

  http.get('/api/mp/broadcasts/:id/result', ({ params }) => {
    const b = mockMpBroadcasts.find((x) => x.id === Number(params.id));
    if (!b) return notFound('群发记录不存在', { status: 404 });
    if (!b.wechatMsgId) return badRequest('该群发尚未发送，无发送结果', { status: 400 });
    return ok({ msgStatus: 'SEND_SUCCESS', totalCount: 2, filterCount: 2, sentCount: 2, errorCount: 0 });
  }),

  http.delete('/api/mp/broadcasts/:id', ({ params }) => {
    const idx = mockMpBroadcasts.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('群发记录不存在', { status: 404 });
    mockMpBroadcasts.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
