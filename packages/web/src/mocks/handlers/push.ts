/**
 * App 推送 Mock（Demo 模式):配置 CRUD / 测试发送 / 发送记录 / 设备中心。
 */
import { http } from 'msw';
import type { PushConfig } from '@zenith/shared/messaging';
import { badRequest, notFound, ok, paginate } from '@/mocks/utils/handlers';
import { mockDateTime } from '@/mocks/utils/date';
import {
  getNextPushConfigId,
  getNextPushSendLogId,
  mockClientDevices,
  mockPushConfigs,
  mockPushSendLogs,
} from '../data/push';

export const pushHandlers = [
  // ─── 推送配置 ───────────────────────────────────────────────────────────────
  http.get('/api/push-configs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockPushConfigs];
    if (keyword) list = list.filter((c) => c.name.includes(keyword) || (c.remark ?? '').includes(keyword));
    if (status) list = list.filter((c) => c.status === status);
    return ok(paginate(list, url));
  }),

  http.get('/api/push-configs/:id', ({ params }) => {
    const config = mockPushConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('推送配置不存在', { status: 404 });
    return ok({ ...config, masterSecret: '' });
  }),

  http.post('/api/push-configs', async ({ request }) => {
    const body = (await request.json()) as Partial<PushConfig>;
    const now = mockDateTime();
    if (body.isDefault) for (const c of mockPushConfigs) c.isDefault = false;
    const config: PushConfig = {
      id: getNextPushConfigId(),
      name: body.name ?? '',
      provider: body.provider ?? 'jpush',
      appKey: body.appKey ?? '',
      apnsProduction: body.apnsProduction ?? false,
      isDefault: body.isDefault ?? false,
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockPushConfigs.push(config);
    return ok(config, '创建成功');
  }),

  http.put('/api/push-configs/:id/default', ({ params }) => {
    const config = mockPushConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('推送配置不存在', { status: 404 });
    for (const c of mockPushConfigs) c.isDefault = false;
    config.isDefault = true;
    return ok(config, '设置成功');
  }),

  http.post('/api/push-configs/:id/test', async ({ params, request }) => {
    const config = mockPushConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('推送配置不存在', { status: 404 });
    const body = (await request.json()) as { registrationId?: string; title?: string; content?: string };
    if (!body.registrationId) return badRequest('RegistrationID 不能为空', { status: 400 });
    const now = mockDateTime();
    mockPushSendLogs.unshift({
      id: getNextPushSendLogId(),
      configId: config.id,
      provider: config.provider,
      subjectType: null, subjectId: null, subjectName: null,
      deviceCount: 1,
      title: body.title ?? 'Zenith 推送测试',
      content: body.content ?? '这是一条测试推送',
      link: null, eventKey: null,
      status: 'success', providerMsgId: `demo-${Date.now()}`, errorMsg: null,
      source: 'test', sentAt: now, createdAt: now,
    });
    return ok({ msgId: `demo-${Date.now()}` }, '发送成功');
  }),

  http.put('/api/push-configs/:id', async ({ params, request }) => {
    const config = mockPushConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('推送配置不存在', { status: 404 });
    const body = (await request.json()) as Partial<PushConfig>;
    if (body.isDefault) for (const c of mockPushConfigs) c.isDefault = false;
    // masterSecret 留空表示不更新;脱敏字段不覆盖
    delete body.masterSecret;
    Object.assign(config, { ...body, updatedAt: mockDateTime() });
    return ok(config, '更新成功');
  }),

  http.delete('/api/push-configs/:id', ({ params }) => {
    const idx = mockPushConfigs.findIndex((c) => c.id === Number(params.id));
    if (idx === -1) return notFound('推送配置不存在', { status: 404 });
    mockPushConfigs.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 发送记录 ───────────────────────────────────────────────────────────────
  http.get('/api/push-send-logs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockPushSendLogs];
    if (keyword) {
      list = list.filter((l) => l.title.includes(keyword) || l.content.includes(keyword) || (l.eventKey ?? '').includes(keyword));
    }
    if (status) list = list.filter((l) => l.status === status);
    return ok(paginate(list, url));
  }),

  // ─── 设备中心（挂在应用版本域路径下）───────────────────────────────────────
  http.get('/api/app-releases/devices', ({ request }) => {
    const url = new URL(request.url);
    const appId = url.searchParams.get('appId');
    const platform = url.searchParams.get('platform') || '';
    const subjectType = url.searchParams.get('subjectType') || '';
    const pushBound = url.searchParams.get('pushBound') || '';
    const keyword = url.searchParams.get('keyword') || '';
    let list = [...mockClientDevices];
    if (appId) list = list.filter((d) => d.appId === Number(appId));
    if (platform) list = list.filter((d) => d.platform === platform);
    if (subjectType) list = list.filter((d) => d.subjectType === subjectType);
    if (pushBound === 'true') list = list.filter((d) => d.pushRegistrationId);
    if (keyword) {
      list = list.filter((d) => d.deviceId.includes(keyword) || (d.deviceModel ?? '').includes(keyword) || (d.appVersion ?? '').includes(keyword));
    }
    return ok(paginate(list, url));
  }),

  http.put('/api/app-releases/devices/:id/unbind', ({ params }) => {
    const device = mockClientDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    Object.assign(device, { subjectType: null, subjectId: null, subjectName: null, pushProvider: null, pushRegistrationId: null });
    return ok(null, '解绑成功');
  }),

  http.delete('/api/app-releases/devices/:id', ({ params }) => {
    const idx = mockClientDevices.findIndex((d) => d.id === Number(params.id));
    if (idx === -1) return notFound('设备不存在', { status: 404 });
    mockClientDevices.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
