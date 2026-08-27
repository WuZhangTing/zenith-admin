import { http } from 'msw';
import { ok, badRequest, notFound, paginate, pageResult } from '@/mocks/utils/handlers';
import type { MarketingCampaign, MarketingPrize } from '@zenith/shared/marketing';
import {
  getNextMarketingCampaignId, getNextMarketingPrizeId,
  mockMarketingCampaigns, mockMarketingParticipations, mockMarketingPrizes,
} from '../data/marketing';
import { mockDateTime } from '../utils/date';

export const marketingHandlers = [
  // ─── 活动列表 ────────────────────────────────────────────────────────────────
  http.get('/api/marketing/campaigns', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockMarketingCampaigns].sort((a, b) => b.id - a.id);
    if (keyword) list = list.filter((c) => c.name.includes(keyword) || (c.description ?? '').includes(keyword));
    if (status) list = list.filter((c) => c.status === status);
    return ok(paginate(list, url));
  }),

  // ─── 奖品子资源（静态段先于 /:id 注册）──────────────────────────────────────
  http.get('/api/marketing/campaigns/:campaignId/prizes', ({ params }) => {
    const campaignId = Number(params.campaignId);
    if (!mockMarketingCampaigns.some((c) => c.id === campaignId)) return notFound('营销活动不存在', { status: 404 });
    return ok(mockMarketingPrizes.filter((p) => p.campaignId === campaignId).sort((a, b) => a.sort - b.sort || a.id - b.id));
  }),
  http.post('/api/marketing/campaigns/:campaignId/prizes', async ({ params, request }) => {
    const campaignId = Number(params.campaignId);
    const body = (await request.json()) as Partial<MarketingPrize> & { stock?: number };
    const now = mockDateTime();
    const prize: MarketingPrize = {
      id: getNextMarketingPrizeId(),
      campaignId,
      name: body.name ?? '',
      prizeType: body.prizeType ?? 'points',
      points: body.points ?? null,
      couponId: body.couponId ?? null,
      couponName: null,
      stock: body.stock ?? 0,
      totalStock: body.stock ?? 0,
      weight: body.weight ?? 1,
      sort: body.sort ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    mockMarketingPrizes.push(prize);
    return ok(prize, '创建成功');
  }),
  http.put('/api/marketing/campaigns/:campaignId/prizes/:prizeId', async ({ params, request }) => {
    const prizeId = Number(params.prizeId);
    const idx = mockMarketingPrizes.findIndex((p) => p.id === prizeId);
    if (idx === -1) return notFound('奖品不存在', { status: 404 });
    const body = (await request.json()) as Partial<MarketingPrize> & { stock?: number };
    const current = mockMarketingPrizes[idx];
    const nextTotal = body.stock ?? current.totalStock;
    const delta = nextTotal - current.totalStock;
    Object.assign(current, {
      ...body,
      totalStock: nextTotal,
      stock: Math.max(0, current.stock + delta),
      updatedAt: mockDateTime(),
    });
    return ok(current, '更新成功');
  }),
  http.delete('/api/marketing/campaigns/:campaignId/prizes/:prizeId', ({ params }) => {
    const prizeId = Number(params.prizeId);
    const idx = mockMarketingPrizes.findIndex((p) => p.id === prizeId);
    if (idx === -1) return notFound('奖品不存在', { status: 404 });
    mockMarketingPrizes.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 参与记录 ────────────────────────────────────────────────────────────────
  http.get('/api/marketing/campaigns/:campaignId/participations', ({ params, request }) => {
    const campaignId = Number(params.campaignId);
    const url = new URL(request.url);
    const wonOnly = url.searchParams.get('wonOnly') === 'true';
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 10;
    let list = mockMarketingParticipations.filter((r) => r.campaignId === campaignId);
    if (wonOnly) list = list.filter((r) => r.prizeId !== null);
    return ok(pageResult([...list].sort((a, b) => b.id - a.id), page, pageSize));
  }),

  // ─── 发布 / 结束 ────────────────────────────────────────────────────────────
  http.post('/api/marketing/campaigns/:id/publish', ({ params }) => {
    const id = Number(params.id);
    const campaign = mockMarketingCampaigns.find((c) => c.id === id);
    if (!campaign) return notFound('营销活动不存在', { status: 404 });
    if (!mockMarketingPrizes.some((p) => p.campaignId === id)) return badRequest('请先配置奖品再发布', { status: 400 });
    campaign.status = 'published';
    if (campaign.landingUrl) campaign.shortUrl = `${window.location.origin}/s/act${id}x`;
    campaign.updatedAt = mockDateTime();
    return ok(campaign, '发布成功');
  }),
  http.post('/api/marketing/campaigns/:id/end', ({ params }) => {
    const id = Number(params.id);
    const campaign = mockMarketingCampaigns.find((c) => c.id === id);
    if (!campaign) return notFound('营销活动不存在', { status: 404 });
    if (campaign.status !== 'published') return badRequest('仅进行中的活动可结束', { status: 400 });
    campaign.status = 'ended';
    campaign.updatedAt = mockDateTime();
    return ok(campaign, '活动已结束');
  }),

  // ─── 详情 / 创建 / 更新 / 删除 ──────────────────────────────────────────────
  http.get('/api/marketing/campaigns/:id', ({ params }) => {
    const campaign = mockMarketingCampaigns.find((c) => c.id === Number(params.id));
    if (!campaign) return notFound('营销活动不存在', { status: 404 });
    return ok(campaign);
  }),
  http.post('/api/marketing/campaigns', async ({ request }) => {
    const body = (await request.json()) as Partial<MarketingCampaign>;
    if (!body.name || !body.startAt || !body.endAt) return badRequest('活动名称与时间不能为空', { status: 400 });
    const now = mockDateTime();
    const campaign: MarketingCampaign = {
      id: getNextMarketingCampaignId(),
      name: body.name,
      type: 'lottery',
      status: 'draft',
      startAt: body.startAt,
      endAt: body.endAt,
      perMemberLimit: body.perMemberLimit ?? 1,
      dailyPerMemberLimit: body.dailyPerMemberLimit ?? null,
      landingUrl: body.landingUrl ?? null,
      shortUrl: null,
      description: body.description ?? null,
      participationCount: 0,
      awardCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockMarketingCampaigns.push(campaign);
    return ok(campaign, '创建成功');
  }),
  http.put('/api/marketing/campaigns/:id', async ({ params, request }) => {
    const campaign = mockMarketingCampaigns.find((c) => c.id === Number(params.id));
    if (!campaign) return notFound('营销活动不存在', { status: 404 });
    if (campaign.status === 'ended') return badRequest('已结束的活动不可修改', { status: 400 });
    const body = (await request.json()) as Partial<MarketingCampaign>;
    Object.assign(campaign, body, { updatedAt: mockDateTime() });
    return ok(campaign, '更新成功');
  }),
  http.delete('/api/marketing/campaigns/:id', ({ params }) => {
    const id = Number(params.id);
    const campaign = mockMarketingCampaigns.find((c) => c.id === id);
    if (!campaign) return notFound('营销活动不存在', { status: 404 });
    if (campaign.status === 'published') return badRequest('进行中的活动不可删除，请先结束', { status: 400 });
    mockMarketingCampaigns.splice(mockMarketingCampaigns.indexOf(campaign), 1);
    return ok(null, '删除成功');
  }),
];
