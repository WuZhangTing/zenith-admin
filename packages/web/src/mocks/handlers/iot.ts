import { http } from 'msw';
import { ok, badRequest, notFound, paginate, pageResult } from '@/mocks/utils/handlers';
import type { IotDevice, IotProduct, SendIotCommandInput } from '@zenith/shared/iot';
import {
  buildMockTelemetry, getNextIotCommandId, getNextIotDeviceId, getNextIotProductId,
  mockIotCommands, mockIotDevices, mockIotProducts,
} from '../data/iot';
import { mockDateTime } from '../utils/date';

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

export const iotHandlers = [
  // ─── 产品 ────────────────────────────────────────────────────────────────────
  http.get('/api/iot/products/all', () =>
    ok(mockIotProducts.filter((p) => p.status === 'enabled').map((p) => ({ ...p, deviceCount: mockIotDevices.filter((d) => d.productId === p.id).length })))),
  http.get('/api/iot/products', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = mockIotProducts.map((p) => ({ ...p, deviceCount: mockIotDevices.filter((d) => d.productId === p.id).length }));
    if (keyword) list = list.filter((p) => p.name.includes(keyword) || (p.description ?? '').includes(keyword));
    if (status) list = list.filter((p) => p.status === status);
    return ok(paginate([...list].sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/products', async ({ request }) => {
    const body = (await request.json()) as Partial<IotProduct>;
    if (!body.name) return badRequest('产品名称不能为空', { status: 400 });
    const now = mockDateTime();
    const product: IotProduct = {
      id: getNextIotProductId(),
      name: body.name,
      keyMetrics: body.keyMetrics ?? [],
      description: body.description ?? null,
      status: body.status ?? 'enabled',
      deviceCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockIotProducts.push(product);
    return ok(product, '创建成功');
  }),
  http.put('/api/iot/products/:id', async ({ params, request }) => {
    const product = mockIotProducts.find((p) => p.id === Number(params.id));
    if (!product) return notFound('产品不存在', { status: 404 });
    const body = (await request.json()) as Partial<IotProduct>;
    Object.assign(product, body, { updatedAt: mockDateTime() });
    return ok(product, '更新成功');
  }),
  http.delete('/api/iot/products/:id', ({ params }) => {
    const id = Number(params.id);
    const product = mockIotProducts.find((p) => p.id === id);
    if (!product) return notFound('产品不存在', { status: 404 });
    if (mockIotDevices.some((d) => d.productId === id)) return badRequest('产品下存在设备，无法删除', { status: 400 });
    mockIotProducts.splice(mockIotProducts.indexOf(product), 1);
    return ok(null, '删除成功');
  }),

  // ─── 设备（静态段 batch 先于 /:id）──────────────────────────────────────────
  http.delete('/api/iot/devices/batch', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    for (const id of ids) {
      const idx = mockIotDevices.findIndex((d) => d.id === id);
      if (idx >= 0) mockIotDevices.splice(idx, 1);
    }
    return ok(null, `已删除 ${ids.length} 台设备`);
  }),
  http.get('/api/iot/devices', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const productId = url.searchParams.get('productId');
    let list = [...mockIotDevices];
    if (keyword) list = list.filter((d) => d.sn.includes(keyword) || d.name.includes(keyword));
    if (status) list = list.filter((d) => d.status === status);
    if (productId) list = list.filter((d) => d.productId === Number(productId));
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),

  // ─── 设备子资源 ──────────────────────────────────────────────────────────────
  http.get('/api/iot/devices/:id/telemetry', ({ params, request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 1;
    return ok(buildMockTelemetry(Number(params.id), days));
  }),
  http.delete('/api/iot/devices/:id/telemetry', () => ok(null, '已清空 48 条遥测数据')),
  http.get('/api/iot/devices/:id/commands', ({ params, request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 10;
    const list = mockIotCommands.filter((c) => c.deviceId === Number(params.id));
    return ok(pageResult([...list].sort((a, b) => b.id - a.id), page, pageSize));
  }),
  http.post('/api/iot/devices/:id/commands', async ({ params, request }) => {
    const deviceId = Number(params.id);
    const device = mockIotDevices.find((d) => d.id === deviceId);
    if (!device) return notFound('设备不存在', { status: 404 });
    if (device.status !== 'enabled') return badRequest('设备已禁用，无法下发指令', { status: 400 });
    const body = (await request.json()) as SendIotCommandInput;
    const now = mockDateTime();
    const command = {
      id: getNextIotCommandId(),
      deviceId,
      service: body.service,
      params: body.params ?? null,
      status: device.online ? ('delivered' as const) : ('pending' as const),
      expireAt: now,
      sentAt: device.online ? now : null,
      ackedAt: null,
      response: null,
      errorMsg: null,
      createdAt: now,
    };
    mockIotCommands.push(command);
    return ok(command, device.online ? '指令已实时送达设备' : '设备离线，指令将在上线后送达');
  }),
  http.post('/api/iot/devices/:id/reset-secret', ({ params }) => {
    const device = mockIotDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    device.secret = randomHex(48);
    device.updatedAt = mockDateTime();
    return ok(device, '密钥已重置，请更新设备侧配置');
  }),

  // ─── 设备详情 / 创建 / 更新 / 删除 ──────────────────────────────────────────
  http.get('/api/iot/devices/:id', ({ params }) => {
    const device = mockIotDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    return ok(device);
  }),
  http.post('/api/iot/devices', async ({ request }) => {
    const body = (await request.json()) as Partial<IotDevice> & { sn?: string };
    const product = mockIotProducts.find((p) => p.id === body.productId);
    if (!product) return badRequest('所属产品不存在', { status: 400 });
    if (body.sn && mockIotDevices.some((d) => d.sn === body.sn)) return badRequest('SN 已存在', { status: 400 });
    const now = mockDateTime();
    const device: IotDevice = {
      id: getNextIotDeviceId(),
      sn: body.sn || `SN-${randomHex(16).toUpperCase()}`,
      secret: randomHex(48),
      productId: product.id,
      productName: product.name,
      keyMetrics: product.keyMetrics,
      name: body.name ?? '',
      status: body.status ?? 'enabled',
      online: false,
      firmwareVersion: body.firmwareVersion ?? null,
      activatedAt: null,
      lastSeenAt: null,
      latestMetrics: null,
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockIotDevices.push(device);
    return ok(device, '创建成功');
  }),
  http.put('/api/iot/devices/:id', async ({ params, request }) => {
    const device = mockIotDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    const body = (await request.json()) as Partial<IotDevice>;
    if (body.productId && body.productId !== device.productId) {
      const product = mockIotProducts.find((p) => p.id === body.productId);
      if (!product) return badRequest('所属产品不存在', { status: 400 });
      device.productName = product.name;
      device.keyMetrics = product.keyMetrics;
    }
    Object.assign(device, body, { updatedAt: mockDateTime() });
    return ok(device, '更新成功');
  }),
  http.delete('/api/iot/devices/:id', ({ params }) => {
    const idx = mockIotDevices.findIndex((d) => d.id === Number(params.id));
    if (idx === -1) return notFound('设备不存在', { status: 404 });
    mockIotDevices.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
