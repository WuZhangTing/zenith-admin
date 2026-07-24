import { http, HttpResponse } from 'msw';
import {
  CMS_PUBLISH_TARGET_TYPES,
  type AsyncTask,
  type CmsPublishTargetType,
} from '@zenith/shared';
import {
  mockCmsPublishArtifacts,
  mockCmsPublishingTasks,
} from '../data/cms-stage3';
import { mockCmsSites } from '../data/cms';
import { mockDateTime } from '../utils/date';
import { createProgressingMockTask } from './async-tasks';

const ok = <T>(data: T, message = 'success') => HttpResponse.json({ code: 0, message, data });
const fail = (message: string, status = 400) => HttpResponse.json({ code: status, message, data: null }, { status });

function page<T>(rows: T[], url: URL) {
  const current = Number(url.searchParams.get('page')) || 1;
  const pageSize = Number(url.searchParams.get('pageSize')) || 10;
  return { list: rows.slice((current - 1) * pageSize, current * pageSize), total: rows.length, page: current, pageSize };
}

function toPublishingTask(task: AsyncTask, targetType: CmsPublishTargetType, siteId: number) {
  const siteName = mockCmsSites.find((site) => site.id === siteId)?.name ?? null;
  return Object.assign(task, {
    siteId,
    siteName,
    siteIds: [siteId],
    siteNames: siteName ? [siteName] : [],
    targetType,
    artifactCount: mockCmsPublishArtifacts.filter((artifact) => artifact.taskId === task.id).length,
    failedArtifactCount: mockCmsPublishArtifacts.filter((artifact) => artifact.taskId === task.id && artifact.status === 'failed').length,
  });
}

export const cmsStage3Handlers = [
  http.get('/api/cms/publishing/artifacts', ({ request }) => {
    const url = new URL(request.url);
    let rows = [...mockCmsPublishArtifacts];
    const siteId = Number(url.searchParams.get('siteId')) || undefined;
    const targetType = url.searchParams.get('targetType');
    const status = url.searchParams.get('status');
    const keyword = url.searchParams.get('keyword') ?? '';
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    if (siteId) rows = rows.filter((item) => item.siteId === siteId);
    if (targetType) rows = rows.filter((item) => item.targetType === targetType);
    if (status) rows = rows.filter((item) => item.status === status);
    if (keyword) rows = rows.filter((item) => item.path.includes(keyword) || item.url?.includes(keyword));
    if (startTime) rows = rows.filter((item) => (item.generatedAt ?? item.updatedAt) >= startTime);
    if (endTime) rows = rows.filter((item) => (item.generatedAt ?? item.updatedAt) <= endTime);
    return ok(page(rows, url));
  }),

  http.post('/api/cms/publishing/submit', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (!CMS_PUBLISH_TARGET_TYPES.includes(body.targetType as never) || !Number(body.siteId)) return fail('发布目标参数无效');
    const targetType = body.targetType as CmsPublishTargetType;
    if (['content', 'contents'].includes(targetType) && !Array.isArray(body.contentIds)) return fail('内容发布必须选择内容');
    const task = createProgressingMockTask({
      taskType: 'cms-publish-build',
      title: `CMS ${targetType} 发布`,
      payload: body,
      totalItems: targetType === 'site' ? 12 : Math.max(1, (body.contentIds as unknown[] | undefined)?.length ?? 4),
      itemDelayMs: 250,
    });
    mockCmsPublishingTasks.unshift(toPublishingTask(task, targetType, Number(body.siteId)));
    return ok(task, '发布任务已提交');
  }),

  http.post('/api/cms/publishing/batch-action', async ({ request }) => {
    const body = await request.json() as { ids: number[]; action: string };
    let affected = 0;
    for (const id of body.ids ?? []) {
      const task = mockCmsPublishingTasks.find((item) => item.id === id);
      if (!task) continue;
      if (body.action === 'cancel' && ['pending', 'running'].includes(task.status)) task.status = 'cancelled';
      else if (body.action !== 'cancel' && ['success', 'failed', 'cancelled'].includes(task.status)) {
        task.status = 'pending';
        if (['restart', 'rebuild'].includes(body.action)) {
          mockCmsPublishArtifacts.splice(0, mockCmsPublishArtifacts.length, ...mockCmsPublishArtifacts.filter((item) => item.taskId !== id));
        }
      }
      else continue;
      affected++;
    }
    return ok({ affected, errors: [] });
  }),

  http.get('/api/cms/publishing/:id', ({ params }) => {
    const task = mockCmsPublishingTasks.find((item) => item.id === Number(params.id));
    if (!task) return fail('CMS 发布任务不存在', 404);
    const artifacts = mockCmsPublishArtifacts.filter((item) => item.taskId === task.id);
    return ok({
      task,
      items: artifacts.map((item, index) => ({
        id: index + 1,
        taskId: task.id,
        itemKey: item.path,
        label: item.path,
        status: item.status === 'failed' ? 'failed' : 'success',
        message: item.error,
        data: { path: item.path },
        attempt: task.attempts || 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      artifacts,
    });
  }),

  http.post('/api/cms/publishing/:id/:action', ({ params }) => {
    const task = mockCmsPublishingTasks.find((item) => item.id === Number(params.id));
    if (!task) return fail('CMS 发布任务不存在', 404);
    const action = String(params.action);
    if (action === 'cancel' && ['pending', 'running'].includes(task.status)) task.status = 'cancelled';
    else if (action === 'resume' && ['failed', 'cancelled'].includes(task.status)) task.status = 'pending';
    else if (['restart', 'rebuild'].includes(action) && ['success', 'failed', 'cancelled'].includes(task.status)) {
      task.status = 'pending';
      mockCmsPublishArtifacts.splice(0, mockCmsPublishArtifacts.length, ...mockCmsPublishArtifacts.filter((item) => item.taskId !== task.id));
    } else return fail('当前任务状态不支持该操作');
    task.updatedAt = mockDateTime();
    return ok(task);
  }),

  http.get('/api/cms/publishing', ({ request }) => {
    const url = new URL(request.url);
    let rows = [...mockCmsPublishingTasks];
    const siteId = Number(url.searchParams.get('siteId')) || undefined;
    const targetType = url.searchParams.get('targetType');
    const status = url.searchParams.get('status');
    const keyword = url.searchParams.get('keyword') ?? '';
    const taskType = url.searchParams.get('taskType');
    const createdBy = url.searchParams.get('createdBy')?.trim().toLowerCase();
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');
    if (siteId) rows = rows.filter((item) => item.siteIds.includes(siteId));
    if (targetType) rows = rows.filter((item) => item.targetType === targetType);
    if (taskType) rows = rows.filter((item) => item.taskType === taskType);
    if (createdBy) rows = rows.filter((item) => (item.createdByName ?? '').toLowerCase().includes(createdBy));
    if (status === 'active') rows = rows.filter((item) => ['pending', 'running'].includes(item.status));
    else if (status === 'terminal') rows = rows.filter((item) => ['success', 'failed', 'cancelled'].includes(item.status));
    else if (status) rows = rows.filter((item) => item.status === status);
    if (keyword) rows = rows.filter((item) => item.title.includes(keyword) || item.taskType.includes(keyword));
    if (startTime) rows = rows.filter((item) => item.createdAt >= startTime);
    if (endTime) rows = rows.filter((item) => item.createdAt <= endTime);
    rows.forEach((task) => {
      task.artifactCount = mockCmsPublishArtifacts.filter((item) => item.taskId === task.id).length;
      task.failedArtifactCount = mockCmsPublishArtifacts.filter((item) => item.taskId === task.id && item.status === 'failed').length;
    });
    return ok(page(rows, url));
  }),
];