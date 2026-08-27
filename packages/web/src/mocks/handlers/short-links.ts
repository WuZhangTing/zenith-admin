import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import type { ChannelAnalysisResult, ShortLink, ShortLinkStats } from '@zenith/shared/short-link';
import { CHANNEL_ANALYSIS_UNSET, SHORT_LINK_CODE_ALPHABET, SHORT_LINK_CODE_LENGTH } from '@zenith/shared/short-link';
import { mockShortLinks, getNextShortLinkId } from '../data/short-links';
import { mockDateTime } from '../utils/date';

function generateMockCode(): string {
  let code = '';
  for (let i = 0; i < SHORT_LINK_CODE_LENGTH; i++) {
    code += SHORT_LINK_CODE_ALPHABET[Math.floor(Math.random() * SHORT_LINK_CODE_ALPHABET.length)];
  }
  return code;
}

/** 确定性伪随机：同一短链在 Demo 会话内统计稳定，避免每次打开抽屉数字乱跳 */
function seededSeries(seed: number, days: number): Array<{ date: string; pv: number; uv: number }> {
  const out: Array<{ date: string; pv: number; uv: number }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const wave = Math.abs(Math.sin((seed + i) * 1.7));
    const pv = Math.round(wave * 80 + (seed % 7) * 4);
    out.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      pv,
      uv: Math.max(0, Math.round(pv * 0.62)),
    });
  }
  return out;
}

export const shortLinksHandlers = [
  // ─── GET /api/growth/channel-analysis — 渠道推广分析（独立路径，先于短链资源）──
  http.get('/api/growth/channel-analysis', ({ request }) => {
    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 90);
    const convEvent = url.searchParams.get('convEvent') || '';
    const hasConv = convEvent !== '';
    const channelNames = ['wechat', 'weibo', 'baidu-sem', 'douyin', CHANNEL_ANALYSIS_UNSET];
    const rows = channelNames.map((name, i) => {
      const clicks = Math.max(8, Math.round(360 / (i + 1)));
      const conversions = hasConv ? Math.round(clicks * 0.18) : null;
      return {
        name,
        clicks,
        uv: Math.round(clicks * 0.64),
        conversions,
        convRate: conversions !== null ? Number((conversions / clicks).toFixed(4)) : null,
      };
    });
    const trend: ChannelAnalysisResult['trend'] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const wave = Math.abs(Math.sin(i * 1.3));
      const pv = Math.round(wave * 60 + 12);
      trend.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        pv,
        uv: Math.round(pv * 0.64),
      });
    }
    const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
    const result: ChannelAnalysisResult = {
      totals: {
        clicks: totalClicks,
        uv: Math.round(totalClicks * 0.64),
        links: mockShortLinks.length,
        conversions: hasConv ? rows.reduce((s, r) => s + (r.conversions ?? 0), 0) : null,
      },
      trend,
      rows,
    };
    return ok(result);
  }),

  // ─── GET / — 分页列表 ─────────────────────────────────────────────────────
  http.get('/api/short-links', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const bizType = url.searchParams.get('bizType') || '';

    let list = [...mockShortLinks].sort((a, b) => b.id - a.id);
    if (keyword) {
      list = list.filter((x) => x.code.includes(keyword)
        || (x.title ?? '').includes(keyword)
        || x.targetUrl.includes(keyword));
    }
    if (status) list = list.filter((x) => x.status === status);
    if (bizType) list = list.filter((x) => x.bizType === bizType);
    return ok(paginate(list, url));
  }),

  // ─── DELETE /batch —— 静态路径先于 /:id ──────────────────────────────────
  http.delete('/api/short-links/batch', async ({ request }) => {
    const { ids = [] } = (await request.json()) as { ids?: number[] };
    if (ids.length === 0) return badRequest('请选择要删除的记录', { status: 400 });
    const selected = new Set(ids);
    const deleted = removeWhere(mockShortLinks, (x) => selected.has(x.id));
    return ok(null, `已删除 ${deleted} 条记录`);
  }),

  // ─── PUT /batch/status — 批量启用/禁用 ────────────────────────────────────
  http.put('/api/short-links/batch/status', async ({ request }) => {
    const { ids = [], status } = (await request.json()) as { ids?: number[]; status?: 'enabled' | 'disabled' };
    if (!ids.length || !status) return badRequest('请选择要操作的记录', { status: 400 });
    const selected = new Set(ids);
    let updated = 0;
    for (const link of mockShortLinks) {
      if (selected.has(link.id)) {
        link.status = status;
        link.updatedAt = mockDateTime();
        updated++;
      }
    }
    return ok(null, `已${status === 'enabled' ? '启用' : '禁用'} ${updated} 条记录`);
  }),

  // ─── POST /ensure — 业务对象幂等取短链 ───────────────────────────────────
  http.post('/api/short-links/ensure', async ({ request }) => {
    const body = (await request.json()) as { targetUrl?: string; bizType?: ShortLink['bizType']; bizRef?: string; title?: string | null };
    if (!body.targetUrl || !body.bizType || !body.bizRef) return badRequest('参数不完整', { status: 400 });
    const existing = mockShortLinks.find((x) => x.bizType === body.bizType && x.bizRef === body.bizRef);
    if (existing) {
      existing.targetUrl = body.targetUrl;
      if (body.title) existing.title = body.title;
      existing.updatedAt = mockDateTime();
      return ok(existing);
    }
    const now = mockDateTime();
    const code = generateMockCode();
    const newLink: ShortLink = {
      id: getNextShortLinkId(),
      code,
      shortUrl: `${window.location.origin}/s/${code}`,
      targetUrl: body.targetUrl,
      title: body.title ?? null,
      redirectType: '302',
      status: 'enabled',
      expiresAt: null,
      expired: false,
      maxVisits: null,
      password: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      bizType: body.bizType,
      bizRef: body.bizRef,
      remark: null,
      totalPv: 0,
      lastVisitAt: null,
      createdAt: now,
      updatedAt: now,
    };
    mockShortLinks.push(newLink);
    return ok(newLink);
  }),

  // ─── GET /:id/stats — 访问统计 ───────────────────────────────────────────
  http.get('/api/short-links/:id/stats', ({ params, request }) => {
    const link = mockShortLinks.find((x) => x.id === Number(params.id));
    if (!link) return notFound('短链不存在', { status: 404 });
    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 90);
    const trend = seededSeries(link.id, days);
    const pv = trend.reduce((s, p) => s + p.pv, 0);
    const uv = trend.reduce((s, p) => s + p.uv, 0);
    const today = trend[trend.length - 1];
    const scale = (ratios: number[]) => ratios.map((r) => Math.max(1, Math.round(pv * r)));
    const [c1, c2, c3, c4] = scale([0.52, 0.31, 0.12, 0.05]);
    const stats: ShortLinkStats = {
      totals: { pv, uv, todayPv: today?.pv ?? 0, todayUv: today?.uv ?? 0 },
      trend,
      devices: [
        { name: 'mobile', count: c1 },
        { name: 'desktop', count: c2 },
        { name: 'tablet', count: c3 },
        { name: 'unknown', count: c4 },
      ],
      browsers: [
        { name: 'Chrome', count: c1 },
        { name: 'WeChat', count: c2 },
        { name: 'Safari', count: c3 },
        { name: 'Edge', count: c4 },
      ],
      regions: [
        { name: '广东省', count: c1 },
        { name: '浙江省', count: c2 },
        { name: '北京市', count: c3 },
        { name: '四川省', count: c4 },
      ],
      referers: [
        { name: '直接访问', count: c1 },
        { name: 'weixin.qq.com', count: c2 },
        { name: 'www.baidu.com', count: c3 },
        { name: 'm.weibo.cn', count: c4 },
      ],
    };
    return ok(stats);
  }),

  // ─── GET /:id — 详情 ─────────────────────────────────────────────────────
  http.get('/api/short-links/:id', ({ params }) => {
    const link = mockShortLinks.find((x) => x.id === Number(params.id));
    if (!link) return notFound('短链不存在', { status: 404 });
    return ok(link);
  }),

  // ─── POST / — 创建 ───────────────────────────────────────────────────────
  http.post('/api/short-links', async ({ request }) => {
    const body = (await request.json()) as Partial<ShortLink>;
    if (!body.targetUrl) return badRequest('目标地址不能为空', { status: 400 });
    if (body.code && mockShortLinks.some((x) => x.code === body.code)) {
      return badRequest(`短码 "${body.code}" 已被占用，请更换`, { status: 400 });
    }
    const now = mockDateTime();
    const code = body.code || generateMockCode();
    const newLink: ShortLink = {
      id: getNextShortLinkId(),
      code,
      shortUrl: `${window.location.origin}/s/${code}`,
      targetUrl: body.targetUrl,
      title: body.title ?? null,
      redirectType: body.redirectType ?? '302',
      status: body.status ?? 'enabled',
      expiresAt: body.expiresAt ?? null,
      expired: false,
      maxVisits: body.maxVisits ?? null,
      password: body.password ?? null,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      utmTerm: body.utmTerm ?? null,
      utmContent: body.utmContent ?? null,
      bizType: 'custom',
      bizRef: null,
      remark: body.remark ?? null,
      totalPv: 0,
      lastVisitAt: null,
      createdAt: now,
      updatedAt: now,
    };
    mockShortLinks.push(newLink);
    return ok(newLink, '创建成功');
  }),

  // ─── PUT /:id — 更新 ─────────────────────────────────────────────────────
  http.put('/api/short-links/:id', async ({ params, request }) => {
    const idx = mockShortLinks.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('短链不存在', { status: 404 });
    const body = (await request.json()) as Partial<ShortLink>;
    // code 不可修改，丢弃载荷中的 code / 派生字段
    const { code: _code, shortUrl: _s, expired: _e, ...rest } = body;
    Object.assign(mockShortLinks[idx], { ...rest, updatedAt: mockDateTime() });
    return ok(mockShortLinks[idx], '更新成功');
  }),

  // ─── DELETE /:id — 删除 ──────────────────────────────────────────────────
  http.delete('/api/short-links/:id', ({ params }) => {
    const idx = mockShortLinks.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('短链不存在', { status: 404 });
    mockShortLinks.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
