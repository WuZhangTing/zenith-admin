import { http } from 'msw';
import { ok, badRequest, notFound, pageParams, nextIdFrom } from '@/mocks/utils/handlers';
import { OPEN_WEBHOOK_EVENTS, OPEN_WEBHOOK_EVENT_LABELS } from '@zenith/shared/open-platform';
import type { AppWebhookSubscription, AppWebhookDelivery } from '@zenith/shared/open-platform';
import { mockWebhookSubscriptions, mockWebhookDeliveries } from '@/mocks/data/app-webhooks';
import { mockDateTime } from '@/mocks/utils/date';

const subs: AppWebhookSubscription[] = mockWebhookSubscriptions.map((s) => ({ ...s }));
let deliveries: AppWebhookDelivery[] = mockWebhookDeliveries.map((d) => ({ ...d }));
let nextSubId = nextIdFrom(subs);
let nextDeliveryId = nextIdFrom(deliveries);
const BASE = '/api/app-webhooks';
const randomSecret = () => `whsec_${Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;

export const appWebhooksHandlers = [
  http.get(`${BASE}/events`, () => ok(OPEN_WEBHOOK_EVENTS.map((code) => ({ code, label: OPEN_WEBHOOK_EVENT_LABELS[code] ?? code })), 'success')),

  // 投递日志
  http.get(`${BASE}/deliveries`, ({ request }) => {
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const status = url.searchParams.get('status');
    const eventType = url.searchParams.get('eventType');
    const { page, pageSize } = pageParams(url);
    let filtered = [...deliveries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (subscriptionId) filtered = filtered.filter((d) => d.subscriptionId === Number(subscriptionId));
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (eventType) filtered = filtered.filter((d) => d.eventType === eventType);
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),
  http.get(`${BASE}/deliveries/:id`, ({ params }) => {
    const found = deliveries.find((d) => d.id === Number(params.id));
    return found ? ok(found, 'success') : notFound('投递记录不存在', { status: 404 });
  }),
  http.post(`${BASE}/deliveries/:id/retry`, ({ params }) => {
    const d = deliveries.find((x) => x.id === Number(params.id));
    if (!d) return notFound('投递记录不存在', { status: 404 });
    if (d.status !== 'failed') {
      return badRequest('仅最终失败的投递可手动重试', { status: 400 });
    }
    d.status = 'success';
    d.attempt += 1;
    d.responseStatus = 200;
    d.responseBody = '{"received":true}';
    d.errorMessage = null;
    d.nextRetryAt = null;
    d.finishedAt = mockDateTime();
    return ok({ deliveryId: d.id }, '已触发重试');
  }),
  http.post(`${BASE}/deliveries/batch-retry`, async ({ request }) => {
    const body = await request.json() as { ids?: number[] };
    const ids = new Set(body.ids ?? []);
    let scheduled = 0;
    for (const delivery of deliveries) {
      if (ids.has(delivery.id) && delivery.status === 'failed') {
        delivery.status = 'retrying';
        delivery.nextRetryAt = mockDateTime();
        scheduled += 1;
      }
    }
    return ok({ scheduled }, '已加入重试队列');
  }),

  // 订阅 CRUD
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const clientId = url.searchParams.get('clientId') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const { page, pageSize } = pageParams(url);
    let filtered = subs;
    if (keyword) filtered = filtered.filter((s) => s.name.includes(keyword) || s.url.includes(keyword));
    if (clientId) filtered = filtered.filter((s) => s.clientId === clientId);
    if (status) filtered = filtered.filter((s) => s.status === status);
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as Partial<AppWebhookSubscription>;
    const signMode = body.signMode ?? 'hmacSha256';
    const secret = signMode === 'hmacSha256' ? randomSecret() : '';
    const now = mockDateTime();
    const created: AppWebhookSubscription = {
      id: nextSubId++,
      clientId: body.clientId ?? '',
      name: body.name ?? '',
      url: body.url ?? '',
      signMode,
      events: body.events ?? [],
      headers: body.headers ?? null,
      status: body.status ?? 'enabled',
      hasSecret: signMode === 'hmacSha256',
      secretMasked: signMode === 'hmacSha256' ? '••••••••' : null,
      lastDeliveryAt: null,
      consecutiveFailures: 0,
      autoDisabledAt: null,
      createdAt: now,
      updatedAt: now,
    };
    subs.unshift(created);
    return ok({ ...created, secret }, '创建成功');
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const found = subs.find((s) => s.id === Number(params.id));
    return found ? ok(found, 'success') : notFound('Webhook 订阅不存在', { status: 404 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const idx = subs.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('Webhook 订阅不存在', { status: 404 });
    const body = (await request.json()) as Partial<AppWebhookSubscription>;
    subs[idx] = { ...subs[idx], ...body, clientId: subs[idx].clientId, updatedAt: mockDateTime() };
    return ok(subs[idx], '更新成功');
  }),

  http.post(`${BASE}/:id/regenerate-secret`, ({ params }) => {
    const found = subs.find((s) => s.id === Number(params.id));
    if (!found) return notFound('Webhook 订阅不存在', { status: 404 });
    found.signMode = 'hmacSha256';
    found.hasSecret = true;
    found.secretMasked = '••••••••';
    return ok({ id: found.id, secret: randomSecret() }, '新 secret 仅返回一次');
  }),

  http.post(`${BASE}/:id/test`, ({ params }) => {
    const sub = subs.find((s) => s.id === Number(params.id));
    if (!sub) return notFound('Webhook 订阅不存在', { status: 404 });
    const now = mockDateTime();
    const delivery: AppWebhookDelivery = {
      id: nextDeliveryId++, subscriptionId: sub.id, clientId: sub.clientId,
      eventType: 'app.test', eventId: `evt-test-${Date.now()}`, status: 'success', attempt: 1,
      requestUrl: sub.url, responseStatus: 200, responseBody: '{"received":true}', errorMessage: null,
      durationMs: 35, nextRetryAt: null, finishedAt: now, createdAt: now,
    };
    deliveries.unshift(delivery);
    sub.lastDeliveryAt = now;
    return ok({ deliveryId: delivery.id }, '已发送测试投递');
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const idx = subs.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('Webhook 订阅不存在', { status: 404 });
    subs.splice(idx, 1);
    deliveries = deliveries.filter((d) => d.subscriptionId !== Number(params.id));
    return ok(null, '删除成功');
  }),
];
