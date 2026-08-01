import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockMpFans } from '@/mocks/data/mp-fans';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpFan } from '@zenith/shared/mp';

export const mpFansHandlers = [
  http.get('/api/mp/fans', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const keyword = url.searchParams.get('keyword') ?? '';
    const subscribe = url.searchParams.get('subscribe') ?? '';
    const tagId = url.searchParams.get('tagId');
    const blacklisted = url.searchParams.get('blacklisted');
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockMpFans.filter((f) => {
      if (f.accountId !== accountId) return false;
      if (keyword && !(f.nickname ?? '').includes(keyword) && !f.openid.includes(keyword) && !(f.remark ?? '').includes(keyword)) return false;
      if (subscribe && f.subscribe !== subscribe) return false;
      if (tagId && !f.tagIds.includes(Number(tagId))) return false;
      if (blacklisted && f.blacklisted !== (blacklisted === 'true')) return false;
      return true;
    });
    const total = filtered.length;
    const sorted = [...filtered].sort((a, b) => b.id - a.id);
    const list = sorted.slice((page - 1) * pageSize, page * pageSize);
    return ok({ list, total, page, pageSize });
  }),

  http.post('/api/mp/fans/sync', async ({ request }) => {
    const body = await request.json() as { accountId: number };
    const count = mockMpFans.filter((f) => f.accountId === body.accountId).length;
    return ok({ success: true, synced: count, total: count }, '同步完成');
  }),

  http.post('/api/mp/fans/blacklist', async ({ request }) => {
    const body = await request.json() as { accountId: number; openids: string[] };
    for (const f of mockMpFans) if (f.accountId === body.accountId && body.openids.includes(f.openid)) f.blacklisted = true;
    return ok({ success: true, count: body.openids.length }, '已拉黑');
  }),

  http.post('/api/mp/fans/unblacklist', async ({ request }) => {
    const body = await request.json() as { accountId: number; openids: string[] };
    for (const f of mockMpFans) if (f.accountId === body.accountId && body.openids.includes(f.openid)) f.blacklisted = false;
    return ok({ success: true, count: body.openids.length }, '已移出');
  }),

  http.post('/api/mp/fans/sync-blacklist', async ({ request }) => {
    const body = await request.json() as { accountId: number };
    const count = mockMpFans.filter((f) => f.accountId === body.accountId && f.blacklisted).length;
    return ok({ success: true, synced: count, total: count }, '同步完成');
  }),

  http.put('/api/mp/fans/:id', async ({ params, request }) => {
    const f = mockMpFans.find((x) => x.id === Number(params.id));
    if (!f) return notFound('粉丝不存在', { status: 404 });
    const body = await request.json() as Partial<Pick<MpFan, 'remark' | 'tagIds'>>;
    if (body.remark !== undefined) f.remark = body.remark || null;
    if (body.tagIds !== undefined) f.tagIds = body.tagIds;
    f.updatedAt = mockDateTime();
    return ok(f, '更新成功');
  }),

  http.post('/api/mp/fans/:id/create-member', ({ params }) => {
    const f = mockMpFans.find((x) => x.id === Number(params.id));
    if (!f) return notFound('粉丝不存在', { status: 404 });
    if (f.memberId) return badRequest('该粉丝已绑定会员', { status: 400 });
    f.memberId = 9000 + f.id;
    f.updatedAt = mockDateTime();
    return ok(f, '会员已创建并绑定');
  }),

  http.post('/api/mp/fans/:id/bind-member', async ({ params, request }) => {
    const f = mockMpFans.find((x) => x.id === Number(params.id));
    if (!f) return notFound('粉丝不存在', { status: 404 });
    const body = await request.json() as { memberId: number };
    f.memberId = body.memberId;
    f.updatedAt = mockDateTime();
    return ok(f, '绑定成功');
  }),

  http.post('/api/mp/fans/:id/unbind-member', ({ params }) => {
    const f = mockMpFans.find((x) => x.id === Number(params.id));
    if (!f) return notFound('粉丝不存在', { status: 404 });
    f.memberId = null;
    f.updatedAt = mockDateTime();
    return ok(f, '已解绑');
  }),
];
