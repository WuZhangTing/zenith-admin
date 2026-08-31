import { http } from 'msw';
import { ok, notFound, pageParams, pageResult } from '@/mocks/utils/handlers';
import type { OAuth2Client, OAuth2ClientCreated } from '@zenith/shared/open-platform';
import { mockDateTime } from '@/mocks/utils/date';

type ClientEntry = OAuth2Client;

let nextId = 1;

export const mockOAuth2Clients: ClientEntry[] = [
  {
    id: nextId++,
    clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    clientSecretPrefix: 'oas_demoapp1...',
    name: '示例应用（授权码模式）',
    description: '用于演示 authorization_code + PKCE 流程',
    logoUrl: null,
    redirectUris: ['https://demo-app.example.com/callback'],
    allowedScopes: ['openid', 'profile', 'email'],
    grantTypes: ['authorization_code', 'refresh_token'],
    isPublic: false,
    ratePlanId: 2,
    signEnabled: true,
    ipAllowlist: [],
    environment: 'production',
    reviewStatus: 'approved',
    reviewComment: null,
    submittedAt: '2024-05-30 10:00:00',
    reviewedAt: '2024-05-31 10:00:00',
    reviewedBy: 1,
    previousSecretExpiresAt: null,
    status: 'enabled',
    ownerId: 1,
    createdAt: '2024-06-01 10:00:00',
    updatedAt: '2024-06-01 10:00:00',
  },
  {
    id: nextId++,
    clientId: 'f0e1d2c3-b4a5-6789-0abc-de1234567891',
    clientSecretPrefix: 'oas_svcapp001...',
    name: '内部服务（客户端凭证）',
    description: '用于后端服务间调用，无用户上下文',
    logoUrl: null,
    redirectUris: [],
    allowedScopes: ['profile'],
    grantTypes: ['client_credentials'],
    isPublic: false,
    ratePlanId: 3,
    signEnabled: true,
    ipAllowlist: ['10.0.0.0/8'],
    environment: 'production',
    reviewStatus: 'approved',
    reviewComment: null,
    submittedAt: '2024-06-01 10:00:00',
    reviewedAt: '2024-06-01 12:00:00',
    reviewedBy: 1,
    previousSecretExpiresAt: null,
    status: 'enabled',
    ownerId: 1,
    createdAt: '2024-06-02 09:00:00',
    updatedAt: '2024-06-02 09:00:00',
  },
  {
    id: nextId++,
    clientId: 'c0ffee00-1234-5678-9abc-def012345678',
    clientSecretPrefix: null,
    name: '移动端公开客户端',
    description: '原生 App，使用 PKCE 无 secret',
    logoUrl: null,
    redirectUris: ['myapp://oauth/callback'],
    allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
    grantTypes: ['authorization_code', 'refresh_token'],
    isPublic: true,
    ratePlanId: 1,
    signEnabled: false,
    ipAllowlist: [],
    environment: 'sandbox',
    reviewStatus: 'pending',
    reviewComment: null,
    submittedAt: '2024-06-03 09:00:00',
    reviewedAt: null,
    reviewedBy: null,
    previousSecretExpiresAt: null,
    status: 'enabled',
    ownerId: 1,
    createdAt: '2024-06-03 08:00:00',
    updatedAt: '2024-06-03 08:00:00',
  },
  {
    id: nextId++,
    clientId: 'sandbox-pay-1234-5678-9abc-def012345678',
    clientSecretPrefix: 'oas_sandboxpay...',
    name: '沙箱支付服务',
    description: '用于支付宝沙箱支付演示',
    logoUrl: null,
    redirectUris: [],
    allowedScopes: ['payment:intent:create', 'payment:intent:read'],
    grantTypes: ['client_credentials'],
    isPublic: false,
    ratePlanId: 1,
    signEnabled: true,
    ipAllowlist: [],
    environment: 'sandbox',
    reviewStatus: 'approved',
    reviewComment: null,
    submittedAt: '2024-06-03 10:00:00',
    reviewedAt: '2024-06-03 11:00:00',
    reviewedBy: 1,
    previousSecretExpiresAt: null,
    status: 'enabled',
    ownerId: 1,
    createdAt: '2024-06-03 10:00:00',
    updatedAt: '2024-06-03 11:00:00',
  },
];

const mockClients = mockOAuth2Clients;

const BASE = '/api/oauth2/clients';

export const oauth2AppsHandlers = [
  // 列表
  http.get(BASE, ({ request: req }) => {
    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const environment = url.searchParams.get('environment');
    const reviewStatus = url.searchParams.get('reviewStatus');
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockOAuth2Clients.filter((client) =>
      (!keyword || client.name.includes(keyword))
      && (!environment || client.environment === environment)
      && (!reviewStatus || client.reviewStatus === reviewStatus),
    );
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),

  // 应用选项（供 Webhook/SDK 下拉）
  http.get(`${BASE}/options`, () => {
    return ok(mockOAuth2Clients.filter((c) => c.status === 'enabled').map((c) => ({
      id: c.id,
      clientId: c.clientId,
      name: c.name,
      environment: c.environment,
      reviewStatus: c.reviewStatus,
      isPublic: c.isPublic,
      signEnabled: Boolean(c.signEnabled),
    })), 'success');
  }),

  // 我的已授权应用（用户自助）
  //
  // 注意：必须注册在 `${BASE}/:id` 之前，否则 `/my-grants` 会被当成 id 匹配掉。
  http.get(`${BASE}/my-grants`, ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const list = mockClients.slice(0, 2).map((client, index) => ({
      id: index + 1,
      clientId: client.clientId,
      appName: client.name,
      appLogoUrl: client.logoUrl ?? null,
      appDescription: client.description ?? null,
      environment: client.environment,
      scopes: client.allowedScopes.slice(0, 2),
      createdAt: '2026-06-01 10:00:00',
      updatedAt: '2026-06-01 10:00:00',
    }));
    return ok(pageResult(list, page, pageSize), 'success');
  }),

  http.delete(`${BASE}/my-grants/:id`, () => ok(null, '授权已撤销')),

  http.get(`${BASE}/tokens`, ({ request }) => {
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url, 20);
    return ok({ list: [], total: 0, page, pageSize }, 'success');
  }),

  http.delete(`${BASE}/tokens/:id`, () => {
    return ok(null, '令牌已撤销');
  }),

  http.get(`${BASE}/:id/grants`, ({ params, request }) => {
    const client = mockClients.find((item) => item.id === Number(params.id));
    if (!client) return notFound('不存在', { status: 404 });
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(url);
    const list = [{
      id: 1,
      userId: 1,
      username: 'admin',
      nickname: '系统管理员',
      clientId: client.clientId,
      scopes: client.allowedScopes.slice(0, 2),
      createdAt: '2026-06-01 10:00:00',
      updatedAt: '2026-06-01 10:00:00',
    }];
    return ok({ list, total: list.length, page, pageSize }, 'success');
  }),

  // 创建
  http.post(BASE, async ({ request: req }) => {
    const body = await req.json() as Omit<OAuth2Client, 'id' | 'createdAt' | 'updatedAt' | 'clientId' | 'clientSecretPrefix' | 'ownerId'>;
    const clientId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const clientSecret = `oas_mock${randomHex(32)}`;
    const newClient: ClientEntry = {
      id: nextId++,
      clientId,
      clientSecretPrefix: body.isPublic ? null : `${clientSecret.slice(0, 10)}...`,
      name: body.name,
      description: body.description ?? null,
      logoUrl: body.logoUrl ?? null,
      redirectUris: body.redirectUris,
      allowedScopes: body.allowedScopes,
      grantTypes: body.grantTypes,
      isPublic: body.isPublic,
      ratePlanId: body.ratePlanId ?? null,
      signEnabled: body.signEnabled ?? false,
      ipAllowlist: body.ipAllowlist ?? [],
      environment: body.environment ?? 'production',
      reviewStatus: 'approved',
      reviewComment: null,
      submittedAt: null,
      reviewedAt: mockDateTime(),
      reviewedBy: 1,
      previousSecretExpiresAt: null,
      status: 'enabled',
      ownerId: 1,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockClients.push(newClient);
    const result: OAuth2ClientCreated = { ...newClient, clientSecret: body.isPublic ? '' : clientSecret };
    return ok(result, '创建成功');
  }),

  // 详情
  http.get(`${BASE}/:id`, ({ params }) => {
    const found = mockClients.find((c) => c.id === Number(params.id));
    if (!found) return notFound('不存在', { status: 404 });
    return ok(found, 'success');
  }),

  // 更新
  http.put(`${BASE}/:id`, async ({ params, request: req }) => {
    const idx = mockClients.findIndex((c) => c.id === Number(params.id));
    if (idx === -1) return notFound('不存在', { status: 404 });
    const body = await req.json() as Partial<OAuth2Client>;
    mockClients[idx] = { ...mockClients[idx], ...body, updatedAt: mockDateTime() };
    return ok(mockClients[idx], '更新成功');
  }),

  // 删除
  http.delete(`${BASE}/:id`, ({ params }) => {
    const idx = mockClients.findIndex((c) => c.id === Number(params.id));
    if (idx === -1) return notFound('不存在', { status: 404 });
    mockClients.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // 重置 Secret
  http.post(`${BASE}/:id/regenerate-secret`, ({ params }) => {
    const found = mockClients.find((c) => c.id === Number(params.id));
    if (!found) return notFound('不存在', { status: 404 });
    const clientSecret = `oas_mock${randomHex(32)}`;
    found.clientSecretPrefix = `${clientSecret.slice(0, 10)}...`;
    found.previousSecretExpiresAt = '2026-07-16 10:00:00';
    return ok({ clientId: found.clientId, clientSecret, previousValidUntil: found.previousSecretExpiresAt }, 'secret 已重置');
  }),

  http.post(`${BASE}/:id/review`, async ({ params, request }) => {
    const found = mockClients.find((client) => client.id === Number(params.id));
    if (!found) return notFound('不存在', { status: 404 });
    const body = await request.json() as { action: 'approve' | 'reject'; comment?: string };
    found.reviewStatus = body.action === 'approve' ? 'approved' : 'rejected';
    found.reviewComment = body.comment ?? null;
    found.reviewedAt = mockDateTime();
    found.reviewedBy = 1;
    return ok(found, '审核完成');
  }),

];

function randomHex(len: number) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
