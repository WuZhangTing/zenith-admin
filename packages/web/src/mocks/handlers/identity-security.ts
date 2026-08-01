import { http } from 'msw';
import { ok, paginate } from '@/mocks/utils/handlers';
import type { LoginRiskEvent } from '@zenith/shared/identity';
import type { IdentitySecurityPolicy } from '@zenith/shared/platform';
import { mockDateTime } from '../utils/date';

let policy: IdentitySecurityPolicy = {
  password: { minLength: 6, requireUppercase: false, requireSpecialChar: false, expiryEnabled: false, expiryDays: 90 },
  lockout: { maxAttempts: 10, durationMinutes: 30 },
  mfa: { enabled: false, mode: 'off', rememberDeviceDays: 30 },
  risk: { enabled: false, newDeviceAction: 'allow' },
};

const riskEvents: LoginRiskEvent[] = [
  {
    id: 1,
    userId: 1,
    username: 'admin',
    tenantId: null,
    riskLevel: 'medium',
    reason: '新设备登录',
    action: 'challenge',
    ip: '127.0.0.1',
    location: '本地网络',
    userAgent: 'Mozilla/5.0 Chrome/124',
    createdAt: mockDateTime(),
  },
];

export const identitySecurityHandlers = [
  http.get('/api/identity-security/policy', () => {
    return ok(policy);
  }),

  http.put('/api/identity-security/policy', async ({ request }) => {
    policy = await request.json() as IdentitySecurityPolicy;
    return ok(policy, '更新成功');
  }),

  http.get('/api/identity-security/risk-events', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const list = keyword
      ? riskEvents.filter((item) => item.username.includes(keyword) || item.reason.includes(keyword) || (item.ip ?? '').includes(keyword))
      : riskEvents;
    return ok(paginate(list, url));
  }),
];
