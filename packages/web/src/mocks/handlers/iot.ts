import { http } from 'msw';
import { ok, badRequest, notFound, paginate, pageResult } from '@/mocks/utils/handlers';
import type {
  CreateIotAlarmRuleInput, CreateIotAutomationInput, CreateIotDeviceGroupInput, CreateIotEventInput, CreateIotPropertyInput,
  CreateIotServiceInput, ImportIotTslInput, IotBatchCommandInput, IotDevice, IotMetricValue,
  IotProduct, SendIotCommandInput, SetIotDesiredInput,
} from '@zenith/shared/iot';
import {
  buildMockTelemetry, buildMockTelemetryAgg, getNextIotAlarmRuleId, getNextIotAutomationId, getNextIotCommandId, getNextIotDeviceId,
  getNextIotFirmwareId, getNextIotGroupId, getNextIotModelItemId, getNextIotOtaTaskDeviceId,
  getNextIotOtaTaskId, getNextIotProductId,
  mockIotAlarmRules, mockIotAlarms, mockIotAutomationRuns, mockIotAutomations, mockIotCommands, mockIotDeviceEvents, mockIotDevices,
  mockIotEvents, mockIotFirmwares, mockIotGroups, mockIotOtaTaskDevices, mockIotOtaTasks,
  mockIotProducts, mockIotProperties, mockIotServices, mockIotShadows, withGroupInfo,
} from '../data/iot';
import { mockDateTime } from '../utils/date';

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

function productWithCounts(p: IotProduct): IotProduct {
  return {
    ...p,
    deviceCount: mockIotDevices.filter((d) => d.productId === p.id).length,
    propertyCount: mockIotProperties.filter((x) => x.productId === p.id).length,
    serviceCount: mockIotServices.filter((x) => x.productId === p.id).length,
    eventCount: mockIotEvents.filter((x) => x.productId === p.id).length,
  };
}

function getShadow(deviceId: number) {
  let shadow = mockIotShadows.get(deviceId);
  if (!shadow) {
    shadow = {
      deviceId, reported: {}, reportedAt: null, desired: {}, desiredVersion: 0,
      desiredAt: null, online: false, updatedAt: mockDateTime(),
    };
    mockIotShadows.set(deviceId, shadow);
  }
  return shadow;
}

export const iotHandlers = [
  // ─── 总览仪表盘 ──────────────────────────────────────────────────────────────
  http.get('/api/iot/dashboard', () => {
    const total = mockIotDevices.filter((d) => d.status === 'enabled').length;
    const online = mockIotDevices.filter((d) => d.online).length;
    const firing = mockIotAlarms.filter((a) => a.status === 'firing');
    const now = Date.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    const onlineTrend = Array.from({ length: 144 }, (_, i) => {
      const at = new Date(now - (143 - i) * 600_000);
      return {
        time: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}:00`,
        total,
        online: i > 100 ? online : Math.max(0, online - (i % 7 === 0 ? 1 : 0)),
      };
    });
    const alarmTrend = Array.from({ length: 7 }, (_, i) => {
      const at = new Date(now - (6 - i) * 86_400_000);
      return {
        date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
        warning: i === 6 ? 1 : (i % 3 === 0 ? 1 : 0),
        critical: i === 6 ? firing.filter((a) => a.level === 'critical').length : 0,
      };
    });
    return ok({
      stats: {
        deviceTotal: total,
        onlineCount: online,
        onlineRate: total > 0 ? Math.round((online / total) * 1000) / 10 : 0,
        telemetryToday: 2880,
        firingWarning: firing.filter((a) => a.level === 'warning').length,
        firingCritical: firing.filter((a) => a.level === 'critical').length,
        pendingDesiredDevices: [...mockIotShadows.values()].filter((s) => Object.keys(s.desired).length > 0).length,
        productTotal: mockIotProducts.length,
      },
      onlineTrend,
      alarmTrend,
      productDistribution: mockIotProducts.map((p) => ({
        name: p.name,
        value: mockIotDevices.filter((d) => d.productId === p.id).length,
      })),
      recentAlarms: [...mockIotAlarms].sort((a, b) => b.id - a.id).slice(0, 5),
      recentEvents: [...mockIotDeviceEvents].sort((a, b) => b.id - a.id).slice(0, 8).map((e) => ({
        ...e,
        deviceName: mockIotDevices.find((d) => d.id === e.deviceId)?.name ?? null,
      })),
    });
  }),

  // ─── 固件包 ──────────────────────────────────────────────────────────────────
  http.get('/api/iot/firmwares', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const productId = url.searchParams.get('productId');
    const status = url.searchParams.get('status') || '';
    let list = mockIotFirmwares.map((f) => ({
      ...f,
      taskCount: mockIotOtaTasks.filter((t) => t.firmwareId === f.id).length,
    }));
    if (keyword) list = list.filter((f) => f.version.includes(keyword) || f.fileName.includes(keyword));
    if (productId) list = list.filter((f) => f.productId === Number(productId));
    if (status) list = list.filter((f) => f.status === status);
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/firmwares', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    const productId = Number(formData.get('productId'));
    const version = String(formData.get('version') ?? '');
    const product = mockIotProducts.find((p) => p.id === productId);
    if (!product) return badRequest('所属产品不存在', { status: 400 });
    if (!(file instanceof File)) return badRequest('请选择要上传的固件文件', { status: 400 });
    if (mockIotFirmwares.some((f) => f.productId === productId && f.version === version)) {
      return badRequest(`产品下已存在版本 ${version}`, { status: 400 });
    }
    const now = mockDateTime();
    const firmware = {
      id: getNextIotFirmwareId(),
      productId,
      productName: product.name,
      version,
      fileId: `demo-firmware-file-${Date.now()}`,
      fileName: file.name,
      size: file.size,
      sha256: 'd'.repeat(64),
      releaseNotes: (formData.get('releaseNotes') as string) || null,
      status: 'enabled' as const,
      taskCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockIotFirmwares.push(firmware);
    return ok(firmware, '上传成功');
  }),
  http.put('/api/iot/firmwares/:id', async ({ params, request }) => {
    const firmware = mockIotFirmwares.find((f) => f.id === Number(params.id));
    if (!firmware) return notFound('固件不存在', { status: 404 });
    Object.assign(firmware, await request.json() as object, { updatedAt: mockDateTime() });
    return ok(firmware, '更新成功');
  }),
  http.delete('/api/iot/firmwares/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockIotFirmwares.findIndex((f) => f.id === id);
    if (idx === -1) return notFound('固件不存在', { status: 404 });
    if (mockIotOtaTasks.some((t) => t.firmwareId === id)) return badRequest('该固件存在升级任务，不可删除', { status: 400 });
    mockIotFirmwares.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── OTA 升级任务 ────────────────────────────────────────────────────────────
  http.get('/api/iot/ota-tasks', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockIotOtaTasks];
    if (keyword) list = list.filter((t) => t.title.includes(keyword) || t.firmwareVersion.includes(keyword));
    if (status) list = list.filter((t) => t.status === status);
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/ota-tasks', async ({ request }) => {
    const body = (await request.json()) as { firmwareId: number; deviceIds?: number[]; groupId?: number; allDevices?: boolean; timeoutMinutes?: number };
    const firmware = mockIotFirmwares.find((f) => f.id === body.firmwareId);
    if (!firmware) return notFound('固件不存在', { status: 404 });
    const ids = new Set<number>(body.deviceIds ?? []);
    if (body.groupId) {
      const group = mockIotGroups.find((g) => g.id === body.groupId);
      for (const id of group?.deviceIds ?? []) ids.add(id);
    }
    if (body.allDevices) {
      for (const d of mockIotDevices.filter((d) => d.productId === firmware.productId)) ids.add(d.id);
    }
    const eligible = mockIotDevices.filter((d) =>
      ids.has(d.id) && d.productId === firmware.productId && d.status === 'enabled' && d.firmwareVersion !== firmware.version);
    if (eligible.length === 0) return badRequest('没有可升级的目标设备（需属于该固件产品、启用且版本不同）', { status: 400 });
    const now = mockDateTime();
    const task = {
      id: getNextIotOtaTaskId(),
      title: `升级到 v${firmware.version}（${eligible.length} 台）`,
      firmwareId: firmware.id,
      productId: firmware.productId,
      productName: firmware.productName ?? null,
      firmwareVersion: firmware.version,
      status: 'running' as const,
      timeoutMinutes: body.timeoutMinutes ?? 30,
      totalCount: eligible.length,
      succeededCount: 0,
      failedCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockIotOtaTasks.push(task);
    for (const d of eligible) {
      mockIotOtaTaskDevices.push({
        id: getNextIotOtaTaskDeviceId(),
        taskId: task.id,
        deviceId: d.id,
        deviceName: d.name,
        deviceSn: d.sn,
        status: d.online ? 'notified' : 'pending',
        progress: 0,
        fromVersion: d.firmwareVersion,
        errorMsg: null,
        notifiedAt: d.online ? now : null,
        finishedAt: null,
      });
    }
    return ok(task, '升级任务已创建');
  }),
  http.get('/api/iot/ota-tasks/:id/devices', ({ params, request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 10;
    const status = url.searchParams.get('status') || '';
    let list = mockIotOtaTaskDevices.filter((d) => d.taskId === Number(params.id));
    // Demo 模式：进行中任务的设备进度随读取推进，最终收敛为成功
    for (const row of list) {
      if (row.status === 'notified' || row.status === 'downloading' || row.status === 'installing') {
        row.progress = Math.min(100, row.progress + 25);
        if (row.progress < 60) row.status = 'downloading';
        else if (row.progress < 100) row.status = 'installing';
        else {
          row.status = 'succeeded';
          row.finishedAt = mockDateTime();
          const task = mockIotOtaTasks.find((t) => t.id === row.taskId);
          if (task) {
            task.succeededCount += 1;
            const active = mockIotOtaTaskDevices.filter((d) =>
              d.taskId === task.id && ['pending', 'notified', 'downloading', 'installing'].includes(d.status));
            if (active.length === 0) task.status = 'completed';
          }
          const device = mockIotDevices.find((d) => d.id === row.deviceId);
          const task2 = mockIotOtaTasks.find((t) => t.id === row.taskId);
          if (device && task2) device.firmwareVersion = task2.firmwareVersion;
        }
      }
    }
    if (status) list = list.filter((d) => d.status === status);
    return ok(pageResult([...list].sort((a, b) => b.id - a.id), page, pageSize));
  }),
  http.post('/api/iot/ota-tasks/:id/cancel', ({ params }) => {
    const task = mockIotOtaTasks.find((t) => t.id === Number(params.id));
    if (!task) return notFound('升级任务不存在', { status: 404 });
    if (task.status !== 'running') return badRequest('任务已结束，无法取消', { status: 400 });
    task.status = 'cancelled';
    for (const d of mockIotOtaTaskDevices.filter((d) => d.taskId === task.id)) {
      if (['pending', 'notified', 'downloading', 'installing'].includes(d.status)) {
        d.status = 'cancelled';
        d.finishedAt = mockDateTime();
      }
    }
    return ok(task, '任务已取消');
  }),
  http.get('/api/iot/ota-tasks/:id', ({ params }) => {
    const task = mockIotOtaTasks.find((t) => t.id === Number(params.id));
    if (!task) return notFound('升级任务不存在', { status: 404 });
    return ok(task);
  }),


  // ─── 产品 ────────────────────────────────────────────────────────────────────
  http.get('/api/iot/products/all', () =>
    ok(mockIotProducts.filter((p) => p.status === 'enabled').map(productWithCounts))),
  http.get('/api/iot/products', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = mockIotProducts.map(productWithCounts);
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
      description: body.description ?? null,
      validationMode: body.validationMode ?? 'loose',
      status: body.status ?? 'enabled',
      deviceCount: 0,
      propertyCount: 0,
      serviceCount: 0,
      eventCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockIotProducts.push(product);
    return ok(product, '创建成功');
  }),

  // ─── 物模型 ──────────────────────────────────────────────────────────────────
  http.get('/api/iot/products/:id/model', ({ params }) => {
    const productId = Number(params.id);
    if (!mockIotProducts.some((p) => p.id === productId)) return notFound('产品不存在', { status: 404 });
    return ok({
      properties: mockIotProperties.filter((x) => x.productId === productId),
      services: mockIotServices.filter((x) => x.productId === productId),
      events: mockIotEvents.filter((x) => x.productId === productId),
    });
  }),
  http.post('/api/iot/products/:id/model/import', async ({ params, request }) => {
    const productId = Number(params.id);
    if (!mockIotProducts.some((p) => p.id === productId)) return notFound('产品不存在', { status: 404 });
    const body = (await request.json()) as ImportIotTslInput;
    const now = mockDateTime();
    for (const arr of [mockIotProperties, mockIotServices, mockIotEvents]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].productId === productId) arr.splice(i, 1);
      }
    }
    for (const p of body.properties ?? []) {
      mockIotProperties.push({
        id: getNextIotModelItemId(), productId, identifier: p.identifier, name: p.name,
        dataType: p.dataType, accessMode: p.accessMode ?? 'r', unit: p.unit ?? null,
        minValue: p.minValue ?? null, maxValue: p.maxValue ?? null, enumOptions: p.enumOptions ?? null,
        featured: p.featured ?? false, sort: p.sort ?? 0, description: p.description ?? null,
        createdAt: now, updatedAt: now,
      });
    }
    for (const s of body.services ?? []) {
      mockIotServices.push({
        id: getNextIotModelItemId(), productId, identifier: s.identifier, name: s.name,
        params: s.params ?? [], danger: s.danger ?? false, sort: s.sort ?? 0,
        description: s.description ?? null, createdAt: now, updatedAt: now,
      });
    }
    for (const e of body.events ?? []) {
      mockIotEvents.push({
        id: getNextIotModelItemId(), productId, identifier: e.identifier, name: e.name,
        level: e.level ?? 'info', params: e.params ?? [], sort: e.sort ?? 0,
        description: e.description ?? null, createdAt: now, updatedAt: now,
      });
    }
    return ok({
      properties: mockIotProperties.filter((x) => x.productId === productId),
      services: mockIotServices.filter((x) => x.productId === productId),
      events: mockIotEvents.filter((x) => x.productId === productId),
    }, '物模型已导入');
  }),
  http.post('/api/iot/products/:id/properties', async ({ params, request }) => {
    const productId = Number(params.id);
    const body = (await request.json()) as CreateIotPropertyInput;
    if (mockIotProperties.some((x) => x.productId === productId && x.identifier === body.identifier)) {
      return badRequest(`属性标识符 "${body.identifier}" 已存在`, { status: 400 });
    }
    const now = mockDateTime();
    const row = {
      id: getNextIotModelItemId(), productId, identifier: body.identifier, name: body.name,
      dataType: body.dataType, accessMode: body.accessMode ?? 'r', unit: body.unit ?? null,
      minValue: body.minValue ?? null, maxValue: body.maxValue ?? null, enumOptions: body.enumOptions ?? null,
      featured: body.featured ?? false, sort: body.sort ?? 0, description: body.description ?? null,
      createdAt: now, updatedAt: now,
    };
    mockIotProperties.push(row);
    return ok(row, '创建成功');
  }),
  http.put('/api/iot/products/:id/properties/:propertyId', async ({ params, request }) => {
    const row = mockIotProperties.find((x) => x.id === Number(params.propertyId) && x.productId === Number(params.id));
    if (!row) return notFound('属性不存在', { status: 404 });
    Object.assign(row, await request.json() as object, { updatedAt: mockDateTime() });
    return ok(row, '更新成功');
  }),
  http.delete('/api/iot/products/:id/properties/:propertyId', ({ params }) => {
    const idx = mockIotProperties.findIndex((x) => x.id === Number(params.propertyId) && x.productId === Number(params.id));
    if (idx === -1) return notFound('属性不存在', { status: 404 });
    mockIotProperties.splice(idx, 1);
    return ok(null, '删除成功');
  }),
  http.post('/api/iot/products/:id/services', async ({ params, request }) => {
    const productId = Number(params.id);
    const body = (await request.json()) as CreateIotServiceInput;
    if (mockIotServices.some((x) => x.productId === productId && x.identifier === body.identifier)) {
      return badRequest(`服务标识符 "${body.identifier}" 已存在`, { status: 400 });
    }
    const now = mockDateTime();
    const row = {
      id: getNextIotModelItemId(), productId, identifier: body.identifier, name: body.name,
      params: body.params ?? [], danger: body.danger ?? false, sort: body.sort ?? 0,
      description: body.description ?? null, createdAt: now, updatedAt: now,
    };
    mockIotServices.push(row);
    return ok(row, '创建成功');
  }),
  http.put('/api/iot/products/:id/services/:serviceId', async ({ params, request }) => {
    const row = mockIotServices.find((x) => x.id === Number(params.serviceId) && x.productId === Number(params.id));
    if (!row) return notFound('服务不存在', { status: 404 });
    Object.assign(row, await request.json() as object, { updatedAt: mockDateTime() });
    return ok(row, '更新成功');
  }),
  http.delete('/api/iot/products/:id/services/:serviceId', ({ params }) => {
    const idx = mockIotServices.findIndex((x) => x.id === Number(params.serviceId) && x.productId === Number(params.id));
    if (idx === -1) return notFound('服务不存在', { status: 404 });
    mockIotServices.splice(idx, 1);
    return ok(null, '删除成功');
  }),
  http.post('/api/iot/products/:id/events', async ({ params, request }) => {
    const productId = Number(params.id);
    const body = (await request.json()) as CreateIotEventInput;
    if (mockIotEvents.some((x) => x.productId === productId && x.identifier === body.identifier)) {
      return badRequest(`事件标识符 "${body.identifier}" 已存在`, { status: 400 });
    }
    const now = mockDateTime();
    const row = {
      id: getNextIotModelItemId(), productId, identifier: body.identifier, name: body.name,
      level: body.level ?? 'info', params: body.params ?? [], sort: body.sort ?? 0,
      description: body.description ?? null, createdAt: now, updatedAt: now,
    };
    mockIotEvents.push(row);
    return ok(row, '创建成功');
  }),
  http.put('/api/iot/products/:id/events/:eventId', async ({ params, request }) => {
    const row = mockIotEvents.find((x) => x.id === Number(params.eventId) && x.productId === Number(params.id));
    if (!row) return notFound('事件不存在', { status: 404 });
    Object.assign(row, await request.json() as object, { updatedAt: mockDateTime() });
    return ok(row, '更新成功');
  }),
  http.delete('/api/iot/products/:id/events/:eventId', ({ params }) => {
    const idx = mockIotEvents.findIndex((x) => x.id === Number(params.eventId) && x.productId === Number(params.id));
    if (idx === -1) return notFound('事件不存在', { status: 404 });
    mockIotEvents.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 产品详情 / 更新 / 删除（动态段在静态段之后）─────────────────────────────
  http.put('/api/iot/products/:id', async ({ params, request }) => {
    const product = mockIotProducts.find((p) => p.id === Number(params.id));
    if (!product) return notFound('产品不存在', { status: 404 });
    const body = (await request.json()) as Partial<IotProduct>;
    Object.assign(product, body, { updatedAt: mockDateTime() });
    return ok(productWithCounts(product), '更新成功');
  }),
  http.delete('/api/iot/products/:id', ({ params }) => {
    const id = Number(params.id);
    const product = mockIotProducts.find((p) => p.id === id);
    if (!product) return notFound('产品不存在', { status: 404 });
    if (mockIotDevices.some((d) => d.productId === id)) return badRequest('产品下存在设备，无法删除', { status: 400 });
    mockIotProducts.splice(mockIotProducts.indexOf(product), 1);
    return ok(null, '删除成功');
  }),

  // ─── 设备分组 ────────────────────────────────────────────────────────────────
  http.get('/api/iot/groups/all', () =>
    ok(mockIotGroups.map((g) => ({ ...g, deviceCount: (g.deviceIds ?? []).length })))),
  http.get('/api/iot/groups', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let list = mockIotGroups.map((g) => ({ ...g, deviceCount: (g.deviceIds ?? []).length }));
    if (keyword) list = list.filter((g) => g.name.includes(keyword) || (g.description ?? '').includes(keyword));
    return ok(paginate([...list].sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/groups', async ({ request }) => {
    const body = (await request.json()) as CreateIotDeviceGroupInput;
    if (!body.name) return badRequest('分组名称不能为空', { status: 400 });
    const now = mockDateTime();
    const group = {
      id: getNextIotGroupId(), name: body.name, description: body.description ?? null,
      deviceCount: (body.deviceIds ?? []).length, deviceIds: body.deviceIds ?? [],
      createdAt: now, updatedAt: now,
    };
    mockIotGroups.push(group);
    return ok(group, '创建成功');
  }),
  http.get('/api/iot/groups/:id', ({ params }) => {
    const group = mockIotGroups.find((g) => g.id === Number(params.id));
    if (!group) return notFound('设备分组不存在', { status: 404 });
    return ok({ ...group, deviceCount: (group.deviceIds ?? []).length });
  }),
  http.put('/api/iot/groups/:id', async ({ params, request }) => {
    const group = mockIotGroups.find((g) => g.id === Number(params.id));
    if (!group) return notFound('设备分组不存在', { status: 404 });
    Object.assign(group, await request.json() as object, { updatedAt: mockDateTime() });
    return ok({ ...group, deviceCount: (group.deviceIds ?? []).length }, '更新成功');
  }),
  http.delete('/api/iot/groups/:id', ({ params }) => {
    const idx = mockIotGroups.findIndex((g) => g.id === Number(params.id));
    if (idx === -1) return notFound('设备分组不存在', { status: 404 });
    mockIotGroups.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 批量操作（Demo：同步逐台模拟，提交后任务在 async-tasks mock 中推进）─────
  http.post('/api/iot/batch/commands', async ({ request }) => {
    const body = (await request.json()) as IotBatchCommandInput;
    const ids = new Set(body.deviceIds ?? []);
    if (body.groupId) {
      const group = mockIotGroups.find((g) => g.id === body.groupId);
      for (const id of group?.deviceIds ?? []) ids.add(id);
    }
    if (ids.size === 0) return badRequest('目标设备为空', { status: 400 });
    const now = mockDateTime();
    for (const deviceId of ids) {
      const device = mockIotDevices.find((d) => d.id === deviceId);
      if (!device || device.status !== 'enabled') continue;
      mockIotCommands.push({
        id: getNextIotCommandId(), deviceId, service: body.service, params: body.params ?? null,
        status: device.online ? 'delivered' : 'pending', expireAt: now,
        sentAt: device.online ? now : null, ackedAt: null, response: null, errorMsg: null, createdAt: now,
      });
    }
    return ok({
      id: Date.now(), taskType: 'iot-batch-command',
      title: `批量下发指令 ${body.service}（${ids.size} 台）`, status: 'completed',
    }, '批量任务已提交，可在任务中心查看进度');
  }),
  http.post('/api/iot/batch/desired', async ({ request }) => {
    const body = (await request.json()) as { deviceIds?: number[]; groupId?: number; desired: Record<string, IotMetricValue> };
    const ids = new Set(body.deviceIds ?? []);
    if (body.groupId) {
      const group = mockIotGroups.find((g) => g.id === body.groupId);
      for (const id of group?.deviceIds ?? []) ids.add(id);
    }
    if (ids.size === 0) return badRequest('目标设备为空', { status: 400 });
    for (const deviceId of ids) {
      const shadow = getShadow(deviceId);
      Object.assign(shadow.desired, body.desired);
      shadow.desiredVersion += 1;
      shadow.desiredAt = mockDateTime();
    }
    return ok({
      id: Date.now(), taskType: 'iot-batch-desired',
      title: `批量设置期望属性（${ids.size} 台）`, status: 'completed',
    }, '批量任务已提交，可在任务中心查看进度');
  }),

  // ─── 告警规则 ────────────────────────────────────────────────────────────────
  http.get('/api/iot/alarm-rules', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const ruleType = url.searchParams.get('ruleType') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockIotAlarmRules];
    if (keyword) list = list.filter((r) => r.name.includes(keyword));
    if (ruleType) list = list.filter((r) => r.ruleType === ruleType);
    if (status) list = list.filter((r) => r.status === status);
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/alarm-rules', async ({ request }) => {
    const body = (await request.json()) as CreateIotAlarmRuleInput;
    const product = mockIotProducts.find((p) => p.id === body.productId);
    if (!product) return badRequest('所属产品不存在', { status: 400 });
    const device = body.deviceId ? mockIotDevices.find((d) => d.id === body.deviceId) : null;
    const now = mockDateTime();
    const rule = {
      id: getNextIotAlarmRuleId(),
      name: body.name,
      productId: body.productId,
      productName: product.name,
      deviceId: body.deviceId ?? null,
      deviceName: device?.name ?? null,
      ruleType: body.ruleType,
      propertyIdentifier: body.propertyIdentifier ?? null,
      operator: body.operator ?? null,
      threshold: body.threshold ?? null,
      consecutiveCount: body.consecutiveCount ?? 1,
      offlineMinutes: body.offlineMinutes ?? null,
      eventIdentifier: body.eventIdentifier ?? null,
      level: body.level ?? 'warning',
      notifyUserIds: body.notifyUserIds ?? [],
      status: body.status ?? 'enabled',
      createdAt: now,
      updatedAt: now,
    };
    mockIotAlarmRules.push(rule);
    return ok(rule, '创建成功');
  }),
  http.put('/api/iot/alarm-rules/:id', async ({ params, request }) => {
    const rule = mockIotAlarmRules.find((r) => r.id === Number(params.id));
    if (!rule) return notFound('告警规则不存在', { status: 404 });
    const body = (await request.json()) as Partial<CreateIotAlarmRuleInput>;
    if (body.deviceId !== undefined) {
      rule.deviceName = body.deviceId ? (mockIotDevices.find((d) => d.id === body.deviceId)?.name ?? null) : null;
    }
    Object.assign(rule, body, { updatedAt: mockDateTime() });
    return ok(rule, '更新成功');
  }),
  http.delete('/api/iot/alarm-rules/:id', ({ params }) => {
    const idx = mockIotAlarmRules.findIndex((r) => r.id === Number(params.id));
    if (idx === -1) return notFound('告警规则不存在', { status: 404 });
    mockIotAlarmRules.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 告警记录 ────────────────────────────────────────────────────────────────
  http.get('/api/iot/alarms', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const level = url.searchParams.get('level') || '';
    const ruleType = url.searchParams.get('ruleType') || '';
    const deviceId = url.searchParams.get('deviceId');
    let list = [...mockIotAlarms];
    if (keyword) {
      list = list.filter((a) => a.ruleName.includes(keyword) || a.message.includes(keyword)
        || (a.deviceName ?? '').includes(keyword) || (a.deviceSn ?? '').includes(keyword));
    }
    if (status) list = list.filter((a) => a.status === status);
    if (level) list = list.filter((a) => a.level === level);
    if (ruleType) list = list.filter((a) => a.ruleType === ruleType);
    if (deviceId) list = list.filter((a) => a.deviceId === Number(deviceId));
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/alarms/:id/resolve', ({ params }) => {
    const alarm = mockIotAlarms.find((a) => a.id === Number(params.id));
    if (!alarm || alarm.status !== 'firing') return notFound('告警不存在或已恢复', { status: 404 });
    alarm.status = 'resolved';
    alarm.resolvedAt = mockDateTime();
    alarm.resolvedBy = 1;
    return ok(alarm, '告警已处理');
  }),

  // ─── 场景联动（/runs 静态段先于 /:id）───────────────────────────────────────
  http.get('/api/iot/automations/runs', ({ request }) => {
    const url = new URL(request.url);
    const automationId = url.searchParams.get('automationId');
    const success = url.searchParams.get('success');
    let list = [...mockIotAutomationRuns];
    if (automationId) list = list.filter((r) => r.automationId === Number(automationId));
    if (success) list = list.filter((r) => r.success === (success === 'true'));
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.get('/api/iot/automations', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const triggerType = url.searchParams.get('triggerType') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockIotAutomations];
    if (keyword) list = list.filter((a) => a.name.includes(keyword));
    if (triggerType) list = list.filter((a) => a.triggerType === triggerType);
    if (status) list = list.filter((a) => a.status === status);
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),
  http.post('/api/iot/automations', async ({ request }) => {
    const body = (await request.json()) as CreateIotAutomationInput;
    const product = mockIotProducts.find((p) => p.id === body.productId);
    if (!product) return badRequest('指定的产品不存在', { status: 400 });
    const device = body.deviceId ? mockIotDevices.find((d) => d.id === body.deviceId) : null;
    const automation = {
      id: getNextIotAutomationId(),
      name: body.name,
      productId: body.productId,
      productName: product.name,
      deviceId: body.deviceId ?? null,
      deviceName: device?.name ?? null,
      triggerType: body.triggerType,
      propertyIdentifier: body.triggerType === 'property' ? (body.propertyIdentifier ?? null) : null,
      operator: body.triggerType === 'property' ? (body.operator ?? null) : null,
      threshold: body.triggerType === 'property' ? (body.threshold ?? null) : null,
      eventIdentifier: body.triggerType === 'event' ? (body.eventIdentifier ?? null) : null,
      decisionRuleKey: body.decisionRuleKey ?? null,
      cooldownSeconds: body.cooldownSeconds ?? 60,
      actions: body.actions,
      status: body.status ?? 'enabled',
      recentRunCount: 0,
      createdAt: mockDateTime(),
      updatedAt: mockDateTime(),
    };
    mockIotAutomations.push(automation);
    return ok(automation, '创建成功');
  }),
  http.put('/api/iot/automations/:id', async ({ params, request }) => {
    const automation = mockIotAutomations.find((a) => a.id === Number(params.id));
    if (!automation) return notFound('联动规则不存在', { status: 404 });
    const body = (await request.json()) as Partial<CreateIotAutomationInput>;
    if (body.deviceId !== undefined) {
      const device = body.deviceId ? mockIotDevices.find((d) => d.id === body.deviceId) : null;
      automation.deviceId = body.deviceId ?? null;
      automation.deviceName = device?.name ?? null;
    }
    if (body.name !== undefined) automation.name = body.name;
    if (body.propertyIdentifier !== undefined) automation.propertyIdentifier = body.propertyIdentifier ?? null;
    if (body.operator !== undefined) automation.operator = body.operator ?? null;
    if (body.threshold !== undefined) automation.threshold = body.threshold ?? null;
    if (body.eventIdentifier !== undefined) automation.eventIdentifier = body.eventIdentifier ?? null;
    if (body.decisionRuleKey !== undefined) automation.decisionRuleKey = body.decisionRuleKey ?? null;
    if (body.cooldownSeconds !== undefined) automation.cooldownSeconds = body.cooldownSeconds;
    if (body.actions !== undefined) automation.actions = body.actions;
    if (body.status !== undefined) automation.status = body.status;
    automation.updatedAt = mockDateTime();
    return ok(automation, '更新成功');
  }),
  http.delete('/api/iot/automations/:id', ({ params }) => {
    const idx = mockIotAutomations.findIndex((a) => a.id === Number(params.id));
    if (idx < 0) return notFound('联动规则不存在', { status: 404 });
    mockIotAutomations.splice(idx, 1);
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
    const groupId = url.searchParams.get('groupId');
    let list = mockIotDevices.map(withGroupInfo);
    if (keyword) list = list.filter((d) => d.sn.includes(keyword) || d.name.includes(keyword));
    if (status) list = list.filter((d) => d.status === status);
    if (productId) list = list.filter((d) => d.productId === Number(productId));
    if (groupId) list = list.filter((d) => (d.groupIds ?? []).includes(Number(groupId)));
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),

  // ─── 设备子资源 ──────────────────────────────────────────────────────────────
  http.get('/api/iot/devices/import-template', () => badRequest('演示模式不支持下载模板', { status: 400 })),
  http.post('/api/iot/devices/import', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return badRequest('请上传文件', { status: 400 });
    return ok({ total: 2, success: 2, failed: 0, errors: [] }, '导入完成');
  }),
  http.get('/api/iot/devices/:id/telemetry/agg', ({ params, request }) => {
    const url = new URL(request.url);
    const property = url.searchParams.get('property') ?? '';
    const days = Number(url.searchParams.get('days')) || 7;
    return ok(buildMockTelemetryAgg(Number(params.id), property, days));
  }),
  http.get('/api/iot/devices/:id/telemetry', ({ params, request }) => {
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days')) || 1;
    return ok(buildMockTelemetry(Number(params.id), days));
  }),
  http.delete('/api/iot/devices/:id/telemetry', ({ params }) => {
    const shadow = getShadow(Number(params.id));
    shadow.reported = {};
    shadow.reportedAt = null;
    return ok(null, '已清空 48 条遥测数据');
  }),
  http.get('/api/iot/devices/:id/shadow', ({ params }) => {
    const deviceId = Number(params.id);
    if (!mockIotDevices.some((d) => d.id === deviceId)) return notFound('设备不存在', { status: 404 });
    return ok({ ...getShadow(deviceId), updatedAt: mockDateTime() });
  }),
  http.put('/api/iot/devices/:id/shadow/desired', async ({ params, request }) => {
    const deviceId = Number(params.id);
    const device = mockIotDevices.find((d) => d.id === deviceId);
    if (!device) return notFound('设备不存在', { status: 404 });
    const body = (await request.json()) as SetIotDesiredInput;
    const props = mockIotProperties.filter((p) => p.productId === device.productId);
    for (const key of Object.keys(body.desired)) {
      const prop = props.find((p) => p.identifier === key);
      if (!prop) return badRequest(`属性 ${key} 未在物模型中声明`, { status: 400 });
      if (prop.accessMode !== 'rw') return badRequest(`属性 ${key} 为只读，不可下发`, { status: 400 });
    }
    const shadow = getShadow(deviceId);
    Object.assign(shadow.desired, body.desired);
    shadow.desiredVersion += 1;
    shadow.desiredAt = mockDateTime();
    return ok({ ...shadow }, '期望属性已下发，设备确认后自动收敛');
  }),
  http.delete('/api/iot/devices/:id/shadow/desired', ({ params }) => {
    const shadow = getShadow(Number(params.id));
    shadow.desired = {};
    shadow.desiredVersion += 1;
    shadow.desiredAt = mockDateTime();
    return ok({ ...shadow }, '期望属性已清空');
  }),
  http.get('/api/iot/devices/:id/events', ({ params, request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 10;
    const kind = url.searchParams.get('kind') || '';
    const level = url.searchParams.get('level') || '';
    let list = mockIotDeviceEvents.filter((e) => e.deviceId === Number(params.id));
    if (kind) list = list.filter((e) => e.kind === kind);
    if (level) list = list.filter((e) => e.level === level);
    return ok(pageResult([...list].sort((a, b) => b.id - a.id), page, pageSize));
  }),
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
    if (!mockIotServices.some((s) => s.productId === device.productId && s.identifier === body.service)) {
      return badRequest(`服务 ${body.service} 未在物模型中声明`, { status: 400 });
    }
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
    return ok(withGroupInfo(device), '密钥已重置，请更新设备侧配置');
  }),

  // ─── 设备详情 / 创建 / 更新 / 删除 ──────────────────────────────────────────
  http.get('/api/iot/devices/:id', ({ params }) => {
    const device = mockIotDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    return ok(withGroupInfo(device));
  }),
  http.post('/api/iot/devices', async ({ request }) => {
    const body = (await request.json()) as Partial<IotDevice> & { sn?: string; groupIds?: number[] };
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
      name: body.name ?? '',
      status: body.status ?? 'enabled',
      online: false,
      firmwareVersion: body.firmwareVersion ?? null,
      activatedAt: null,
      lastSeenAt: null,
      reported: null,
      desired: {},
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockIotDevices.push(device);
    for (const groupId of body.groupIds ?? []) {
      const group = mockIotGroups.find((g) => g.id === groupId);
      if (group) group.deviceIds = [...(group.deviceIds ?? []), device.id];
    }
    // 记录激活前的注册事件流为空；创建影子占位
    getShadow(device.id);
    return ok(withGroupInfo(device), '创建成功');
  }),
  http.put('/api/iot/devices/:id', async ({ params, request }) => {
    const device = mockIotDevices.find((d) => d.id === Number(params.id));
    if (!device) return notFound('设备不存在', { status: 404 });
    const body = (await request.json()) as Partial<IotDevice> & { groupIds?: number[] };
    if (body.productId && body.productId !== device.productId) {
      const product = mockIotProducts.find((p) => p.id === body.productId);
      if (!product) return badRequest('所属产品不存在', { status: 400 });
      device.productName = product.name;
    }
    const { groupIds, ...rest } = body;
    Object.assign(device, rest, { updatedAt: mockDateTime() });
    if (groupIds !== undefined) {
      for (const group of mockIotGroups) {
        const set = new Set(group.deviceIds ?? []);
        if (groupIds.includes(group.id)) set.add(device.id);
        else set.delete(device.id);
        group.deviceIds = [...set];
      }
    }
    return ok(withGroupInfo(device), '更新成功');
  }),
  http.delete('/api/iot/devices/:id', ({ params }) => {
    const idx = mockIotDevices.findIndex((d) => d.id === Number(params.id));
    if (idx === -1) return notFound('设备不存在', { status: 404 });
    mockIotDevices.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];

