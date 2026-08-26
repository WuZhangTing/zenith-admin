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
    if (mockPushConfigs.some((c) => c.appId === body.appId)) {
      return badRequest('该应用已存在推送配置(一个应用只允许一套凭证)', { status: 400 });
    }
    const now = mockDateTime();
    const appNames: Record<number, string> = { 1: 'Zenith 桌面端', 2: 'Zenith 移动端' };
    const config: PushConfig = {
      id: getNextPushConfigId(),
      appId: body.appId ?? 0,
      appName: appNames[body.appId ?? 0] ?? `应用#${body.appId}`,
      name: body.name ?? '',
      provider: body.provider ?? 'jpush',
      appKey: body.appKey ?? '',
      apnsProduction: body.apnsProduction ?? false,
      status: body.status ?? 'enabled',
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockPushConfigs.push(config);
    return ok(config, '创建成功');
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
      appId: config.appId,
      appName: config.appName ?? null,
      provider: config.provider,
      subjectType: null, subjectId: null, subjectName: null,
      deviceCount: 1,
      title: body.title ?? 'Zenith 推送测试',
      content: body.content ?? '这是一条测试推送',
      link: null, eventKey: null,
      status: 'success', providerMsgId: `demo-${Date.now()}`,
      deliveryStatus: 'delivered', deliveredAt: now, clickedAt: null, errorMsg: null,
      source: 'test', sentAt: now, createdAt: now,
    });
    return ok({ msgId: `demo-${Date.now()}` }, '发送成功');
  }),

  http.put('/api/push-configs/:id', async ({ params, request }) => {
    const config = mockPushConfigs.find((c) => c.id === Number(params.id));
    if (!config) return notFound('推送配置不存在', { status: 404 });
    const body = (await request.json()) as Partial<PushConfig>;
    // masterSecret 留空表示不更新;脱敏字段不覆盖;所属应用创建后不可改
    delete body.masterSecret;
    delete body.appId;
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
  http.get('/api/push-send-logs/stats', ({ request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') || 14);
    const totals = {
      total: mockPushSendLogs.length,
      success: mockPushSendLogs.filter((l) => l.status === 'success').length,
      failed: mockPushSendLogs.filter((l) => l.status === 'failed').length,
      delivered: mockPushSendLogs.filter((l) => l.deliveredAt).length,
      clicked: mockPushSendLogs.filter((l) => l.clickedAt).length,
    };
    const trend = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // 演示数据:最后一天放真实计数,其余为 0
      const isLast = i === days - 1;
      return {
        date,
        total: isLast ? totals.total : 0,
        success: isLast ? totals.success : 0,
        failed: isLast ? totals.failed : 0,
        delivered: isLast ? totals.delivered : 0,
        clicked: isLast ? totals.clicked : 0,
      };
    });
    return ok({ totals, trend });
  }),

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
