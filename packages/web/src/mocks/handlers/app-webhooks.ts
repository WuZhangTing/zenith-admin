import { http } from 'msw';
import { ok, badRequest, notFound, pageParams, nextIdFrom } from '@/mocks/utils/handlers';
import { OPEN_WEBHOOK_EVENTS, OPEN_WEBHOOK_EVENT_LABELS, PAYMENT_WEBHOOK_EVENTS } from '@zenith/shared/open-platform';
import type { AppWebhookSubscription, AppWebhookDelivery } from '@zenith/shared/open-platform';
import { mockWebhookSubscriptions, mockWebhookDeliveries } from '@/mocks/data/app-webhooks';
import { mockDateTime } from '@/mocks/utils/date';

const subs: AppWebhookSubscription[] = mockWebhookSubscriptions.map((s) => ({ ...s }));
let deliveries: AppWebhookDelivery[] = mockWebhookDeliveries.map((d) => ({ ...d }));
let nextSubId = nextIdFrom(subs);
let nextDeliveryId = nextIdFrom(deliveries);
const randomSecret = () => `whsec_${Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
const sensitiveEvents = new Set<string>(PAYMENT_WEBHOOK_EVENTS);

function isPaymentSubscription(subscription: AppWebhookSubscription): boolean {
  return subscription.events.length > 0 && subscription.events.every((event) => sensitiveEvents.has(event));
}

function policyError(input: {
  events?: string[];
  signMode?: AppWebhookSubscription['signMode'];
  headers?: Record<string, string> | null;
  hasSecret?: boolean;
}): string | null {
  const reservedHeader = Object.keys(input.headers ?? {}).find((key) => {
    const normalized = key.trim().toLowerCase();
    return normalized === 'content-type' || normalized.startsWith('x-zenith-');
  });
  if (reservedHeader) return `自定义请求头不能覆盖保留头：${reservedHeader}`;
  if ((input.events ?? []).some((event) => sensitiveEvents.has(event)) && input.signMode !== 'hmacSha256') {
    return '支付与退款事件必须使用 HMAC-SHA256 签名';
  }
  if (input.signMode === 'hmacSha256' && !input.hasSecret) return 'HMAC 签名密钥不可用，请先重置 Webhook 密钥';
  return null;
}

function createAppWebhookHandlers(BASE: string, paymentScope = false) {
  const scopedSub = (id: number) => subs.find((subscription) => subscription.id === id && (!paymentScope || isPaymentSubscription(subscription)));
  const scopedEvents = paymentScope ? PAYMENT_WEBHOOK_EVENTS : OPEN_WEBHOOK_EVENTS;

  return [
  http.get(`${BASE}/events`, () => ok(scopedEvents.map((code) => ({ code, label: OPEN_WEBHOOK_EVENT_LABELS[code] ?? code })), 'success')),

  // 投递日志
  http.get(`${BASE}/deliveries`, ({ request }) => {
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId');
    const status = url.searchParams.get('status');
    const eventType = url.searchParams.get('eventType');
    const { page, pageSize } = pageParams(url);
    const scopedIds = new Set(subs.filter((subscription) => !paymentScope || isPaymentSubscription(subscription)).map((subscription) => subscription.id));
    let filtered = deliveries.filter((delivery) => scopedIds.has(delivery.subscriptionId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (subscriptionId) filtered = filtered.filter((d) => d.subscriptionId === Number(subscriptionId));
    const clientId = url.searchParams.get('clientId');
    if (clientId) filtered = filtered.filter((d) => d.clientId === clientId);
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (eventType) filtered = filtered.filter((d) => d.eventType === eventType);
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),
  http.get(`${BASE}/deliveries/:id`, ({ params }) => {
    const found = deliveries.find((d) => d.id === Number(params.id) && scopedSub(d.subscriptionId));
    return found ? ok(found, 'success') : notFound('投递记录不存在', { status: 404 });
  }),
  http.post(`${BASE}/deliveries/:id/retry`, ({ params }) => {
    const d = deliveries.find((x) => x.id === Number(params.id) && scopedSub(x.subscriptionId));
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
      if (ids.has(delivery.id) && delivery.status === 'failed' && scopedSub(delivery.subscriptionId)) {
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
    let filtered = subs.filter((subscription) => !paymentScope || isPaymentSubscription(subscription));
    if (keyword) filtered = filtered.filter((s) => s.name.includes(keyword) || s.url.includes(keyword));
    if (clientId) filtered = filtered.filter((s) => s.clientId === clientId);
    if (status) filtered = filtered.filter((s) => s.status === status);
    const start = (page - 1) * pageSize;
    return ok({ list: filtered.slice(start, start + pageSize), total: filtered.length, page, pageSize }, 'success');
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as Partial<AppWebhookSubscription>;
    const signMode = body.signMode ?? 'hmacSha256';
    const invalidEvent = (body.events ?? []).find((event) => !(OPEN_WEBHOOK_EVENTS as readonly string[]).includes(event));
    if (invalidEvent) return badRequest(`不支持的 Webhook 事件：${invalidEvent}`, { status: 400 });
    if (paymentScope && ((body.events?.length ?? 0) === 0 || body.events?.some((event) => !sensitiveEvents.has(event)))) {
      return badRequest('支付中心 Webhook 必须显式选择支付或退款事件', { status: 400 });
    }
    const secret = signMode === 'hmacSha256' ? randomSecret() : '';
    const error = policyError({ events: body.events ?? [], signMode, headers: body.headers, hasSecret: Boolean(secret) });
    if (error) return badRequest(error, { status: 400 });
    const now = mockDateTime();
    const created: AppWebhookSubscription = {
      id: nextSubId++,
      clientId: body.clientId ?? '',
      tenantId: null,
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
    const found = scopedSub(Number(params.id));
    return found ? ok(found, 'success') : notFound('Webhook 订阅不存在', { status: 404 });
  }),

  http.put(`${BASE}/:id`, async ({ params, request }) => {
    const idx = subs.findIndex((s) => s.id === Number(params.id) && (!paymentScope || isPaymentSubscription(s)));
    if (idx === -1) return notFound('Webhook 订阅不存在', { status: 404 });
    const body = (await request.json()) as Partial<AppWebhookSubscription>;
    const signMode = body.signMode ?? subs[idx].signMode;
    const invalidEvent = (body.events ?? subs[idx].events).find((event) => !(OPEN_WEBHOOK_EVENTS as readonly string[]).includes(event));
    if (invalidEvent) return badRequest(`不支持的 Webhook 事件：${invalidEvent}`, { status: 400 });
    const nextEvents = body.events ?? subs[idx].events;
    if (paymentScope && (nextEvents.length === 0 || nextEvents.some((event) => !sensitiveEvents.has(event)))) {
      return badRequest('支付中心 Webhook 必须显式选择支付或退款事件', { status: 400 });
    }
    const hasSecret = signMode === 'hmacSha256' && subs[idx].hasSecret;
    const error = policyError({
      events: body.events ?? subs[idx].events,
      signMode,
      headers: body.headers ?? subs[idx].headers,
      hasSecret,
    });
    if (error) return badRequest(error, { status: 400 });
    subs[idx] = { ...subs[idx], ...body, clientId: subs[idx].clientId, updatedAt: mockDateTime() };
    if (body.signMode === 'none') {
      subs[idx].hasSecret = false;
      subs[idx].secretMasked = null;
    }
    return ok(subs[idx], '更新成功');
  }),

  http.post(`${BASE}/:id/regenerate-secret`, ({ params }) => {
    const found = scopedSub(Number(params.id));
    if (!found) return notFound('Webhook 订阅不存在', { status: 404 });
    found.signMode = 'hmacSha256';
    found.hasSecret = true;
    found.secretMasked = '••••••••';
    return ok({ id: found.id, secret: randomSecret() }, '新 secret 仅返回一次');
  }),

  http.post(`${BASE}/:id/test`, ({ params }) => {
    const sub = scopedSub(Number(params.id));
    if (!sub) return notFound('Webhook 订阅不存在', { status: 404 });
    const now = mockDateTime();
    const delivery: AppWebhookDelivery = {
      id: nextDeliveryId++, subscriptionId: sub.id, clientId: sub.clientId,
      tenantId: sub.tenantId,
      eventType: 'app.test', eventId: `evt-test-${Date.now()}`, status: 'success', attempt: 1,
      requestUrl: sub.url, responseStatus: 200, responseBody: '{"received":true}', errorMessage: null,
      durationMs: 35, nextRetryAt: null, finishedAt: now, createdAt: now,
    };
    deliveries.unshift(delivery);
    sub.lastDeliveryAt = now;
    return ok({ deliveryId: delivery.id }, '已发送测试投递');
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const idx = subs.findIndex((s) => s.id === Number(params.id) && (!paymentScope || isPaymentSubscription(s)));
    if (idx === -1) return notFound('Webhook 订阅不存在', { status: 404 });
    subs.splice(idx, 1);
    deliveries = deliveries.filter((d) => d.subscriptionId !== Number(params.id));
    return ok(null, '删除成功');
  }),
  ];
}

export const appWebhooksHandlers = [
  ...createAppWebhookHandlers('/api/app-webhooks'),
  ...createAppWebhookHandlers('/api/payment/webhooks', true),
];
