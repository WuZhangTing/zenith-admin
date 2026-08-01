import { http } from 'msw';
import { ok, badRequest, notFound, pageParams } from '@/mocks/utils/handlers';
import { mockSmsConfigs, getNextSmsConfigId } from '@/mocks/data/sms-configs';
import { mockDateTime } from '@/mocks/utils/date';
import type { SmsConfig } from '@zenith/shared/messaging';

function maskSecret<T extends { accessKeySecret?: string }>(c: T): T {
  return { ...c, accessKeySecret: '********' };
}

export const smsConfigsHandlers = [
  http.get('/api/sms-configs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const provider = url.searchParams.get('provider') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockSmsConfigs.filter((c) => {
      if (keyword && !c.name.includes(keyword) && !c.signName.includes(keyword)) return false;
      if (provider && c.provider !== provider) return false;
      if (status && c.status !== status) return false;
      return true;
    });
    const total = filtered.length;
    const list = filtered.slice((page - 1) * pageSize, page * pageSize).map(maskSecret);
    return ok({ list, total, page, pageSize });
  }),

  http.get('/api/sms-configs/default', () => {
    const c = mockSmsConfigs.find((x) => x.isDefault && x.status === 'enabled');
    return ok(c ? maskSecret(c) : null);
  }),

  http.get('/api/sms-configs/:id', ({ params }) => {
    const c = mockSmsConfigs.find((x) => x.id === Number(params.id));
    if (!c) return notFound('短信配置不存在', { status: 404 });
    return ok(maskSecret(c));
  }),

  http.post('/api/sms-configs', async ({ request }) => {
    const body = await request.json() as Partial<SmsConfig>;
    if (mockSmsConfigs.some((c) => c.name === body.name)) {
      return badRequest('配置名称已存在', { status: 400 });
    }
    const now = mockDateTime();
    const item: SmsConfig = {
      id: getNextSmsConfigId(),
      name: body.name ?? '',
      provider: body.provider ?? 'aliyun',
      accessKeyId: body.accessKeyId ?? '',
      accessKeySecret: body.accessKeySecret ?? '',
      region: body.region ?? null,
      signName: body.signName ?? '',
      isDefault: body.isDefault ?? false,
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    if (item.isDefault) mockSmsConfigs.forEach((c) => { c.isDefault = false; });
    mockSmsConfigs.push(item);
    return ok(maskSecret(item), '创建成功');
  }),

  http.put('/api/sms-configs/:id', async ({ params, request }) => {
    const c = mockSmsConfigs.find((x) => x.id === Number(params.id));
    if (!c) return notFound('短信配置不存在', { status: 404 });
    const body = await request.json() as Partial<SmsConfig>;
    if (body.name && body.name !== c.name && mockSmsConfigs.some((x) => x.name === body.name)) {
      return badRequest('配置名称已存在', { status: 400 });
    }
    // 留空 secret 表示不修改
    const next = { ...body };
    if (!next.accessKeySecret) delete next.accessKeySecret;
    if (next.isDefault) mockSmsConfigs.forEach((x) => { if (x.id !== c.id) x.isDefault = false; });
    Object.assign(c, next, { updatedAt: mockDateTime() });
    return ok(maskSecret(c), '更新成功');
  }),

  http.post('/api/sms-configs/:id/default', ({ params }) => {
    const c = mockSmsConfigs.find((x) => x.id === Number(params.id));
    if (!c) return notFound('短信配置不存在', { status: 404 });
    mockSmsConfigs.forEach((x) => { x.isDefault = x.id === c.id; });
    c.updatedAt = mockDateTime();
    return ok(maskSecret(c), '设置默认成功');
  }),

  http.delete('/api/sms-configs/:id', ({ params }) => {
    const idx = mockSmsConfigs.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('短信配置不存在', { status: 404 });
    mockSmsConfigs.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
