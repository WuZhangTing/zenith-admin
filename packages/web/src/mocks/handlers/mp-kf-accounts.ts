import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { mockMpKfAccounts, getNextMpKfAccountId } from '@/mocks/data/mp-kf-accounts';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpKfAccount } from '@zenith/shared/mp';

export const mpKfAccountsHandlers = [
  http.get('/api/mp/kf-accounts', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const keyword = url.searchParams.get('keyword') ?? '';
    const filtered = mockMpKfAccounts.filter((k) => k.accountId === accountId && (!keyword || k.nickname.includes(keyword)));
    return ok(paginate(filtered, url, 20));
  }),

  http.post('/api/mp/kf-accounts/sync', () => ok({ success: true, created: 0, updated: mockMpKfAccounts.length, total: mockMpKfAccounts.length }, '同步完成')),

  http.post('/api/mp/kf-accounts', async ({ request }) => {
    const body = await request.json() as { accountId: number; kfAccount: string; nickname: string };
    if (mockMpKfAccounts.some((k) => k.accountId === body.accountId && k.kfAccount === body.kfAccount)) {
      return badRequest('该客服账号已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: MpKfAccount = {
      id: getNextMpKfAccountId(), accountId: body.accountId, kfAccount: body.kfAccount, nickname: body.nickname,
      avatar: null, kfId: null, inviteStatus: 'none', inviteWx: null, status: 'enabled', createdAt: now, updatedAt: now,
    };
    mockMpKfAccounts.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/mp/kf-accounts/:id', async ({ params, request }) => {
    const k = mockMpKfAccounts.find((x) => x.id === Number(params.id));
    if (!k) return notFound('客服账号不存在', { status: 404 });
    const body = await request.json() as { nickname: string };
    k.nickname = body.nickname;
    k.updatedAt = mockDateTime();
    return ok(k, '更新成功');
  }),

  http.delete('/api/mp/kf-accounts/:id', ({ params }) => {
    const idx = mockMpKfAccounts.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('客服账号不存在', { status: 404 });
    mockMpKfAccounts.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
