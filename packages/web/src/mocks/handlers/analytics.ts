import { http } from 'msw';
import { ok, badRequest, notFound, pageParams, pageResult, paginate, nextIdFrom } from '@/mocks/utils/handlers';
import type { PageStats, FeatureStats, HeatmapData, HeatmapPageListItem, AnalyticsOverview, TrendSeries, RealtimeStats, FunnelResult, RetentionResult, PathResult, PerfStats, EventListItem, EventDetail, AnalyticsEventMeta, AnalyticsSettings, AnalyticsPublicConfig, AnalyticsRollupItem, AnalyticsSavedReport, AnalyticsEventOverride, AnalyticsQualityDaily, AnalyticsQualityIssueType, AnalyticsQualityQueryResult, AnalyticsDebugEvent, AnalyticsUserSegment, AnalyticsSegmentMember, AnalyticsSegmentCampaign, AnalyticsSite, AnalyticsExperiment, AnalyticsExperimentAssignment, AnalyticsExperimentReport, AnalyticsEventQueryInput, AnalyticsEventQueryResult, AnalyticsEventQueryRow, AnalyticsEventQueryGroupByField, AnalyticsEventQueryMetric, AnalyticsRetentionPeriodType, AnalyticsComparison, AnalyticsDrillUser, AnalyticsDrillUsersResult, AnalyticsAcquisitionResult, AnalyticsAcquisitionDimension, AnalyticsAttributionModel } from '@zenith/shared/analytics';
import type { PaginatedResponse } from '@zenith/shared/core';
import type { UserStats, UserTimeline, UserBehaviorEventType } from '@zenith/shared/identity';
import type { SessionListItem, SessionTimeline } from '@zenith/shared/platform';
import type { AsyncTask } from '@zenith/shared/tasks';
import { ANALYTICS_SITE_KEY_HEADER, ANALYTICS_QUALITY_ISSUE_TYPES, ANALYTICS_PATH_EXIT_PAGE, ANALYTICS_RETENTION_PERIOD_LIMITS, ANALYTICS_SERIES_OVERALL_KEY, ANALYTICS_ACQUISITION_CHANNELS, ANALYTICS_ACQUISITION_CHANNEL_LABELS } from '@zenith/shared/analytics';
import { SEED_ANALYTICS_EVENT_META, SEED_ANALYTICS_SITES } from '@zenith/shared/seed';
import { mockDateTime, mockDateTimeOffset, mockDateOffset } from '../utils/date';
import { createProgressingMockTask } from './async-tasks';

function daysAxis(days: number): string[] {
  const arr: string[] = [];
  for (let i = days - 1; i >= 0; i--) arr.push(mockDateOffset(-i));
  return arr;
}
function rand(min: number, max: number): number { return Math.floor(min + Math.random() * (max - min)); }

/** 日期字符串按天偏移（YYYY-MM-DD） */
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let mockSavedReports: AnalyticsSavedReport[] = [
  { id: 1, name: '注册转化漏斗', reportType: 'funnel', config: { days: 30, steps: [{ label: '进入首页', pagePath: '/' }, { label: '进入用户管理', pagePath: '/users' }, { label: '新增用户', eventName: '$autocapture' }] }, createdBy: 1, createdByName: 'admin', createdAt: mockDateTimeOffset(-5 * 86400000) },
];
let nextReportId = 2;

// ─── 静态基础数据 ─────────────────────────────────────────────────────────────
const MOCK_PAGE_ITEMS: PageStats['list'] = [
  { pagePath: '/users', pageTitle: '用户管理', visits: 532, avgMs: 68400, medianMs: 45200, p90Ms: 142000 },
  { pagePath: '/roles', pageTitle: '角色管理', visits: 384, avgMs: 52100, medianMs: 38700, p90Ms: 118000 },
  { pagePath: '/workflow/definitions', pageTitle: '流程定义', visits: 298, avgMs: 124500, medianMs: 89300, p90Ms: 286000 },
  { pagePath: '/system/dicts', pageTitle: '字典管理', visits: 245, avgMs: 31200, medianMs: 22400, p90Ms: 72000 },
  { pagePath: '/departments', pageTitle: '部门管理', visits: 213, avgMs: 44700, medianMs: 33100, p90Ms: 98000 },
  { pagePath: '/', pageTitle: '首页', visits: 189, avgMs: 28900, medianMs: 19800, p90Ms: 65000 },
  { pagePath: '/system/menus', pageTitle: '菜单管理', visits: 156, avgMs: 87300, medianMs: 61200, p90Ms: 198000 },
  { pagePath: '/system/configs', pageTitle: '系统配置', visits: 134, avgMs: 39200, medianMs: 27600, p90Ms: 84000 },
];

const MOCK_FEATURE_ITEMS: FeatureStats['list'] = [
  { pagePath: '/users', elementKey: 'search-btn', elementLabel: '查询', componentArea: 'search-toolbar', count: 1243 },
  { pagePath: '/users', elementKey: 'create-btn', elementLabel: '新增', componentArea: 'search-toolbar', count: 892 },
  { pagePath: '/users', elementKey: 'export-btn', elementLabel: '导出', componentArea: 'search-toolbar', count: 567 },
  { pagePath: '/roles', elementKey: 'search-btn', elementLabel: '查询', componentArea: 'search-toolbar', count: 498 },
  { pagePath: '/users', elementKey: 'edit-btn', elementLabel: '编辑', componentArea: 'table-actions', count: 423 },
  { pagePath: '/users', elementKey: 'reset-btn', elementLabel: '重置', componentArea: 'search-toolbar', count: 387 },
  { pagePath: '/workflow/definitions', elementKey: 'create-btn', elementLabel: '新建流程', componentArea: 'search-toolbar', count: 312 },
  { pagePath: '/roles', elementKey: 'create-btn', elementLabel: '新增', componentArea: 'search-toolbar', count: 287 },
];

const MOCK_HEATMAP_PAGES: HeatmapPageListItem[] = [
  { pagePath: '/users', pageTitle: '用户管理', areas: ['search-toolbar', 'table'] },
  { pagePath: '/roles', pageTitle: '角色管理', areas: ['search-toolbar', 'table'] },
  { pagePath: '/departments', pageTitle: '部门管理', areas: ['search-toolbar', 'table'] },
];

function buildMockHeatmapData(pagePath: string, area: string): HeatmapData {
  const labels = ['查询', '新增', '编辑', '删除', '导出', '重置'];
  const rageKeys = ['导出-btn', '提交-btn'];
  const points: HeatmapData['points'] = [];
  const seed = pagePath.length + area.length;
  for (let i = 0; i < 120; i++) {
    const clusterX = [20, 45, 70, 85][(i + seed) % 4];
    const clusterY = [25, 55, 75][(i + seed) % 3];
    const x = clusterX + ((((i * 1237 + seed * 31) % 200) - 100) / 100) * 20;
    const y = clusterY + ((((i * 971 + seed * 17) % 200) - 100) / 100) * 18;
    const value = Math.max(1, Math.floor(20 - i * 0.15));
    const label = i % 5 === 0 ? null : labels[(i + seed) % labels.length];
    const uniqueUsers = Math.max(1, Math.round(value / (1 + ((i + seed) % 5) * 0.7)));
    const elementKey = label ? `${label}-btn` : null;
    points.push({
      x: Math.max(1, Math.min(99, x)),
      y: Math.max(1, Math.min(99, y)),
      value,
      topLabel: label,
      topElementKey: elementKey,
      topArea: area || (i % 2 === 0 ? 'search-toolbar' : 'table-actions'),
      uniqueUsers,
      repeatRate: Math.round((value / uniqueUsers) * 10) / 10,
      rage: !!elementKey && rageKeys.includes(elementKey),
    });
  }
  const total = 1847;
  const uniqueUsers = 214;
  return {
    pagePath,
    componentArea: area,
    points,
    total,
    uniqueUsers,
    uniqueSessions: 386,
    avgClicksPerUser: Math.round((total / uniqueUsers) * 10) / 10,
    topElements: labels.map((label, i) => ({
      elementKey: `${label}-btn`,
      elementLabel: label,
      componentArea: area || (i % 2 === 0 ? 'search-toolbar' : 'table-actions'),
      count: 420 - i * 55,
      uniqueUsers: 160 - i * 18,
      avgX: 20 + i * 9,
      avgY: 22 + i * 7,
    })),
    rageClicks: [
      { elementKey: '导出-btn', elementLabel: '导出', count: 27, uniqueUsers: 9, lastAt: mockDateTime() },
      { elementKey: '提交-btn', elementLabel: '提交', count: 14, uniqueUsers: 6, lastAt: mockDateTime() },
    ],
  };
}

const DEVICES = ['desktop', 'mobile', 'tablet'] as const;
const BROWSERS = ['Chrome', 'Edge', 'Safari', 'Firefox'];
const OSES = ['Windows', 'macOS', 'iOS', 'Android'];
const USERNAMES = ['admin', 'zhangsan', 'lisi', 'wangwu', 'zhaoliu'];

// ─── 事件字典（内存）──────────────────────────────────────────────────────────
// 前 4 条为前端 SDK 内置自动采集事件；其余派生自 @zenith/shared SEED_ANALYTICS_EVENT_META
// （行为中心阶段 1 服务端权威事件：支付 / 工作流 / 会员），与 DB 种子/服务端订阅产出的 eventName 保持一致。
let mockEventMeta: AnalyticsEventMeta[] = [
  { id: 1, eventName: '$pageview', displayName: '页面浏览', category: 'page_view', description: '页面进入自动采集', propertySchema: null, status: 'active', version: 1, ownerId: null, ownerName: null, strictMode: false, eventCount: 18420, firstSeenAt: mockDateTimeOffset(-30 * 86400000), lastSeenAt: mockDateTime(), createdAt: mockDateTimeOffset(-30 * 86400000), updatedAt: mockDateTime() },
  { id: 2, eventName: '$autocapture', displayName: '自动点击', category: 'feature_use', description: '元素点击自动采集', propertySchema: null, status: 'active', version: 1, ownerId: null, ownerName: null, strictMode: false, eventCount: 9234, firstSeenAt: mockDateTimeOffset(-30 * 86400000), lastSeenAt: mockDateTime(), createdAt: mockDateTimeOffset(-30 * 86400000), updatedAt: mockDateTime() },
  { id: 3, eventName: '$web_vitals', displayName: 'Web Vitals', category: 'perf', description: '性能指标', propertySchema: null, status: 'active', version: 1, ownerId: null, ownerName: null, strictMode: false, eventCount: 5120, firstSeenAt: mockDateTimeOffset(-30 * 86400000), lastSeenAt: mockDateTime(), createdAt: mockDateTimeOffset(-30 * 86400000), updatedAt: mockDateTime() },
  { id: 4, eventName: 'order_submit', displayName: '提交订单', category: 'custom', description: '业务自定义事件', propertySchema: [{ key: 'amount', type: 'number', description: '金额' }], status: 'active', version: 1, ownerId: null, ownerName: null, strictMode: false, eventCount: 842, firstSeenAt: mockDateTimeOffset(-20 * 86400000), lastSeenAt: mockDateTime(), createdAt: mockDateTimeOffset(-20 * 86400000), updatedAt: mockDateTime() },
  ...SEED_ANALYTICS_EVENT_META.map((meta): AnalyticsEventMeta => ({
    id: meta.id,
    eventName: meta.eventName,
    displayName: meta.displayName,
    category: meta.category,
    description: meta.description,
    propertySchema: meta.propertySchema,
    status: 'active',
    version: 1,
    ownerId: null,
    ownerName: null,
    strictMode: meta.strictMode,
    eventCount: rand(50, 3000),
    firstSeenAt: mockDateTimeOffset(-20 * 86400000),
    lastSeenAt: mockDateTime(),
    createdAt: mockDateTimeOffset(-20 * 86400000),
    updatedAt: mockDateTime(),
  })),
];
let nextMetaId = 5;

let mockSettings: AnalyticsSettings = {
  id: 1, enabled: true, sampleRate: 1, trackPageviews: true, trackClicks: true, trackPerformance: true,
  trackErrors: true, trackApi: true, maskInputs: true, respectDnt: false, anonymizeIp: false, blacklistPaths: ['/login'],
  errorIgnorePatterns: ['Invalid DOM property'],
  retentionDays: 180, errorRetentionDays: 90, sessionTimeoutMinutes: 30, createdAt: mockDateTimeOffset(-60 * 86400000), updatedAt: mockDateTime(),
};

const PUBLIC_CONFIG: AnalyticsPublicConfig = {
  enabled: true, sampleRate: 1, trackPageviews: true, trackClicks: true, trackPerformance: true,
  trackErrors: true, trackApi: true, maskInputs: true, respectDnt: false, blacklistPaths: ['/login'],
  sessionTimeoutMinutes: 30,
};

function buildEvents(count: number): EventListItem[] {
  const types: UserBehaviorEventType[] = ['page_view', 'feature_use', 'page_leave', 'area_click', 'custom', 'perf', 'api_request'];
  return Array.from({ length: count }, (_, i) => {
    const eventType = types[i % types.length];
    const isApi = eventType === 'api_request';
    return {
      id: 10000 - i,
      userId: rand(1, 6),
      username: USERNAMES[i % USERNAMES.length],
      eventType,
      eventName: ['$pageview', '$autocapture', '$pageleave', '$areaclick', 'order_submit', '$web_vitals', '$api'][i % 7],
      pagePath: MOCK_PAGE_ITEMS[i % MOCK_PAGE_ITEMS.length].pagePath,
      pageTitle: MOCK_PAGE_ITEMS[i % MOCK_PAGE_ITEMS.length].pageTitle,
      elementKey: i % 3 === 0 ? 'search-btn' : null,
      elementLabel: i % 3 === 0 ? '查询' : null,
      componentArea: i % 3 === 0 ? 'search-toolbar' : null,
      durationMs: i % 5 === 0 ? rand(1000, 120000) : null,
      browser: BROWSERS[i % BROWSERS.length],
      os: OSES[i % OSES.length],
      deviceType: DEVICES[i % DEVICES.length],
      region: ['广东 深圳', '北京', '上海', '浙江 杭州'][i % 4],
      sessionId: `sess-${1000 + (i % 50)}`,
      memberId: null,
      source: 'web_admin' as const,
      appId: 'admin',
      environment: 'production' as const,
      apiUrl: isApi ? '/api/orders/submit' : null,
      apiStatus: isApi ? [404, 500, 502][i % 3] : null,
      createdAt: mockDateTime(),
    };
  });
}
const MOCK_EVENTS = buildEvents(120);


// ─── 行为中心阶段2：站点管理（内存）────────────────────────────────────────────
let mockSites: AnalyticsSite[] = SEED_ANALYTICS_SITES.map((site, index) => ({
  ...site,
  tenantName: null,
  todayUsage: site.dailyEventQuota ? Math.floor(site.dailyEventQuota * (index === 0 ? 0.92 : 0.35)) : rand(100, 1200),
  createdAt: mockDateTimeOffset(-60 * 86400000),
  updatedAt: mockDateTime(),
}));
let nextSiteId = nextIdFrom(mockSites);
function mockSiteKey(): string { return `zk_${Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32)}`; }


// ─── 行为中心阶段2：A/B 实验（内存）────────────────────────────────────────────
let mockExperiments: AnalyticsExperiment[] = [
  {
    id: 1,
    tenantId: null,
    tenantName: null,
    expKey: 'homepage_banner',
    name: '首页 Banner 文案实验',
    description: '对比不同 Banner 文案对提交订单的影响',
    status: 'running',
    trafficAllocation: 100,
    variants: [{ key: 'control', name: '对照组', weight: 50 }, { key: 'new_copy', name: '新文案', weight: 50 }],
    metricEventName: 'order_submit',
    startAt: mockDateTimeOffset(-7 * 86400000),
    endAt: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: mockDateTimeOffset(-8 * 86400000),
    updatedAt: mockDateTime(),
  },
  {
    id: 2,
    tenantId: null,
    tenantName: null,
    expKey: 'member_checkout_flow',
    name: '会员结算流程实验',
    description: '对比结算流程入口调整',
    status: 'draft',
    trafficAllocation: 60,
    variants: [{ key: 'control', name: '原流程', weight: 50 }, { key: 'short', name: '精简流程', weight: 50 }],
    metricEventName: 'payment.succeeded',
    startAt: null,
    endAt: null,
    createdBy: 1,
    updatedBy: 1,
    createdAt: mockDateTimeOffset(-3 * 86400000),
    updatedAt: mockDateTimeOffset(-1 * 86400000),
  },
];
let nextExperimentId = 3;

function mockPickExperimentVariant(exp: AnalyticsExperiment, distinctId: string): string | null {
  let hash = 0;
  for (const ch of `${exp.expKey}:${distinctId}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bucket = hash % 100;
  if (bucket >= exp.trafficAllocation) return null;
  const variantBucket = Math.floor((bucket / Math.max(exp.trafficAllocation, 1)) * 100);
  let cursor = 0;
  for (const variant of exp.variants) {
    cursor += variant.weight;
    if (variantBucket < cursor) return variant.key;
  }
  return exp.variants.at(-1)?.key ?? null;
}

// ─── 行为中心阶段1：用户分群（内存）────────────────────────────────────────────
let mockSegments: AnalyticsUserSegment[] = [
  {
    id: 1,
    tenantId: null,
    name: '活跃下单用户',
    description: '最近 7 天内提交过订单事件的用户',
    rules: { operator: 'AND', conditions: [{ type: 'event', eventName: 'order_submit', days: 7, minCount: 1 }] },
    status: 'enabled',
    estimatedSize: 128,
    snapshotAt: mockDateTimeOffset(-2 * 86400000),
    createdAt: mockDateTimeOffset(-10 * 86400000),
    updatedAt: mockDateTimeOffset(-2 * 86400000),
  },
  {
    id: 2,
    tenantId: null,
    name: '桌面端会员用户',
    description: '身份类型为会员，且最近使用桌面端访问',
    rules: {
      operator: 'AND',
      conditions: [
        { type: 'attribute', field: 'identityType', op: 'eq', value: 'member' },
        { type: 'event', eventName: '$pageview', days: 30, minCount: 3 },
      ],
    },
    status: 'enabled',
    estimatedSize: 56,
    snapshotAt: mockDateTimeOffset(-1 * 86400000),
    createdAt: mockDateTimeOffset(-20 * 86400000),
    updatedAt: mockDateTimeOffset(-1 * 86400000),
  },
];
let nextSegmentId = 3;

function buildSegmentMembers(segmentId: number, count: number): AnalyticsSegmentMember[] {
  return Array.from({ length: count }, (_, i) => ({
    id: segmentId * 1000 + i + 1,
    segmentId,
    tenantId: null,
    distinctId: `u:${i + 1}`,
    identityType: i % 3 === 0 ? 'member' : i % 3 === 1 ? 'admin' : 'anonymous',
    userId: i % 3 === 1 ? i + 1 : null,
    memberId: i % 3 === 0 ? i + 1 : null,
    snapshotAt: mockDateTime(),
  }));
}
const mockSegmentMembers: Record<number, AnalyticsSegmentMember[]> = {
  1: buildSegmentMembers(1, 24),
  2: buildSegmentMembers(2, 12),
};
let mockCampaigns: AnalyticsSegmentCampaign[] = [
  {
    id: 1,
    tenantId: null,
    segmentId: 1,
    segmentName: '活跃下单用户',
    name: '下单用户优惠券触达',
    channel: 'in_app',
    templateId: 1,
    webhookUrl: null,
    status: 'completed',
    totalCount: 24,
    sentCount: 16,
    failedCount: 8,
    lastRunAt: mockDateTimeOffset(-3600000),
    lastError: '会员/匿名用户无站内信体系，已跳过 8 条',
    createdBy: 1,
    updatedBy: 1,
    createdAt: mockDateTimeOffset(-2 * 86400000),
    updatedAt: mockDateTimeOffset(-3600000),
  },
];
let nextCampaignId = 2;

// ─── 阶段1治理闭环：租户覆盖 / 质量看板 / 事件调试（内存）──────────────────────
const MOCK_OVERRIDE_TENANT_ID = 1;

let mockEventOverrides: AnalyticsEventOverride[] = [
  { id: 1, tenantId: MOCK_OVERRIDE_TENANT_ID, eventName: 'order_submit', status: 'disabled', reason: '联调期间临时下线', createdAt: mockDateTimeOffset(-2 * 86400000), updatedAt: mockDateTime() },
];
let nextOverrideId = 2;

const QUALITY_EVENT_NAMES = ['order_submit', '$autocapture', '$pageview'];
const QUALITY_ISSUE_TYPES: AnalyticsQualityIssueType[] = [...ANALYTICS_QUALITY_ISSUE_TYPES];

function buildQualitySample(issueType: AnalyticsQualityIssueType): Record<string, unknown> | null {
  if (issueType === 'event_disabled' || issueType === 'origin_rejected' || issueType === 'quota_exceeded') return null;
  if (issueType === 'missing_required') return { issues: [{ key: 'amount', expected: 'required' }] };
  if (issueType === 'type_mismatch') return { issues: [{ key: 'amount', expected: 'number', actualType: 'string' }] };
  return { issues: [{ key: 'channel', expected: 'wechat|alipay|cash', actualType: 'string' }] };
}

let nextQualityId = 1;
const mockQualityDaily: AnalyticsQualityDaily[] = (() => {
  const rows: AnalyticsQualityDaily[] = [];
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const statDate = mockDateOffset(-dayOffset);
    QUALITY_EVENT_NAMES.forEach((eventName, ei) => {
      QUALITY_ISSUE_TYPES.forEach((issueType, ii) => {
        if ((dayOffset + ei + ii) % 3 !== 0) return; // 稀疏采样，非每天每种组合都有数据
        rows.push({
          id: nextQualityId++,
          tenantId: MOCK_OVERRIDE_TENANT_ID,
          statDate,
          eventName,
          issueType,
          count: rand(1, 40),
          sample: buildQualitySample(issueType),
          lastSeenAt: mockDateTime(),
          createdAt: mockDateTime(),
          updatedAt: mockDateTime(),
        });
      });
    });
  }
  return rows;
})();

export const analyticsHandlers = [

  http.get('/api/analytics/experiments/assignments', ({ request }) => {
    const u = new URL(request.url);
    const distinctId = u.searchParams.get('distinctId') || 'u:1';
    const keys = new Set((u.searchParams.get('keys') || '').split(',').map((v) => v.trim()).filter(Boolean));
    const data: AnalyticsExperimentAssignment[] = mockExperiments
      .filter((exp) => exp.status === 'running' && (keys.size === 0 || keys.has(exp.expKey)))
      .flatMap((exp) => {
        const variantKey = mockPickExperimentVariant(exp, distinctId);
        return variantKey ? [{ expKey: exp.expKey, variantKey }] : [];
      });
    return ok(data);
  }),

  http.get('/api/analytics/experiments', ({ request }) => {
    const u = new URL(request.url);
    const name = u.searchParams.get('name') || '';
    const status = u.searchParams.get('status') || '';
    const list = mockExperiments.filter((exp) => (!name || exp.name.includes(name)) && (!status || exp.status === status));
    return ok<PaginatedResponse<AnalyticsExperiment>>(paginate(list, u, 20));
  }),

  http.get('/api/analytics/experiments/:id', ({ params }) => {
    const exp = mockExperiments.find((item) => item.id === Number(params.id));
    return exp ? ok(exp) : notFound('实验不存在', { status: 404 });
  }),

  http.post('/api/analytics/experiments', async ({ request }) => {
    const body = await request.json() as Partial<AnalyticsExperiment>;
    const exp: AnalyticsExperiment = {
      id: nextExperimentId++, tenantId: null, tenantName: null, expKey: body.expKey || `exp_${Date.now()}`,
      name: body.name || '未命名实验', description: body.description ?? null, status: body.status || 'draft',
      trafficAllocation: body.trafficAllocation ?? 100, variants: body.variants || [{ key: 'control', name: '对照组', weight: 50 }, { key: 'treatment', name: '实验组', weight: 50 }],
      metricEventName: body.metricEventName || 'order_submit', startAt: body.startAt ?? null, endAt: body.endAt ?? null,
      createdBy: 1, updatedBy: 1, createdAt: mockDateTime(), updatedAt: mockDateTime(),
    };
    mockExperiments.unshift(exp);
    return ok(exp, '创建成功');
  }),

  http.put('/api/analytics/experiments/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const index = mockExperiments.findIndex((item) => item.id === id);
    if (index < 0) return notFound('实验不存在', { status: 404 });
    const body = await request.json() as Partial<AnalyticsExperiment>;
    mockExperiments[index] = { ...mockExperiments[index], ...body, updatedAt: mockDateTime() };
    return ok(mockExperiments[index], '更新成功');
  }),

  http.delete('/api/analytics/experiments/:id', ({ params }) => {
    mockExperiments = mockExperiments.filter((item) => item.id !== Number(params.id));
    return ok(null, '删除成功');
  }),

  http.post('/api/analytics/experiments/:id/:action', ({ params }) => {
    const exp = mockExperiments.find((item) => item.id === Number(params.id));
    if (!exp) return notFound('实验不存在', { status: 404 });
    if (params.action === 'start') exp.status = 'running';
    if (params.action === 'pause') exp.status = 'paused';
    if (params.action === 'complete') exp.status = 'completed';
    exp.updatedAt = mockDateTime();
    return ok(exp, '操作成功');
  }),

  http.get('/api/analytics/experiments/:id/report', ({ params }) => {
    const exp = mockExperiments.find((item) => item.id === Number(params.id));
    if (!exp) return notFound('实验不存在', { status: 404 });
    const rows = exp.variants.map((variant, index) => {
      const exposures = 4200 + index * 130;
      const conversions = Math.floor(exposures * (0.08 + index * 0.012));
      return { variantKey: variant.key, exposures, conversions, rate: conversions / exposures, weight: variant.weight };
    });
    const control = rows[0];
    const report: AnalyticsExperimentReport = {
      experimentId: exp.id,
      expKey: exp.expKey,
      metricEventName: exp.metricEventName,
      totalExposures: rows.reduce((sum, r) => sum + r.exposures, 0),
      // Demo 模式不复刻统计引擎，给出形状正确、量级合理的静态结论即可
      srm: { chiSquare: 0.42, pValue: 0.5171, mismatch: false },
      requiredSamplePerVariant: 15_700,
      variants: rows.map((row, index) => {
        const conversionRate = Math.round(row.rate * 1000) / 10;
        if (index === 0) {
          return {
            variantKey: row.variantKey, exposures: row.exposures, conversions: row.conversions, conversionRate,
            isControl: true, absoluteUplift: null, relativeUplift: null, pValue: null,
            confidenceLow: null, confidenceHigh: null, significant: false, normalApproxValid: false,
          };
        }
        const absoluteUplift = Math.round((row.rate - control.rate) * 10_000) / 100;
        return {
          variantKey: row.variantKey, exposures: row.exposures, conversions: row.conversions, conversionRate,
          isControl: false,
          absoluteUplift,
          relativeUplift: Math.round(((row.rate - control.rate) / control.rate) * 1000) / 10,
          pValue: index === 1 ? 0.0312 : 0.2418,
          confidenceLow: Math.round((absoluteUplift - 0.9) * 100) / 100,
          confidenceHigh: Math.round((absoluteUplift + 0.9) * 100) / 100,
          significant: index === 1,
          normalApproxValid: true,
        };
      }),
    };
    return ok(report);
  }),

  http.get('/api/analytics/config', ({ request }) => {
    const u = new URL(request.url);
    const key = request.headers.get(ANALYTICS_SITE_KEY_HEADER) || u.searchParams.get('siteKey');
    const site = key ? mockSites.find((s) => s.siteKey === key && s.status === 'enabled') : undefined;
    return ok<AnalyticsPublicConfig>(site ? { ...PUBLIC_CONFIG, siteId: site.id, appId: site.appId } : PUBLIC_CONFIG);
  }),
  http.post('/api/analytics/events', () => ok(null, '上报成功')),

  http.get('/api/analytics/overview', () => ok<AnalyticsOverview>({
    pv: 18420, uv: 3240, sessions: 5870, events: 42100, newUsers: 412, avgSessionMs: 184000,
    bounceRate: 34.2, avgPagesPerSession: 4.7, pvDelta: 12.4, uvDelta: 8.1, sessionsDelta: -3.2,
    bounceRateDelta: -1.8, activeNow: rand(8, 42),
  })),

  http.get('/api/analytics/trends', ({ request }) => {
    const u = new URL(request.url);
    const startDate = u.searchParams.get('startDate');
    const endDate = u.searchParams.get('endDate');
    const compare = u.searchParams.get('compare') === 'true';
    const days = startDate && endDate
      ? Math.min(Math.max(Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1, 1), 365)
      : Number(u.searchParams.get('days')) || 30;
    const dates = daysAxis(days);
    const gen = (base: number, jitter: number) => dates.map(() => rand(base - jitter, base + jitter));
    const buildSeries = () => ([
      { key: 'pv', name: '浏览量(PV)', data: gen(620, 180) },
      { key: 'uv', name: '访客数(UV)', data: gen(120, 40) },
      { key: 'sessions', name: '会话数', data: gen(200, 60) },
      { key: 'events', name: '事件数', data: gen(1400, 400) },
    ]);
    return ok<TrendSeries>({
      dates,
      series: buildSeries(),
      ...(compare ? { compare: { dates: dates.map((d) => shiftDate(d, -days)), series: buildSeries() } } : {}),
    });
  }),

  http.get('/api/analytics/realtime', () => {
    const perMinute = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (29 - i) * 60_000);
      return { minute: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, events: rand(2, 40) };
    });
    return ok<RealtimeStats>({
      activeUsers: rand(8, 40), pageViewsLast30Min: rand(120, 480), eventsLastMinute: rand(2, 30),
      topPages: MOCK_PAGE_ITEMS.slice(0, 6).map((p) => ({ pagePath: p.pagePath, pageTitle: p.pageTitle, active: rand(1, 20) })),
      recentEvents: MOCK_EVENTS.slice(0, 20).map((e) => ({ eventType: e.eventType, eventName: e.eventName, pagePath: e.pagePath, username: e.username, createdAt: e.createdAt })),
      perMinute,
    });
  }),

  http.get('/api/analytics/page-stats', ({ request }) => {
    const u = new URL(request.url);
    return ok<PageStats>({ ...paginate(MOCK_PAGE_ITEMS, u, 20), totalVisits: 2847, avgDwellMs: 58400 });
  }),
  http.get('/api/analytics/feature-stats', ({ request }) => {
    const u = new URL(request.url);
    return ok<FeatureStats>({ ...paginate(MOCK_FEATURE_ITEMS, u, 20), totalEvents: 8924 });
  }),
  http.get('/api/analytics/heatmap-pages', () => ok({ pages: MOCK_HEATMAP_PAGES })),
  http.get('/api/analytics/heatmap', ({ request }) => {
    const u = new URL(request.url);
    return ok<HeatmapData>(buildMockHeatmapData(u.searchParams.get('pagePath') ?? '/users', u.searchParams.get('componentArea') ?? 'table'));
  }),

  http.get('/api/analytics/user-stats', ({ request }) => {
    const u = new URL(request.url);
    const all = USERNAMES.map((name, i) => ({ userId: i + 1, username: name, totalEvents: rand(200, 2000), pageViews: rand(80, 600), uniquePages: rand(5, 30), featureUses: rand(40, 400), totalDwellMs: rand(600000, 6000000), lastActiveAt: mockDateTime() }));
    return ok<UserStats>(paginate(all, u, 20));
  }),

  http.get('/api/analytics/sessions', ({ request }) => {
    const u = new URL(request.url);
    const all: SessionListItem[] = Array.from({ length: 86 }, (_, i) => ({
      id: 5000 - i, sessionId: `sess-${1000 + i}`, userId: rand(1, 6), username: USERNAMES[i % USERNAMES.length],
      startedAt: mockDateTime(), endedAt: mockDateTime(), durationMs: rand(20000, 900000), pageCount: rand(1, 18), eventCount: rand(2, 90),
      entryPage: MOCK_PAGE_ITEMS[i % MOCK_PAGE_ITEMS.length].pagePath, exitPage: MOCK_PAGE_ITEMS[(i + 2) % MOCK_PAGE_ITEMS.length].pagePath,
      referrer: i % 3 === 0 ? 'https://www.google.com' : null, browser: BROWSERS[i % BROWSERS.length], os: OSES[i % OSES.length],
      deviceType: DEVICES[i % DEVICES.length], region: ['广东 深圳', '北京', '上海'][i % 3], isBounce: i % 4 === 0,
      memberId: null, source: 'web_admin', appId: 'admin', environment: 'production',
    }));
    return ok<PaginatedResponse<SessionListItem>>(paginate(all, u, 20));
  }),

  http.post('/api/analytics/funnel', async ({ request }) => {
    const body = (await request.json()) as { steps: { label: string }[]; comparison?: AnalyticsComparison };
    const steps = body.steps ?? [];
    const comparison: AnalyticsComparison = body.comparison ?? { type: 'none' };
    // Demo 模式按对比轴造出对应数量的序列，前端多序列渲染路径才有数据可验
    const seriesMeta = comparison.type === 'dimension'
      ? ['Chrome', 'Safari', 'Edge'].map((v) => ({ key: v, label: v }))
      : comparison.type === 'segments'
        ? comparison.segmentIds.map((id) => ({ key: `segment:${id}`, label: mockSegments.find((s) => s.id === id)?.name ?? `分群 ${id}` }))
        : [{ key: ANALYTICS_SERIES_OVERALL_KEY, label: '全部用户' }];

    const series = seriesMeta.map((meta, seriesIndex) => {
      const total = 1000 - seriesIndex * 120;
      let prev = total;
      const out = steps.map((s, i) => {
        const users = i === 0 ? total : Math.floor(prev * (0.55 + Math.random() * 0.3));
        const r = {
          label: s.label,
          users,
          conversionRate: Math.round((users / total) * 1000) / 10,
          stepConversionRate: Math.round((users / prev) * 1000) / 10,
          dropoff: prev - users,
          averageConversionMs: i === 0 ? null : rand(30_000, 3_600_000),
        };
        prev = users;
        return r;
      });
      return {
        ...meta,
        steps: out,
        totalUsers: total,
        overallConversionRate: out.length ? out[out.length - 1].conversionRate : 0,
      };
    });
    return ok<FunnelResult>({ series, comparison });
  }),

  http.post('/api/analytics/retention', async ({ request }) => {
    const body = (await request.json()) as {
      days?: number; mode?: 'first_seen' | 'window_first';
      periodType?: AnalyticsRetentionPeriodType; maxPeriods?: number; comparison?: AnalyticsComparison;
    };
    const periodType = body.periodType ?? 'day';
    const limits = ANALYTICS_RETENTION_PERIOD_LIMITS[periodType] ?? ANALYTICS_RETENTION_PERIOD_LIMITS.day;
    const days = body.days || limits.defaultDays;
    const mode = body.mode ?? 'first_seen';
    const maxPeriods = body.maxPeriods || limits.defaultPeriods;
    const comparison: AnalyticsComparison = body.comparison ?? { type: 'none' };
    // 队列轴按粒度收敛：日=按天，周=每 7 天一个队列，月=每 30 天一个队列
    const step = periodType === 'month' ? 30 : periodType === 'week' ? 7 : 1;
    const axis = daysAxis(days).filter((_, i) => i % step === 0);
    const periods = Array.from({ length: Math.min(maxPeriods, axis.length) }, (_, i) => i);

    const seriesMeta = comparison.type === 'dimension'
      ? ['desktop', 'mobile'].map((v) => ({ key: v, label: v }))
      : comparison.type === 'segments'
        ? comparison.segmentIds.map((id) => ({ key: `segment:${id}`, label: mockSegments.find((s) => s.id === id)?.name ?? `分群 ${id}` }))
        : [{ key: ANALYTICS_SERIES_OVERALL_KEY, label: '全部用户' }];

    const series = seriesMeta.map((meta, seriesIndex) => {
      const cohorts = axis.map((cohortDate, ci) => ({
        cohortDate,
        cohortSize: rand(20, 120),
        values: periods.map((p) => (ci + p >= axis.length ? null : Math.round((100 * Math.exp(-p / (4 + seriesIndex))) * 10) / 10)),
      }));
      const averages = periods.map((_, p) => {
        const vals = cohorts.map((c) => c.values[p]).filter((v): v is number => v != null);
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      });
      return { ...meta, cohorts, averages, totalUsers: cohorts.reduce((sum, c) => sum + c.cohortSize, 0) };
    });

    return ok<RetentionResult>({ series, periods, mode, periodType, days, comparison });
  }),

  http.post('/api/analytics/drill-users', async ({ request }) => {
    const body = (await request.json()) as { page?: number; pageSize?: number };
    const page = body.page ?? 1;
    const pageSize = body.pageSize ?? 20;
    const matched = rand(12, 260);
    const list = Array.from({ length: Math.min(pageSize, Math.max(0, matched - (page - 1) * pageSize)) }, (_, i) => {
      const seq = (page - 1) * pageSize + i + 1;
      return {
        distinctId: seq % 3 === 0 ? `anon-${seq}` : `u:${seq}`,
        identityType: (seq % 3 === 0 ? 'anonymous' : 'admin') as AnalyticsDrillUser['identityType'],
        userId: seq % 3 === 0 ? null : seq,
        memberId: null,
        displayName: seq % 3 === 0 ? null : `用户 ${seq}`,
        firstSeenAt: mockDateTime(),
        lastSeenAt: mockDateTime(),
      };
    });
    return ok<AnalyticsDrillUsersResult>({ list, total: matched, page, pageSize, matchedUsers: matched });
  }),

  http.get('/api/analytics/acquisition', ({ request }) => {
    const url = new URL(request.url);
    const dimension = (url.searchParams.get('dimension') as AnalyticsAcquisitionDimension) || 'channel';
    const model = (url.searchParams.get('model') as AnalyticsAttributionModel) || 'last_touch';
    const conversionEvent = url.searchParams.get('conversionEvent');
    const keys = dimension === 'channel'
      ? ANALYTICS_ACQUISITION_CHANNELS.slice(0, 5)
      : ['baidu', 'google', 'weibo', 'newsletter', ''];
    const rows = keys.map((key, i) => {
      const users = 900 - i * 140;
      const conversions = conversionEvent ? Math.floor(users * (0.08 + i * 0.02)) : 0;
      return {
        key,
        label: dimension === 'channel'
          ? ANALYTICS_ACQUISITION_CHANNEL_LABELS[key as keyof typeof ANALYTICS_ACQUISITION_CHANNEL_LABELS] ?? key
          : (key || '直接访问'),
        users,
        newUsers: Math.floor(users * 0.4),
        sessions: Math.floor(users * 1.7),
        conversions,
        conversionRate: users > 0 ? Math.round((conversions / users) * 1000) / 10 : 0,
      };
    });
    return ok<AnalyticsAcquisitionResult>({
      rows,
      dimension,
      model,
      conversionEvent,
      totalUsers: rows.reduce((sum, r) => sum + r.users, 0),
      totalConversions: rows.reduce((sum, r) => sum + r.conversions, 0),
      startDate: mockDateTime().slice(0, 10),
      endDate: mockDateTime().slice(0, 10),
    });
  }),

  http.get('/api/analytics/path', ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit')) || 30;
    const pages = MOCK_PAGE_ITEMS.map((p) => p.pagePath);
    const raw: Array<{ source: string; target: string; value: number }> = [];
    // 顺向链路
    for (let i = 0; i < pages.length - 1; i++) {
      raw.push({ source: pages[i], target: pages[i + 1], value: rand(40, 200) });
    }
    // 互跳（回流）：真实后台里 /a ⇄ /b 很常见，mock 必须覆盖，否则破环逻辑无从验证
    raw.push({ source: pages[1], target: pages[0], value: rand(20, 90) });
    raw.push({ source: pages[3], target: pages[2], value: rand(10, 60) });
    // 退出
    for (const page of pages.slice(0, 4)) {
      raw.push({ source: page, target: ANALYTICS_PATH_EXIT_PAGE, value: rand(15, 70) });
    }

    const sorted = raw.sort((a, b) => b.value - a.value).slice(0, limit);
    const seen = new Set<string>();
    const cyclic = new Set<string>();
    // 与服务端一致：指向已在链上的节点视为回边
    for (const l of sorted) {
      if (seen.has(`${l.target}>${l.source}`)) cyclic.add(`${l.source}>${l.target}`);
      seen.add(`${l.source}>${l.target}`);
    }
    const links = sorted.map((l) => ({ ...l, cyclic: cyclic.has(`${l.source}>${l.target}`) }));

    const acc = new Map<string, { out: number; in: number }>();
    const touch = (id: string) => acc.get(id) ?? (acc.set(id, { out: 0, in: 0 }), acc.get(id)!);
    for (const l of links) {
      touch(l.source).out += l.value;
      touch(l.target).in += l.value;
    }
    const nodes = [...acc.entries()]
      .map(([id, v]) => ({ id, label: id, value: Math.max(v.out, v.in) }))
      .sort((a, b) => b.value - a.value);

    return ok<PathResult>({
      nodes,
      links,
      totalTransitions: raw.reduce((s, l) => s + l.value, 0),
      cyclicValue: links.filter((l) => l.cyclic).reduce((s, l) => s + l.value, 0),
    });
  }),

  http.get('/api/analytics/user-timeline', ({ request }) => {
    const userId = Number(new URL(request.url).searchParams.get('userId')) || 1;
    return ok<UserTimeline>({
      userId, username: USERNAMES[(userId - 1) % USERNAMES.length], totalEvents: rand(200, 1200), firstSeenAt: mockDateTimeOffset(-30 * 86400000), lastSeenAt: mockDateTime(),
      items: MOCK_EVENTS.slice(0, 60).map((e) => ({ id: e.id, eventType: e.eventType, eventName: e.eventName, pagePath: e.pagePath, pageTitle: e.pageTitle, elementLabel: e.elementLabel, componentArea: e.componentArea, durationMs: e.durationMs, sessionId: e.sessionId, properties: null, createdAt: e.createdAt })),
    });
  }),

  http.get('/api/analytics/session-timeline', ({ request }) => {
    const sessionId = new URL(request.url).searchParams.get('sessionId') ?? 'sess-1000';
    return ok<SessionTimeline>({
      sessionId,
      username: USERNAMES[0],
      userId: 1,
      startedAt: mockDateTimeOffset(-1800000),
      durationMs: rand(60000, 1800000),
      entryPage: '/dashboard',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      items: MOCK_EVENTS.slice(0, 40).map((e, i) => ({ id: e.id, eventType: e.eventType, eventName: e.eventName, pagePath: e.pagePath, pageTitle: e.pageTitle, elementLabel: e.elementLabel, componentArea: e.componentArea, durationMs: e.durationMs, properties: null, createdAt: mockDateTimeOffset(-1800000 + i * 42000) })),
    });
  }),

  http.get('/api/analytics/reports', () => ok({ list: mockSavedReports })),
  http.post('/api/analytics/reports', async ({ request }) => {
    const body = (await request.json()) as { name: string; reportType?: string; config: Record<string, unknown> };
    const item: AnalyticsSavedReport = { id: nextReportId++, name: body.name, reportType: body.reportType ?? 'funnel', config: body.config, createdBy: 1, createdByName: 'admin', createdAt: mockDateTime() };
    mockSavedReports.unshift(item);
    return ok(item, '保存成功');
  }),
  http.delete('/api/analytics/reports/:id', ({ params }) => {
    mockSavedReports = mockSavedReports.filter((r) => r.id !== Number(params.id));
    return ok(null, '删除成功');
  }),

  http.get('/api/analytics/perf-stats', () => ok<PerfStats>({
    items: [
      { metricName: 'LCP', count: 1820, avg: 2180, p75: 2450, p90: 3200, p99: 4800, rating: 'needs-improvement' },
      { metricName: 'INP', count: 1820, avg: 150, p75: 180, p90: 240, p99: 520, rating: 'good' },
      { metricName: 'CLS', count: 1820, avg: 0.06, p75: 0.08, p90: 0.12, p99: 0.28, rating: 'good' },
      { metricName: 'FCP', count: 1820, avg: 1400, p75: 1650, p90: 2100, p99: 3400, rating: 'good' },
      { metricName: 'TTFB', count: 1820, avg: 620, p75: 720, p90: 980, p99: 1900, rating: 'good' },
    ],
  })),

  http.get('/api/analytics/events/:id', ({ params }) => {
    const id = Number(params.id);
    const base = MOCK_EVENTS.find((e) => e.id === id) ?? MOCK_EVENTS[0];
    const detail: EventDetail = {
      ...base, distinctId: `u:${base.userId}`, anonymousId: 'anon-abc123', scrollDepth: rand(0, 100),
      properties: { foo: 'bar', amount: 42 }, referrer: 'https://www.google.com', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
      browserVersion: '120', osVersion: '11', screenW: 1920, screenH: 1080, language: 'zh-CN', userAgent: 'Mozilla/5.0 ...',
      ip: '113.88.x.x', country: '中国', city: '深圳', metricName: null, metricValue: null, sdkVersion: '1.0.0',
    };
    return ok<EventDetail>(detail);
  }),
  http.get('/api/analytics/events', ({ request }) => {
    const u = new URL(request.url);
    return ok<PaginatedResponse<EventListItem>>(paginate(MOCK_EVENTS, u, 20));
  }),
  http.delete('/api/analytics/clean', () => ok(null, '共删除 1024 条事件数据')),


  // 站点管理
  http.get('/api/analytics/sites', ({ request }) => {
    const u = new URL(request.url);
    const name = u.searchParams.get('name') ?? '';
    const appId = u.searchParams.get('appId') ?? '';
    const status = u.searchParams.get('status') ?? '';
    const list = mockSites.filter((site) =>
      (!name || site.name.includes(name))
      && (!appId || site.appId === appId)
      && (!status || site.status === status));
    return ok<PaginatedResponse<AnalyticsSite>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/sites', async ({ request }) => {
    const body = (await request.json()) as Partial<AnalyticsSite>;
    const siteKey = mockSiteKey();
    if (mockSites.some((site) => site.siteKey === siteKey)) return badRequest('站点 Key 已存在', { status: 400 });
    const item: AnalyticsSite = {
      id: nextSiteId++, tenantId: null, tenantName: null, siteKey,
      name: body.name ?? '未命名站点', appId: body.appId ?? 'admin', allowedOrigins: body.allowedOrigins?.length ? body.allowedOrigins : null,
      dailyEventQuota: body.dailyEventQuota ?? null, todayUsage: 0, status: body.status ?? 'enabled', remark: body.remark ?? null,
      createdAt: mockDateTime(), updatedAt: mockDateTime(),
    };
    mockSites.unshift(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/analytics/sites/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as Partial<AnalyticsSite>;
    const idx = mockSites.findIndex((site) => site.id === id);
    if (idx === -1) return notFound('站点不存在', { status: 404 });
    mockSites[idx] = { ...mockSites[idx], ...body, allowedOrigins: body.allowedOrigins?.length ? body.allowedOrigins : null, updatedAt: mockDateTime() };
    return ok(mockSites[idx], '更新成功');
  }),
  http.delete('/api/analytics/sites/:id', ({ params }) => {
    mockSites = mockSites.filter((site) => site.id !== Number(params.id));
    return ok(null, '删除成功');
  }),
  http.post('/api/analytics/sites/:id/regenerate-key', ({ params }) => {
    const id = Number(params.id);
    const idx = mockSites.findIndex((site) => site.id === id);
    if (idx === -1) return notFound('站点不存在', { status: 404 });
    mockSites[idx] = { ...mockSites[idx], siteKey: mockSiteKey(), updatedAt: mockDateTime() };
    return ok(mockSites[idx], '重新生成成功');
  }),

  // 事件字典 CRUD
  http.get('/api/analytics/event-meta', ({ request }) => {
    const u = new URL(request.url);
    const kw = u.searchParams.get('keyword') ?? '';
    const list = mockEventMeta.filter((m) => !kw || m.eventName.includes(kw));
    return ok<PaginatedResponse<AnalyticsEventMeta>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/event-meta', async ({ request }) => {
    const body = (await request.json()) as Partial<AnalyticsEventMeta>;
    const item: AnalyticsEventMeta = { id: nextMetaId++, eventName: body.eventName ?? 'event', displayName: body.displayName ?? null, category: body.category ?? null, description: body.description ?? null, propertySchema: body.propertySchema ?? null, status: body.status ?? 'active', version: body.version ?? 1, ownerId: body.ownerId ?? null, ownerName: body.ownerName ?? null, strictMode: body.strictMode ?? false, eventCount: 0, firstSeenAt: null, lastSeenAt: null, createdAt: mockDateTime(), updatedAt: mockDateTime() };
    mockEventMeta.unshift(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/analytics/event-meta/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as Partial<AnalyticsEventMeta>;
    const idx = mockEventMeta.findIndex((m) => m.id === id);
    if (idx === -1) return notFound('不存在', { status: 404 });
    mockEventMeta[idx] = { ...mockEventMeta[idx], ...body, updatedAt: mockDateTime() };
    return ok(mockEventMeta[idx], '更新成功');
  }),
  http.delete('/api/analytics/event-meta/:id', ({ params }) => {
    mockEventMeta = mockEventMeta.filter((m) => m.id !== Number(params.id));
    return ok(null, '删除成功');
  }),

  // 租户覆盖（Tracking Plan 租户级启停）
  http.get('/api/analytics/event-overrides', ({ request }) => {
    const u = new URL(request.url);
    const eventName = u.searchParams.get('eventName') ?? '';
    const status = u.searchParams.get('status') ?? '';
    const list = mockEventOverrides.filter((o) =>
      (!eventName || o.eventName.includes(eventName)) && (!status || o.status === status));
    return ok<PaginatedResponse<AnalyticsEventOverride>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/event-overrides', async ({ request }) => {
    const body = (await request.json()) as { eventName: string; status: AnalyticsEventOverride['status']; reason?: string | null };
    if (mockEventOverrides.some((o) => o.eventName === body.eventName)) {
      return badRequest('该事件已存在租户覆盖配置', { status: 400 });
    }
    const item: AnalyticsEventOverride = {
      id: nextOverrideId++, tenantId: MOCK_OVERRIDE_TENANT_ID, eventName: body.eventName,
      status: body.status, reason: body.reason ?? null, createdAt: mockDateTime(), updatedAt: mockDateTime(),
    };
    mockEventOverrides.unshift(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/analytics/event-overrides/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as Partial<AnalyticsEventOverride>;
    const idx = mockEventOverrides.findIndex((o) => o.id === id);
    if (idx === -1) return notFound('不存在', { status: 404 });
    mockEventOverrides[idx] = { ...mockEventOverrides[idx], ...body, updatedAt: mockDateTime() };
    return ok(mockEventOverrides[idx], '更新成功');
  }),
  http.delete('/api/analytics/event-overrides/:id', ({ params }) => {
    mockEventOverrides = mockEventOverrides.filter((o) => o.id !== Number(params.id));
    return ok(null, '删除成功');
  }),

  // 质量看板
  http.get('/api/analytics/quality', ({ request }) => {
    const u = new URL(request.url);
    const days = Number(u.searchParams.get('days')) || 7;
    const eventName = u.searchParams.get('eventName') ?? '';
    const issueType = u.searchParams.get('issueType') ?? '';
    const { page, pageSize } = pageParams(u, 20);
    const since = mockDateOffset(-(Math.max(1, days) - 1));
    const filtered = mockQualityDaily.filter((row) =>
      row.statDate >= since
      && (!eventName || row.eventName.includes(eventName))
      && (!issueType || row.issueType === issueType));
    const totalsMap = new Map<AnalyticsQualityIssueType, number>();
    filtered.forEach((row) => totalsMap.set(row.issueType, (totalsMap.get(row.issueType) ?? 0) + row.count));
    const totals = Array.from(totalsMap.entries()).map(([type, count]) => ({ issueType: type, count }));
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);
    return ok<AnalyticsQualityQueryResult>({ items, totals, totalCount: filtered.length });
  }),

  // 事件调试（分页）
  http.get('/api/analytics/debug/events', ({ request }) => {
    const u = new URL(request.url);
    const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(u.searchParams.get('pageSize')) || 20));
    const eventName = u.searchParams.get('eventName') ?? '';
    const filtered = MOCK_EVENTS.filter((e) => !eventName || (e.eventName ?? '').includes(eventName));
    const source = filtered.slice((page - 1) * pageSize, page * pageSize);
    const list: AnalyticsDebugEvent[] = source.map((e) => ({
      id: e.id,
      eventId: `evt-${e.id}`,
      eventType: e.eventType,
      eventName: e.eventName,
      source: e.source,
      appId: e.appId,
      environment: e.environment,
      distinctId: `anon-${e.userId ?? 0}`,
      memberId: e.memberId,
      userId: e.userId,
      pagePath: e.pagePath,
      properties: e.elementKey ? { elementKey: e.elementKey, elementLabel: e.elementLabel, componentArea: e.componentArea } : null,
      createdAt: e.createdAt,
      issueTypes: Array.from(new Set(mockQualityDaily.filter((q) => q.eventName === e.eventName).map((q) => q.issueType))),
    }));
    return ok({ list, total: filtered.length, page, pageSize });
  }),

  // 设置
  http.get('/api/analytics/settings', () => ok<AnalyticsSettings>(mockSettings)),
  http.put('/api/analytics/settings', async ({ request }) => {
    const body = (await request.json()) as Partial<AnalyticsSettings>;
    mockSettings = { ...mockSettings, ...body, updatedAt: mockDateTime() };
    return ok(mockSettings, '更新成功');
  }),

  // 聚合
  http.get('/api/analytics/rollup', ({ request }) => {
    const days = Number(new URL(request.url).searchParams.get('days')) || 30;
    const items: AnalyticsRollupItem[] = daysAxis(days).reverse().map((statDate) => ({ statDate, pv: rand(400, 900), uv: rand(80, 200), sessions: rand(150, 300), events: rand(1000, 2000), bounceSessions: rand(30, 90), totalDwellMs: rand(20_000_000, 80_000_000) }));
    return ok({ items });
  }),
  http.post('/api/analytics/rollup/rebuild', ({ request }) => {
    const days = Number(new URL(request.url).searchParams.get('days')) || 30;
    return ok(createProgressingMockTask({
      taskType: 'analytics-rollup-rebuild',
      title: `重建近 ${days} 天聚合`,
      payload: { days },
      totalItems: Math.min(30, Math.max(1, days)),
    }), '任务已提交，可在任务中心查看进度');
  }),

  // ─── 通用事件分析工作台（行为中心阶段1）──────────────────────────────────────
  http.post('/api/analytics/events/query', async ({ request }) => {
    const body = (await request.json()) as AnalyticsEventQueryInput;
    const days = body.days ?? 30;
    const endDate = body.endDate ?? mockDateOffset(0);
    const startDate = body.startDate ?? shiftDate(endDate, -(days - 1));
    const groupBy: AnalyticsEventQueryGroupByField[] = body.groupBy && body.groupBy.length ? body.groupBy.slice(0, 2) : ['date'];
    const metric: AnalyticsEventQueryMetric = body.metric ?? 'events';
    const page = Math.max(1, body.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, body.pageSize ?? 20));

    let filtered = MOCK_EVENTS.filter((e) => {
      if (body.eventNames && body.eventNames.length && !body.eventNames.includes(e.eventName ?? '')) return false;
      if (body.source && e.source !== body.source) return false;
      if (body.appId && e.appId !== body.appId) return false;
      if (body.environment && e.environment !== body.environment) return false;
      if (body.deviceType && e.deviceType !== body.deviceType) return false;
      return true;
    });
    if (!filtered.length) filtered = MOCK_EVENTS.slice(0, 40);

    function dimValue(e: EventListItem, dim: AnalyticsEventQueryGroupByField, idx: number): string {
      switch (dim) {
        case 'date': return shiftDate(endDate, -(idx % days));
        case 'eventName': return e.eventName ?? '未知事件';
        case 'pagePath': return e.pagePath ?? '未知页面';
        case 'source': return e.source;
        case 'appId': return e.appId;
        case 'environment': return e.environment;
        case 'browser': return e.browser ?? '未知';
        case 'os': return e.os ?? '未知';
        case 'deviceType': return e.deviceType ?? '未知';
        case 'region': return e.region ?? '未知';
        default: return '未知';
      }
    }

    const bucket = new Map<string, { dimensions: Record<string, string>; count: number; users: Set<number> }>();
    filtered.forEach((e, idx) => {
      const dims: Record<string, string> = {};
      groupBy.forEach((dim) => { dims[dim] = dimValue(e, dim, idx); });
      const key = groupBy.map((dim) => dims[dim]).join('|');
      const entry = bucket.get(key) ?? { dimensions: dims, count: 0, users: new Set<number>() };
      entry.count += 1;
      if (e.userId != null) entry.users.add(e.userId);
      bucket.set(key, entry);
    });

    // Demo 模式下数值指标没有真实 properties 可算，用事件数派生一个量级合理的值，
    // 保证前端多指标渲染路径可验；口径差异不影响 Mock 的用途
    const valueOf = (entry: { count: number; users: Set<number> }): number => {
      switch (metric) {
        case 'uv': return entry.users.size;
        case 'eventsPerUser': return entry.users.size ? Math.round((entry.count / entry.users.size) * 100) / 100 : 0;
        case 'sum': return entry.count * 128;
        case 'avg': return 128;
        case 'min': return 12;
        case 'max': return 980;
        case 'p50': return 110;
        case 'p90': return 420;
        case 'p95': return 660;
        default: return entry.count;
      }
    };

    const allRows: AnalyticsEventQueryRow[] = Array.from(bucket.values())
      .map((entry) => ({ dimensions: entry.dimensions, value: valueOf(entry) }))
      .sort((a, b) => b.value - a.value);

    return ok<AnalyticsEventQueryResult>({
      ...pageResult(allRows, page, pageSize),
      queryMeta: { metric, metricProperty: body.metricProperty ?? null, groupBy, startDate, endDate },
    });
  }),

  // ─── 用户分群 CRUD + 成员物化（行为中心阶段1）────────────────────────────────
  http.get('/api/analytics/segments', ({ request }) => {
    const u = new URL(request.url);
    const keyword = u.searchParams.get('keyword') ?? '';
    const status = u.searchParams.get('status') ?? '';
    const list = mockSegments.filter((s) =>
      (!keyword || s.name.includes(keyword) || (s.description ?? '').includes(keyword))
      && (!status || s.status === status));
    return ok<PaginatedResponse<AnalyticsUserSegment>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/segments', async ({ request }) => {
    const body = (await request.json()) as Partial<AnalyticsUserSegment>;
    if (!body.name || !body.rules || !body.rules.conditions?.length) {
      return badRequest('分群名称与规则不能为空', { status: 400 });
    }
    if (mockSegments.some((s) => s.name === body.name)) {
      return badRequest('分群名称已存在', { status: 400 });
    }
    const item: AnalyticsUserSegment = {
      id: nextSegmentId++,
      tenantId: null,
      name: body.name,
      description: body.description ?? null,
      rules: body.rules,
      status: body.status ?? 'enabled',
      estimatedSize: 0,
      snapshotAt: null,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockSegments.unshift(item);
    mockSegmentMembers[item.id] = [];
    return ok(item, '创建成功');
  }),
  http.get('/api/analytics/segments/:id', ({ params }) => {
    const item = mockSegments.find((s) => s.id === Number(params.id));
    if (!item) return notFound('分群不存在', { status: 404 });
    return ok(item);
  }),
  http.put('/api/analytics/segments/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as Partial<AnalyticsUserSegment>;
    const idx = mockSegments.findIndex((s) => s.id === id);
    if (idx === -1) return notFound('分群不存在', { status: 404 });
    if (body.name && mockSegments.some((s) => s.id !== id && s.name === body.name)) {
      return badRequest('分群名称已存在', { status: 400 });
    }
    mockSegments[idx] = { ...mockSegments[idx], ...body, updatedAt: mockDateTime() };
    return ok(mockSegments[idx], '更新成功');
  }),
  http.delete('/api/analytics/segments/:id', ({ params }) => {
    const id = Number(params.id);
    mockSegments = mockSegments.filter((s) => s.id !== id);
    delete mockSegmentMembers[id];
    return ok(null, '删除成功');
  }),
  http.get('/api/analytics/segments/:id/members', ({ params, request }) => {
    const id = Number(params.id);
    const u = new URL(request.url);
    const list = mockSegmentMembers[id] ?? [];
    return ok<PaginatedResponse<AnalyticsSegmentMember>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/segments/:id/materialize', ({ params }) => {
    const id = Number(params.id);
    const idx = mockSegments.findIndex((s) => s.id === id);
    if (idx === -1) return notFound('分群不存在', { status: 404 });
    // Demo 模式简化：提交任务的同时即时刷新一次快照，近似真实的异步物化效果
    const size = rand(20, 200);
    mockSegments[idx] = { ...mockSegments[idx], estimatedSize: size, snapshotAt: mockDateTime(), updatedAt: mockDateTime() };
    mockSegmentMembers[id] = buildSegmentMembers(id, size);
    const task = createProgressingMockTask({
      taskType: 'analytics-segment-materialize',
      title: `重算分群 #${id} 成员`,
      payload: { segmentId: id },
      totalItems: Math.max(1, Math.ceil(size / 10)),
    });
    return ok<AsyncTask>(task, '任务已提交，可在任务中心查看进度');
  }),

  // ─── 行为中心阶段2：分群触达（消息中心 + Webhook）──────────────────────────────
  http.get('/api/analytics/campaigns', ({ request }) => {
    const u = new URL(request.url);
    const segmentId = Number(u.searchParams.get('segmentId')) || undefined;
    const status = u.searchParams.get('status') ?? '';
    const list = mockCampaigns.filter((c) => (!segmentId || c.segmentId === segmentId) && (!status || c.status === status));
    return ok<PaginatedResponse<AnalyticsSegmentCampaign>>(paginate(list, u, 20));
  }),
  http.post('/api/analytics/campaigns', async ({ request }) => {
    const body = (await request.json()) as Partial<AnalyticsSegmentCampaign>;
    const segment = mockSegments.find((s) => s.id === Number(body.segmentId));
    if (!segment) return notFound('分群不存在', { status: 404 });
    if (!body.name || !body.channel) return badRequest('触达名称与渠道不能为空', { status: 400 });
    if (body.channel === 'webhook' && !/^https?:\/\/.+/i.test(body.webhookUrl ?? '')) return badRequest('Webhook URL 不合法', { status: 400 });
    if (body.channel !== 'webhook' && !body.templateId) return badRequest('请选择消息模板', { status: 400 });
    const item: AnalyticsSegmentCampaign = {
      id: nextCampaignId++,
      tenantId: null,
      segmentId: segment.id,
      segmentName: segment.name,
      name: body.name,
      channel: body.channel,
      templateId: body.channel === 'webhook' ? null : body.templateId ?? null,
      webhookUrl: body.channel === 'webhook' ? body.webhookUrl ?? null : null,
      status: 'draft',
      totalCount: 0,
      sentCount: 0,
      failedCount: 0,
      lastRunAt: null,
      lastError: null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockCampaigns.unshift(item);
    return ok(item, '创建成功');
  }),
  http.put('/api/analytics/campaigns/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as Partial<AnalyticsSegmentCampaign>;
    const idx = mockCampaigns.findIndex((c) => c.id === id);
    if (idx === -1) return notFound('触达活动不存在', { status: 404 });
    if (mockCampaigns[idx].status !== 'draft') return badRequest('仅草稿状态可修改', { status: 400 });
    mockCampaigns[idx] = { ...mockCampaigns[idx], ...body, updatedAt: mockDateTime() };
    return ok(mockCampaigns[idx], '更新成功');
  }),
  http.delete('/api/analytics/campaigns/:id', ({ params }) => {
    const id = Number(params.id);
    const item = mockCampaigns.find((c) => c.id === id);
    if (item?.status === 'running') return badRequest('执行中的触达活动不可删除', { status: 400 });
    mockCampaigns = mockCampaigns.filter((c) => c.id !== id);
    return ok(null, '删除成功');
  }),
  http.post('/api/analytics/campaigns/:id/execute', ({ params }) => {
    const id = Number(params.id);
    const idx = mockCampaigns.findIndex((c) => c.id === id);
    if (idx === -1) return notFound('触达活动不存在', { status: 404 });
    const total = mockSegmentMembers[mockCampaigns[idx].segmentId]?.length ?? rand(20, 120);
    mockCampaigns[idx] = { ...mockCampaigns[idx], status: 'running', totalCount: total, sentCount: 0, failedCount: 0, lastError: null, updatedAt: mockDateTime() };
    setTimeout(() => {
      const current = mockCampaigns.findIndex((c) => c.id === id);
      if (current >= 0) {
        const failed = rand(0, Math.max(1, Math.floor(total * 0.2)));
        mockCampaigns[current] = { ...mockCampaigns[current], status: 'completed', sentCount: total - failed, failedCount: failed, lastRunAt: mockDateTime(), lastError: failed ? `模拟失败 ${failed} 条` : null, updatedAt: mockDateTime() };
      }
    }, 2000);
    const task = createProgressingMockTask({ taskType: 'analytics-campaign-execute', title: `执行分群触达 #${id}`, payload: { campaignId: id }, totalItems: Math.max(1, Math.ceil(total / 50)) });
    return ok<AsyncTask>(task, '任务已提交，可在任务中心查看进度');
  }),
];
