import { http } from 'msw';
import { ok, badRequest, notFound, conflict, paginate } from '@/mocks/utils/handlers';
import { CMS_WIDGET_HIGH_FANOUT_THRESHOLD, CMS_WIDGET_RENDERER_KEYS, CMS_WIDGET_RENDERER_LABELS } from '@zenith/shared/cms';
import type { CmsResolvedWidget, CmsResolvedWidgetItem, CmsWidget, CmsWidgetItem, CmsWidgetRendererKey, CmsWidgetSourceReference } from '@zenith/shared/cms';
import {
  getNextCmsWidgetId,
  getNextCmsWidgetRefId,
  mockCmsChannels,
  mockCmsContents,
  mockCmsSites,
  mockCmsWidgetRefs,
  mockCmsWidgets,
} from '../data/cms';
import { mockDateTime } from '../utils/date';
import { createProgressingMockTask } from './async-tasks';

type Body = Record<string, unknown>;

function refreshCounts() {
  for (const widget of mockCmsWidgets) {
    const refs = mockCmsWidgetRefs.filter((ref) => ref.widgetId === widget.id);
    widget.referenceCount = refs.length;
    widget.impactCount = new Set(refs.map((ref) => `${ref.ownerType}:${ref.ownerId}`)).size;
    widget.highFanout = widget.impactCount >= CMS_WIDGET_HIGH_FANOUT_THRESHOLD;
    widget.hasUnpublishedChanges = widget.draftRevision !== widget.publishedRevision;
  }
}

function resolveItems(widget: CmsWidget, draft = false): CmsResolvedWidgetItem[] {
  const data = draft ? widget.draftData : widget.publishedData;
  if (!data) return [];
  return data.items.flatMap((item): CmsResolvedWidgetItem[] => {
    const content = item.sourceType === 'content'
      ? mockCmsContents.find((entry) => entry.id === item.sourceId && entry.status === 'published')
      : null;
    const channel = item.sourceType === 'channel'
      ? mockCmsChannels.find((entry) => entry.id === item.sourceId && entry.status === 'enabled')
      : null;
    if (item.sourceType !== 'manual' && !content && !channel) return [];
    return [{
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? null,
      title: item.title || content?.title || channel?.name || '',
      summary: item.summary || content?.summary || channel?.seoDescription || null,
      url: item.url
        || (content ? `/${mockCmsChannels.find((entry) => entry.id === content.channelId)?.path ?? 'content'}/${content.slug ?? content.id}.html` : null)
        || (channel ? `/${channel.path}/` : null),
      image: item.image || content?.coverImage || channel?.image || null,
      displayDate: item.displayDate || content?.publishedAt || null,
    }];
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

function renderPreview(widget: CmsResolvedWidget): string {
  const entries = widget.items.map((item) => {
    const title = item.url
      ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>`
      : `<span>${escapeHtml(item.title)}</span>`;
    const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : '';
    const summary = item.summary ? `<p>${escapeHtml(item.summary)}</p>` : '';
    if (widget.rendererKey === 'list-grid') return `<article class="card">${image}<div>${title}${summary}</div></article>`;
    if (widget.rendererKey === 'list-carousel') return `<article class="slide">${image}<strong>${title}</strong></article>`;
    return `<div class="row">${title}${summary}</div>`;
  }).join('');
  const bodyClass = widget.rendererKey === 'list-grid' ? 'grid' : widget.rendererKey === 'list-carousel' ? 'carousel' : 'sidebar';
  return `<style>.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.card,.sidebar{border:1px solid #ddd;border-radius:10px;padding:14px}.card img,.slide img{width:100%;aspect-ratio:16/9;object-fit:cover}.carousel{display:flex;gap:12px;overflow:auto}.slide{min-width:260px}.row{padding:9px 0;border-bottom:1px solid #eee}a{color:#3451b2;text-decoration:none}p{color:#666;font-size:12px}</style><section class="${bodyClass}"><h2>${escapeHtml(widget.name)}</h2>${entries}</section>`;
}

function renderPreviewDocument(siteName: string, widgetHtml: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;color:#213547;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}header,footer{padding:20px 6%;background:#172554;color:#fff}main{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:28px;padding:36px 6%;min-height:520px}.hero{padding:48px;background:#f1f5f9;border-radius:14px}aside{min-width:0}@media(max-width:768px){main{grid-template-columns:1fr;padding:20px}.hero{padding:28px}}</style></head><body><header><strong>${escapeHtml(siteName)}</strong></header><main><section class="hero"><h1>站点首页</h1><p>这里展示当前主题首页的真实结构，页面部件位于主题的首页侧栏插槽。</p></section><aside>${widgetHtml}</aside></main><footer>${escapeHtml(siteName)} · Footer</footer></body></html>`;
}

function rendererOptions() {
  return CMS_WIDGET_RENDERER_KEYS.map((key) => ({ key, label: CMS_WIDGET_RENDERER_LABELS[key] }));
}

function cloneItems(value: unknown): { items: CmsWidgetItem[] } {
  const items = value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
    ? (value as { items: CmsWidgetItem[] }).items
    : [];
  return { items: items.map((item) => ({ ...item })) };
}

const refreshTasksByKey = new Map<string, ReturnType<typeof createProgressingMockTask>>();

function submitMockWidgetRefresh(siteId: number, eventKey?: string) {
  const bucket = Math.floor(Date.now() / 5_000);
  const key = eventKey ?? `site:${siteId}:${bucket}`;
  const existing = refreshTasksByKey.get(key);
  if (existing) return existing;
  const itemDelayMs = eventKey ? 300 : Math.max((bucket + 1) * 5_000 - Date.now(), 300);
  const task = createProgressingMockTask({
    taskType: 'cms-widget-refresh',
    title: 'CMS 页面部件引用刷新',
    payload: {
      totalItems: 1,
      siteId,
    },
    totalItems: 1,
    itemDelayMs,
  });
  refreshTasksByKey.set(key, task);
  return task;
}

export function submitMockCmsWidgetSourceRefresh(
  sourceType: 'content' | 'channel',
  sourceIds: number[],
) {
  const ids = new Set(sourceIds);
  const channelSiteIds = sourceType === 'channel'
    ? new Set(mockCmsChannels.filter((channel) => ids.has(channel.id)).map((channel) => channel.siteId))
    : null;
  const siteIds = new Set(mockCmsWidgets
    .filter((widget) => widget.status === 'published' && (
      (channelSiteIds?.has(widget.siteId) ?? false)
      || widget.publishedData?.items.some((item) => item.sourceType === 'content' && item.sourceId && ids.has(item.sourceId))
    ))
    .map((widget) => widget.siteId));
  for (const siteId of siteIds) submitMockWidgetRefresh(siteId);
}

export const cmsWidgetsHandlers = [
  http.get('/api/cms/widgets/options', ({ request }) => {
    const siteId = Number(new URL(request.url).searchParams.get('siteId'));
    refreshCounts();
    return ok(mockCmsWidgets.filter((widget) => widget.siteId === siteId && widget.status === 'published'));
  }),

  http.get('/api/cms/widgets/renderers', () => ok(rendererOptions())),

  http.get('/api/cms/widgets/slots', ({ request }) => {
    const siteId = Number(new URL(request.url).searchParams.get('siteId'));
    const binding = mockCmsWidgetRefs.find((ref) =>
      ref.siteId === siteId && ref.ownerType === 'theme_slot' && ref.field === 'home.sidebar') ?? null;
    return ok([{
      key: 'home.sidebar',
      label: '首页侧栏',
      allowedTypes: ['manual-list'],
      rendererKeys: [...CMS_WIDGET_RENDERER_KEYS],
      binding,
    }]);
  }),

  http.put('/api/cms/widgets/slots/:slotKey', async ({ params, request }) => {
    const body = (await request.json()) as Body;
    const siteId = Number(body.siteId);
    const slotKey = String(params.slotKey);
    const index = mockCmsWidgetRefs.findIndex((ref) =>
      ref.siteId === siteId && ref.ownerType === 'theme_slot' && ref.field === slotKey);
    if (index >= 0) mockCmsWidgetRefs.splice(index, 1);
    if (body.widgetId) {
      const widget = mockCmsWidgets.find((entry) => entry.id === Number(body.widgetId) && entry.siteId === siteId);
      if (!widget || widget.status !== 'published') return badRequest('主题插槽只能绑定已发布页面部件', { status: 400 });
      mockCmsWidgetRefs.push({
        id: getNextCmsWidgetRefId(),
        siteId,
        widgetId: widget.id,
        ownerType: 'theme_slot',
        ownerId: siteId,
        field: slotKey,
        rendererKey: String(body.rendererKey ?? 'list-sidebar') as CmsWidgetRendererKey,
        styleProps: {},
        ownerName: mockCmsSites.find((site) => site.id === siteId)?.name ?? null,
        createdAt: mockDateTime(),
        updatedAt: mockDateTime(),
      });
    }
    refreshCounts();
    submitMockWidgetRefresh(siteId);
    const binding = mockCmsWidgetRefs.find((ref) =>
      ref.siteId === siteId && ref.ownerType === 'theme_slot' && ref.field === slotKey) ?? null;
    return ok([{
      key: 'home.sidebar',
      label: '首页侧栏',
      allowedTypes: ['manual-list'],
      rendererKeys: [...CMS_WIDGET_RENDERER_KEYS],
      binding,
    }], '主题插槽已更新');
  }),

  http.post('/api/cms/widgets/batch', async ({ request }) => {
    const body = (await request.json()) as { ids?: number[]; action?: 'publish' | 'offline' | 'delete' };
    const ids = [...new Set(body.ids ?? [])];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    for (const id of ids) {
      const index = mockCmsWidgets.findIndex((widget) => widget.id === id);
      if (index < 0) {
        failed += 1;
        continue;
      }
      const widget = mockCmsWidgets[index];
      if (body.action === 'publish') {
        widget.publishedData = cloneItems(widget.draftData);
        widget.publishedName = widget.name;
        widget.publishedRevision = widget.draftRevision;
        widget.status = 'published';
        succeeded += 1;
      } else if (body.action === 'offline') {
        if (widget.status === 'published') {
          widget.status = 'offline';
          succeeded += 1;
        } else failed += 1;
      } else if (body.action === 'delete') {
        if (mockCmsWidgetRefs.some((ref) => ref.widgetId === id)) skipped += 1;
        else {
          mockCmsWidgets.splice(index, 1);
          succeeded += 1;
        }
      }
    }
    refreshCounts();
    const task = createProgressingMockTask({
      taskType: 'cms-widget-batch',
      title: '页面部件批量操作',
      payload: {
        totalItems: Math.max(1, ids.length),
        itemDelayMs: 250,
        action: body.action,
        outcome: { processed: ids.length, succeeded, failed, skipped },
      },
      totalItems: Math.max(1, ids.length),
    });
    return ok(task, '批量任务已提交');
  }),

  http.get('/api/cms/widgets/source-refs', ({ request }) => {
    const url = new URL(request.url);
    const sourceType = url.searchParams.get('sourceType') as 'content' | 'channel';
    const sourceId = Number(url.searchParams.get('sourceId'));
    refreshCounts();
    const refs: CmsWidgetSourceReference[] = mockCmsWidgets.flatMap((widget) => {
      if (widget.status !== 'published' || !widget.publishedData) return [];
      return widget.publishedData.items
        .filter((item) => (
          item.sourceType === sourceType && item.sourceId === sourceId
        ) || (
          sourceType === 'channel'
          && item.sourceType === 'content'
          && mockCmsContents.some((content) => content.id === item.sourceId && content.channelId === sourceId)
        ))
        .map((item) => ({
          widgetId: widget.id,
          widgetName: widget.name,
          widgetCode: widget.code,
          itemId: item.id,
          sourceType: item.sourceType as 'content' | 'channel',
          sourceId: item.sourceId!,
          referenceCount: widget.referenceCount,
          impactCount: widget.impactCount,
          highFanout: widget.highFanout,
        }));
    });
    return ok(refs);
  }),

  http.get('/api/cms/widgets/:id/refs', ({ params }) => {
    const id = Number(params.id);
    return ok(mockCmsWidgetRefs.filter((ref) => ref.widgetId === id));
  }),

  http.get('/api/cms/widgets/:id/preview', ({ params, request }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return notFound('页面部件不存在', { status: 404 });
    const rendererKey = (new URL(request.url).searchParams.get('rendererKey') || widget.defaultRendererKey) as CmsWidgetRendererKey;
    const resolved: CmsResolvedWidget = {
      id: widget.id,
      name: widget.name,
      type: widget.type,
      rendererKey,
      items: resolveItems(widget, true),
    };
    const html = renderPreview(resolved);
    const siteName = mockCmsSites.find((site) => site.id === widget.siteId)?.name ?? '演示站点';
    return ok({
      siteId: widget.siteId,
      widget: resolved,
      html,
      documentHtml: renderPreviewDocument(siteName, html),
      renderers: rendererOptions(),
    });
  }),

  http.post('/api/cms/widgets/:id/publish', ({ params }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return notFound('页面部件不存在', { status: 404 });
    widget.publishedData = cloneItems(widget.draftData);
    widget.publishedName = widget.name;
    widget.publishedRevision = widget.draftRevision;
    widget.status = 'published';
    widget.hasUnpublishedChanges = false;
    widget.updatedAt = mockDateTime();
    submitMockWidgetRefresh(widget.siteId, `publish:${widget.id}:${widget.draftRevision}:${Date.now()}`);
    return ok(widget, '发布成功');
  }),

  http.post('/api/cms/widgets/:id/offline', ({ params }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return notFound('页面部件不存在', { status: 404 });
    if (widget.status !== 'published') return badRequest(`当前状态（${widget.status}）不允许下线`, { status: 400 });
    widget.status = 'offline';
    widget.updatedAt = mockDateTime();
    submitMockWidgetRefresh(widget.siteId, `offline:${widget.id}:${widget.draftRevision}:${Date.now()}`);
    return ok(widget, '下线成功');
  }),

  http.get('/api/cms/widgets/:id', ({ params }) => {
    refreshCounts();
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    return widget ? ok(widget) : notFound('页面部件不存在', { status: 404 });
  }),

  http.get('/api/cms/widgets', ({ request }) => {
    const url = new URL(request.url);
    const siteId = Number(url.searchParams.get('siteId'));
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const type = url.searchParams.get('type') ?? '';
    refreshCounts();
    let list = mockCmsWidgets.filter((widget) => widget.siteId === siteId);
    if (keyword) list = list.filter((widget) => widget.name.includes(keyword) || widget.code.includes(keyword));
    if (status) list = list.filter((widget) => widget.status === status);
    if (type) list = list.filter((widget) => widget.type === type);
    return ok(paginate(list, url));
  }),

  http.post('/api/cms/widgets', async ({ request }) => {
    const body = (await request.json()) as Body;
    const now = mockDateTime();
    const row: CmsWidget = {
      id: getNextCmsWidgetId(),
      siteId: Number(body.siteId),
      name: String(body.name),
      code: String(body.code),
      type: 'manual-list',
      schemaVersion: 1,
      draftData: cloneItems(body.draftData),
      publishedData: null,
      publishedName: null,
      draftRevision: 1,
      publishedRevision: 0,
      status: 'draft',
      defaultRendererKey: String(body.defaultRendererKey ?? 'list-sidebar') as CmsWidgetRendererKey,
      remark: body.remark == null ? null : String(body.remark),
      referenceCount: 0,
      impactCount: 0,
      highFanout: false,
      hasUnpublishedChanges: true,
      createdAt: now,
      updatedAt: now,
    };
    mockCmsWidgets.push(row);
    return ok(row, '创建成功');
  }),

  http.put('/api/cms/widgets/:id', async ({ params, request }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return notFound('页面部件不存在', { status: 404 });
    const body = (await request.json()) as Body;
    if (body.code !== undefined) return badRequest('页面部件编码创建后不可修改', { status: 400 });
    if (Number(body.expectedRevision) !== widget.draftRevision) {
      return conflict('页面部件草稿已被其他人更新，请刷新后再编辑', { status: 409 });
    }
    const nextRemark = body.remark == null ? null : String(body.remark);
    const changed = body.draftData !== undefined
      || (body.name !== undefined && String(body.name) !== widget.name)
      || (body.defaultRendererKey !== undefined && String(body.defaultRendererKey) !== widget.defaultRendererKey)
      || (body.remark !== undefined && nextRemark !== widget.remark);
    if (body.name !== undefined) widget.name = String(body.name);
    if (body.draftData !== undefined) widget.draftData = cloneItems(body.draftData);
    if (body.defaultRendererKey !== undefined) widget.defaultRendererKey = String(body.defaultRendererKey) as CmsWidgetRendererKey;
    if (body.remark !== undefined) widget.remark = nextRemark;
    if (changed) widget.draftRevision += 1;
    widget.hasUnpublishedChanges = widget.draftRevision !== widget.publishedRevision;
    widget.updatedAt = mockDateTime();
    return ok(widget, '保存成功');
  }),

  http.delete('/api/cms/widgets/:id', ({ params }) => {
    const id = Number(params.id);
    const index = mockCmsWidgets.findIndex((widget) => widget.id === id);
    if (index < 0) return notFound('页面部件不存在', { status: 404 });
    const count = mockCmsWidgetRefs.filter((ref) => ref.widgetId === id).length;
    if (count > 0) return conflict(`该页面部件仍被 ${count} 个位置引用，请先解除引用`, { status: 409 });
    mockCmsWidgets.splice(index, 1);
    return ok(null, '删除成功');
  }),
];
