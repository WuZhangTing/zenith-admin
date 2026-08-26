/**
 * 运营群发 Mock(Demo 模式):活动 CRUD + 发送(联动任务中心模拟进度)。
 */
import { http } from 'msw';
import type { BroadcastCampaign, CreateBroadcastInput } from '@zenith/shared/messaging';
import { badRequest, notFound, ok, paginate } from '@/mocks/utils/handlers';
import { mockDateTime } from '@/mocks/utils/date';
import { createProgressingMockTask } from './async-tasks';
import { getNextBroadcastId, mockBroadcasts } from '../data/broadcasts';

export const broadcastHandlers = [
  http.get('/api/broadcasts', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockBroadcasts];
    if (keyword) list = list.filter((b) => b.title.includes(keyword) || b.content.includes(keyword));
    if (status) list = list.filter((b) => b.status === status);
    return ok(paginate(list, url));
  }),

  http.get('/api/broadcasts/:id', ({ params }) => {
    const row = mockBroadcasts.find((b) => b.id === Number(params.id));
    if (!row) return notFound('群发活动不存在', { status: 404 });
    return ok(row);
  }),

  http.post('/api/broadcasts', async ({ request }) => {
    const body = (await request.json()) as CreateBroadcastInput;
    const now = mockDateTime();
    const row: BroadcastCampaign = {
      id: getNextBroadcastId(),
      title: body.title,
      content: body.content,
      link: body.link ?? null,
      channels: body.channels,
      audienceType: body.audienceType,
      audienceIds: body.audienceIds ?? [],
      status: 'draft',
      totalRecipients: null,
      enqueuedCount: 0,
      taskId: null,
      sentAt: null,
      remark: body.remark ?? null,
      createdBy: 1,
      createdByName: '管理员',
      createdAt: now,
      updatedAt: now,
    };
    mockBroadcasts.unshift(row);
    return ok(row, '创建成功');
  }),

  http.put('/api/broadcasts/:id', async ({ params, request }) => {
    const row = mockBroadcasts.find((b) => b.id === Number(params.id));
    if (!row) return notFound('群发活动不存在', { status: 404 });
    if (!['draft', 'failed', 'cancelled'].includes(row.status)) {
      return badRequest('仅草稿/失败/已取消状态可编辑', { status: 400 });
    }
    const body = (await request.json()) as CreateBroadcastInput;
    Object.assign(row, body, {
      status: 'draft', taskId: null, totalRecipients: null, enqueuedCount: 0, sentAt: null,
      updatedAt: mockDateTime(),
    });
    return ok(row, '更新成功');
  }),

  http.delete('/api/broadcasts/:id', ({ params }) => {
    const idx = mockBroadcasts.findIndex((b) => b.id === Number(params.id));
    if (idx === -1) return notFound('群发活动不存在', { status: 404 });
    if (mockBroadcasts[idx].status === 'sending') {
      return badRequest('发送中的活动不可删除', { status: 400 });
    }
    mockBroadcasts.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  http.post('/api/broadcasts/:id/send', ({ params }) => {
    const row = mockBroadcasts.find((b) => b.id === Number(params.id));
    if (!row) return notFound('群发活动不存在', { status: 404 });
    if (row.status === 'sending') return badRequest('活动正在发送中', { status: 400 });
    if (row.status === 'sent') return badRequest('活动已发送,不可重复发送', { status: 400 });

    const total = row.audienceType === 'all_users' ? 128
      : row.audienceType === 'all_members' ? 356
        : row.audienceIds.length;
    const task = createProgressingMockTask({
      taskType: 'messaging-broadcast',
      title: `运营群发「${row.title}」`,
      payload: { campaignId: row.id },
      totalItems: Math.max(1, Math.ceil(total / 50)),
      itemDelayMs: 500,
    });
    row.status = 'sending';
    row.taskId = task.id;
    row.totalRecipients = total;
    row.enqueuedCount = 0;
    // Demo 简化:任务模拟推进期间列表仍显示 sending,预计完成后翻转为 sent
    const expectMs = Math.max(1, Math.ceil(total / 50)) * 500 + 1500;
    setTimeout(() => {
      if (row.status === 'sending') {
        row.status = 'sent';
        row.enqueuedCount = total;
        row.sentAt = mockDateTime();
      }
    }, expectMs);
    return ok(task, '任务已提交');
  }),
];
