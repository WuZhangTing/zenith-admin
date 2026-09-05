import { identitySecurityContract, type IdentitySecurityPolicy, type LoginRiskEvent } from '@zenith/shared/identity';
import { mock } from '@/mocks/utils/contract';
import { mockDateTime } from '@/mocks/utils/date';

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
  mock(identitySecurityContract.policy, ({ ok }) => {
    return ok(policy);
  }),

  mock(identitySecurityContract.updatePolicy, ({ body, ok }) => {
    policy = body;
    return ok(policy, '更新成功');
  }),

  mock(identitySecurityContract.riskEvents, ({ query, ok, paginate }) => {
    const keyword = query.keyword ?? '';
    const list = keyword
      ? riskEvents.filter((item) => item.username.includes(keyword) || item.reason.includes(keyword) || (item.ip ?? '').includes(keyword))
      : riskEvents;
    return ok(paginate(list));
  }),
];
