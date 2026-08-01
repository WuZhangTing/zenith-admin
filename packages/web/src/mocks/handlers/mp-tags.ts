import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { mockMpTags, getNextMpTagId } from '@/mocks/data/mp-tags';
import { mockMpFans } from '@/mocks/data/mp-fans';
import { mockDateTime } from '@/mocks/utils/date';
import type { MpTag } from '@zenith/shared/mp';

export const mpTagsHandlers = [
  http.get('/api/mp/tags', ({ request }) => {
    const url = new URL(request.url);
    const accountId = Number(url.searchParams.get('accountId') ?? '0');
    const keyword = url.searchParams.get('keyword') ?? '';
    const filtered = mockMpTags.filter((t) => t.accountId === accountId && (!keyword || t.name.includes(keyword)));
    return ok(paginate(filtered, url, 20));
  }),

  http.post('/api/mp/tags/sync', async ({ request }) => {
    const body = await request.json() as { accountId: number };
    const total = mockMpTags.filter((t) => t.accountId === body.accountId).length;
    return ok({ success: true, created: 0, updated: total, total }, '同步完成');
  }),

  http.post('/api/mp/tags', async ({ request }) => {
    const body = await request.json() as { accountId: number; name: string };
    if (mockMpTags.some((t) => t.accountId === body.accountId && t.name === body.name)) {
      return badRequest('该标签名称已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: MpTag = { id: getNextMpTagId(), accountId: body.accountId, wechatTagId: null, name: body.name, fansCount: 0, createdAt: now, updatedAt: now };
    mockMpTags.push(item);
    return ok(item, '创建成功');
  }),

  http.put('/api/mp/tags/:id', async ({ params, request }) => {
    const t = mockMpTags.find((x) => x.id === Number(params.id));
    if (!t) return notFound('标签不存在', { status: 404 });
    const body = await request.json() as { name: string };
    if (body.name && body.name !== t.name && mockMpTags.some((x) => x.accountId === t.accountId && x.name === body.name)) {
      return badRequest('该标签名称已存在', { status: 400 });
    }
    t.name = body.name ?? t.name;
    t.updatedAt = mockDateTime();
    return ok(t, '更新成功');
  }),

  http.delete('/api/mp/tags/:id', ({ params }) => {
    const idx = mockMpTags.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('标签不存在', { status: 404 });
    const [removed] = mockMpTags.splice(idx, 1);
    // 从粉丝本地标签中移除
    mockMpFans.forEach((f) => { f.tagIds = f.tagIds.filter((id) => id !== removed.id); });
    return ok(null, '删除成功');
  }),
];
