import { http } from 'msw';
import { ok, badRequest, notFound } from '@/mocks/utils/handlers';
import { mockDateTime, mockDateTimeOffset } from '../utils/date';

interface MockRule {
  id: number;
  name: string;
  description: string | null;
  windowMs: number;
  limit: number;
  keyType: 'ip' | 'user' | 'ip_path';
  enabled: boolean;
  mode: 'enforce' | 'monitor';
  algorithm: 'fixed_window' | 'sliding_window';
  allowlist: string[];
  priority: number;
  alertThreshold: number | null;
  blockedMessage: string | null;
  pathPatterns: string[];
  predefined: boolean;
  mountSource: 'code' | 'path' | 'code_path' | 'none';
  createdAt: string;
  updatedAt: string;
}

const RULE_BASE = { mode: 'enforce' as const, algorithm: 'fixed_window' as const, allowlist: [] as string[], priority: 0, alertThreshold: null };

const rules: MockRule[] = [
  { ...RULE_BASE, id: 1, name: 'auth',      description: '登录接口限流',          windowMs: 3 * 60 * 1000,     limit: 20, keyType: 'ip', enabled: false,  blockedMessage: '登录尝试过于频繁，请 3 分钟后再试',  pathPatterns: [],  predefined: true, mountSource: 'code', createdAt: mockDateTime(), updatedAt: mockDateTime() },
  { ...RULE_BASE, id: 2, name: 'captcha',   description: '验证码接口限流',        windowMs: 60 * 1000,         limit: 30, keyType: 'ip', enabled: true,  blockedMessage: '验证码请求过于频繁，请稍后再试',     pathPatterns: [],  predefined: true, mountSource: 'code', createdAt: mockDateTime(), updatedAt: mockDateTime() },
  { ...RULE_BASE, id: 3, name: 'sensitive', description: '敏感操作（注册/重置）限流', windowMs: 60 * 60 * 1000, limit: 5,  keyType: 'ip', enabled: false, blockedMessage: '操作过于频繁，请 1 小时后重试',     pathPatterns: [],  predefined: true, mountSource: 'code', createdAt: mockDateTime(), updatedAt: mockDateTime() },
  { ...RULE_BASE, id: 4, name: 'chat_send', description: '聊天消息发送限流（按用户）', windowMs: 60 * 1000,      limit: 60, keyType: 'user', enabled: true, blockedMessage: '消息发送过于频繁，请稍后再试',    pathPatterns: [],  predefined: true, mountSource: 'code', createdAt: mockDateTime(), updatedAt: mockDateTime() },
  { ...RULE_BASE, id: 5, name: 'report_public_share', description: '报表公开分享访问限流', windowMs: 60 * 1000, limit: 120, keyType: 'ip', enabled: true, mode: 'monitor', blockedMessage: '访问过于频繁，请稍后再试', pathPatterns: ['/api/report/public/*'], predefined: true, mountSource: 'path', createdAt: mockDateTime(), updatedAt: mockDateTime() },
];

interface MockRecent { at: string; key: string; path: string; monitored: boolean }

const stats: Record<string, { hit: number; blocked: number; recent: MockRecent[] }> = {
  auth:      { hit: 8421, blocked: 12, recent: [
    { at: mockDateTimeOffset(-5 * 60 * 1000),  key: '203.0.113.42',  path: '/api/auth/login', monitored: false },
    { at: mockDateTimeOffset(-22 * 60 * 1000), key: '198.51.100.7',  path: '/api/auth/login', monitored: false },
  ] },
  captcha:   { hit: 12034, blocked: 3, recent: [
    { at: mockDateTimeOffset(-1 * 60 * 60 * 1000), key: '192.0.2.55', path: '/api/auth/captcha', monitored: false },
  ] },
  sensitive: { hit: 187, blocked: 0, recent: [] },
  chat_send: { hit: 4560, blocked: 1, recent: [
    { at: mockDateTimeOffset(-40 * 60 * 1000), key: 'u:2', path: '/api/chat/conversations/1/messages', monitored: false },
  ] },
  report_public_share: { hit: 960, blocked: 4, recent: [
    { at: mockDateTimeOffset(-12 * 60 * 1000), key: '198.51.100.23', path: '/api/report/public/abc', monitored: true },
  ] },
};

function mountSourceOf(rule: MockRule): MockRule['mountSource'] {
  const code = rule.mountSource === 'code' || rule.mountSource === 'code_path';
  const path = rule.pathPatterns.length > 0;
  if (code && path) return 'code_path';
  if (code) return 'code';
  if (path) return 'path';
  return 'none';
}

export const rateLimitHandlers = [
  http.get('/api/rate-limit/rules', () =>
    ok(rules.map((r) => ({ ...r, mountSource: mountSourceOf(r) })), 'success'),
  ),

  http.patch('/api/rate-limit/rules/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const patch = await request.json() as Partial<MockRule>;
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return notFound('规则不存在', { status: 404 });
    rules[idx] = { ...rules[idx], ...patch, updatedAt: mockDateTime() };
    rules[idx].mountSource = mountSourceOf(rules[idx]);
    return ok(rules[idx], '规则已更新');
  }),

  http.post('/api/rate-limit/rules', async ({ request }) => {
    const body = await request.json() as Omit<MockRule, 'id' | 'predefined' | 'mountSource' | 'createdAt' | 'updatedAt'>;
    const existing = rules.find((r) => r.name === body.name);
    if (existing) return badRequest(`规则名称 "${body.name}" 已存在`, { status: 400 });
    const newRule: MockRule = {
      ...RULE_BASE,
      ...body,
      id: rules.length + 1,
      predefined: false,
      mountSource: (body.pathPatterns ?? []).length > 0 ? 'path' : 'none',
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    rules.push(newRule);
    return ok(newRule, '规则已创建');
  }),

  http.delete('/api/rate-limit/rules/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return notFound('规则不存在', { status: 404 });
    if (rules[idx].predefined) {
      return badRequest('内置规则不可删除', { status: 400 });
    }
    rules.splice(idx, 1);
    return ok(null, '规则已删除');
  }),

  http.get('/api/rate-limit/stats', () => {
    const items = rules.map((r) => {
      const s = stats[r.name] ?? { hit: 0, blocked: 0, recent: [] };
      const now = new Date();
      now.setMinutes(0, 0, 0);
      const hourlySeries = Array.from({ length: 24 }, (_, i) => {
        const t = new Date(now.getTime() - (23 - i) * 3600 * 1000);
        const mm = String(t.getMonth() + 1).padStart(2, '0');
        const dd = String(t.getDate()).padStart(2, '0');
        const hh = String(t.getHours()).padStart(2, '0');
        return {
          hour: `${mm}-${dd} ${hh}:00`,
          hits: r.enabled ? Math.floor(Math.random() * 600) + 50 : 0,
          blocked: r.enabled ? Math.floor(Math.random() * 5) : 0,
        };
      });
      return {
        name: r.name,
        description: r.description,
        windowMs: r.windowMs,
        limit: r.limit,
        keyType: r.keyType,
        enabled: r.enabled,
        mode: r.mode,
        hitCount: s.hit,
        blockedCount: s.blocked,
        blockRate: s.hit > 0 ? Math.round((s.blocked / s.hit) * 10000) / 100 : 0,
        recentBlocks: s.recent,
        hourlySeries,
      };
    });
    return ok({ items }, 'success');
  }),

  http.post('/api/rate-limit/unblock', async ({ request }) => {
    const { name, key } = await request.json() as { name: string; key: string };
    const bucket = stats[name];
    const had = bucket ? bucket.recent.some((b) => b.key === key) : false;
    if (bucket) bucket.recent = bucket.recent.filter((b) => b.key !== key);
    return ok(null, had ? '解封成功' : '未找到活跃计数窗口（可能已过期或已解封）');
  }),

  http.post('/api/rate-limit/reset-stats', async ({ request }) => {
    const { name } = await request.json() as { name: string };
    const bucket = stats[name];
    if (bucket) { bucket.hit = 0; bucket.blocked = 0; bucket.recent = []; }
    return ok(null, '统计已清空');
  }),
];
