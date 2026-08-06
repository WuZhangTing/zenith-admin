import { http } from 'msw';
import { ok, notFound, pageParams, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockInAppMessages, getNextInAppMessageId } from '@/mocks/data/in-app-messages';
import { mockInAppTemplates } from '@/mocks/data/in-app-templates';
import { mockUsers } from '@/mocks/data/users';
import { mockDateTime } from '@/mocks/utils/date';
import type { InAppMessage } from '@zenith/shared/messaging';

export const inAppMessagesHandlers = [
  http.get('/api/in-app-messages/admin', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const isRead = url.searchParams.get('isRead');
    const recipientId = url.searchParams.get('recipientId');
    const senderId = url.searchParams.get('senderId');
    const { page, pageSize } = pageParams(url, 20);
    const filtered = mockInAppMessages.filter((m) => {
      if (keyword && !m.title.includes(keyword) && !m.content.includes(keyword)) return false;
      if (type && m.type !== type) return false;
      if (isRead === 'true' && !m.isRead) return false;
      if (isRead === 'false' && m.isRead) return false;
      if (recipientId && m.userId !== Number(recipientId)) return false;
      if (senderId && m.senderId !== Number(senderId)) return false;
      return true;
    });
    const total = filtered.length;
    const list = filtered.slice((page - 1) * pageSize, page * pageSize)
      .map((m) => ({ ...m, username: m.userName ?? null }));
    return ok({ list, total, page, pageSize });
  }),

  http.post('/api/in-app-messages/admin/:id/read', ({ params }) => {
    const m = mockInAppMessages.find((x) => x.id === Number(params.id));
    if (!m) return notFound('站内信不存在', { status: 404 });
    if (!m.isRead) {
      m.isRead = true;
      m.readAt = mockDateTime();
    }
    return ok(null, '已标记已读');
  }),

  http.delete('/api/in-app-messages/admin/:id', ({ params }) => {
    const idx = mockInAppMessages.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('站内信不存在', { status: 404 });
    mockInAppMessages.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  http.get('/api/in-app-messages', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const isRead = url.searchParams.get('isRead');
    const filtered = mockInAppMessages.filter((m) => {
      if (keyword && !m.title.includes(keyword) && !m.content.includes(keyword)) return false;
      if (type && m.type !== type) return false;
      if (isRead === 'true' && !m.isRead) return false;
      if (isRead === 'false' && m.isRead) return false;
      return true;
    });
    return ok(paginate(filtered, url, 20));
  }),

  http.get('/api/in-app-messages/unread-count', () => {
    const count = mockInAppMessages.filter((m) => !m.isRead).length;
    return ok({ count });
  }),

  http.get('/api/in-app-messages/:id', ({ params }) => {
    const m = mockInAppMessages.find((x) => x.id === Number(params.id));
    if (!m) return notFound('站内信不存在', { status: 404 });
    return ok(m);
  }),

  http.post('/api/in-app-messages/:id/read', ({ params }) => {
    const m = mockInAppMessages.find((x) => x.id === Number(params.id));
    if (!m) return notFound('站内信不存在', { status: 404 });
    if (!m.isRead) {
      m.isRead = true;
      m.readAt = mockDateTime();
    }
    return ok(m, '已标记已读');
  }),

  http.post('/api/in-app-messages/read-all', () => {
    const now = mockDateTime();
    let count = 0;
    mockInAppMessages.forEach((m) => {
      if (!m.isRead) {
        m.isRead = true;
        m.readAt = now;
        count++;
      }
    });
    return ok({ count }, `已标记 ${count} 条为已读`);
  }),

  http.post('/api/in-app-messages/batch-read', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = new Set(body.ids ?? []);
    const now = mockDateTime();
    let count = 0;
    mockInAppMessages.forEach((m) => {
      if (ids.has(m.id) && !m.isRead) {
        m.isRead = true;
        m.readAt = now;
        count++;
      }
    });
    return ok(null, `已标记 ${count} 条为已读`);
  }),

  http.post('/api/in-app-messages/send', async ({ request }) => {
    const body = await request.json() as {
      userIds: number[];
      templateId?: number;
      title?: string;
      content?: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      variables?: Record<string, string>;
    };
    const tpl = body.templateId ? mockInAppTemplates.find((t) => t.id === body.templateId) : null;
    const now = mockDateTime();
    const created: InAppMessage[] = [];
    for (const uid of body.userIds ?? []) {
      const u = mockUsers.find((x) => x.id === uid);
      const msg: InAppMessage = {
        id: getNextInAppMessageId(),
        templateId: tpl?.id ?? null,
        userId: uid,
        userName: u?.nickname ?? u?.username ?? null,
        title: body.title ?? tpl?.title ?? '通知',
        content: body.content ?? tpl?.content ?? '',
        type: body.type ?? tpl?.type ?? 'info',
        isRead: false,
        readAt: null,
        source: 'manual',
        senderId: 1,
        senderName: '管理员',
        createdAt: now,
      };
      mockInAppMessages.unshift(msg);
      created.push(msg);
    }
    return ok({ count: created.length }, `已发送 ${created.length} 条站内信`);
  }),

  http.delete('/api/in-app-messages/batch', async ({ request }) => {
    const body = await request.json() as { ids: number[] };
    const ids = new Set(body.ids ?? []);
    const count = removeWhere(mockInAppMessages, (message) => ids.has(message.id));
    return ok(null, `已删除 ${count} 条记录`);
  }),

  http.delete('/api/in-app-messages/:id', ({ params }) => {
    const idx = mockInAppMessages.findIndex((x) => x.id === Number(params.id));
    if (idx === -1) return notFound('站内信不存在', { status: 404 });
    mockInAppMessages.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
