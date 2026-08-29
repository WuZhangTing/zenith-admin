import { http } from 'msw';
import { ok, paginate } from '@/mocks/utils/handlers';
import type { ReplaySession, ReplaySessionDetail } from '@zenith/shared/analytics';
import { mockDateTimeOffset } from '../utils/date';

const sessions: ReplaySession[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    sessionId: 'demo-session-1',
    mode: 'buffer',
    status: 'completed',
    triggers: [{ type: 'error', at: mockDateTimeOffset(-3600_000), refId: 'js_error' }],
    startedAt: mockDateTimeOffset(-3660_000),
    lastActivityAt: mockDateTimeOffset(-3540_000),
    endedAt: mockDateTimeOffset(-3540_000),
    durationMs: 120_000,
    segmentCount: 3,
    totalBytes: 384_000,
    errorCount: 2,
    pageCount: 3,
    clickCount: 14,
    entryPageUrl: 'https://demo.zenith.local/orders',
    source: 'web_admin',
    appId: 'admin',
    environment: 'production',
    userId: 1,
    username: '管理员',
    memberId: null,
    browser: 'Chrome',
    os: 'Windows',
    deviceType: 'desktop',
    sdkVersion: '2.5.0',
    createdAt: mockDateTimeOffset(-3660_000),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    sessionId: 'demo-session-2',
    mode: 'stream',
    status: 'completed',
    triggers: [{ type: 'sampled', at: mockDateTimeOffset(-7200_000) }],
    startedAt: mockDateTimeOffset(-7200_000),
    lastActivityAt: mockDateTimeOffset(-6900_000),
    endedAt: mockDateTimeOffset(-6900_000),
    durationMs: 300_000,
    segmentCount: 12,
    totalBytes: 1_820_000,
    errorCount: 0,
    pageCount: 8,
    clickCount: 42,
    entryPageUrl: 'https://demo.zenith.local/dashboard',
    source: 'web_member',
    appId: 'member',
    environment: 'production',
    userId: null,
    username: null,
    memberId: 6,
    browser: 'Safari',
    os: 'iOS',
    deviceType: 'mobile',
    sdkVersion: '2.5.0',
    createdAt: mockDateTimeOffset(-7200_000),
  },
];

export const sessionReplaysHandlers = [
  http.get('/api/session-replays/stats', () => ok({
    totalBytes: 2_254_000, totalCount: 2, todayBytes: 384_000, todayCount: 1, quotaMb: 4096, usagePercent: 1,
  })),
  http.get('/api/session-replays', ({ request }) => {
    const url = new URL(request.url);
    return ok(paginate(sessions, url));
  }),
  http.get('/api/session-replays/:id', ({ params }) => {
    const found = sessions.find((s) => s.id === params.id) ?? sessions[0];
    const detail: ReplaySessionDetail = {
      ...found,
      // Demo 模式无真实 rrweb 分片：播放器显示「暂无回放数据」空态
      segments: [],
      errors: found.errorCount > 0
        ? [{ id: 9001, groupId: 1, errorType: 'js_error', level: 'error', message: "TypeError: Cannot read properties of undefined (reading 'status')", createdAt: found.triggers[0]?.at ?? found.startedAt }]
        : [],
    };
    return ok(detail);
  }),
  http.delete('/api/session-replays/batch', () => ok(null, '已删除 1 条回放')),
];
