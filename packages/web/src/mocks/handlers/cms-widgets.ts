import { http, HttpResponse } from 'msw';
import {
  CMS_WIDGET_RENDERER_KEYS,
  CMS_WIDGET_RENDERER_LABELS,
  type CmsResolvedWidget,
  type CmsResolvedWidgetItem,
  type CmsWidget,
  type CmsWidgetItem,
  type CmsWidgetRendererKey,
} from '@zenith/shared';
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

function ok<T>(data: T, message = 'ok') {
  return HttpResponse.json({ code: 0, message, data });
}

function fail(status: number, message: string) {
  return HttpResponse.json({ code: status, message, data: null }, { status });
}

function refreshCounts() {
  for (const widget of mockCmsWidgets) {
    widget.referenceCount = mockCmsWidgetRefs.filter((ref) => ref.widgetId === widget.id).length;
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

function rendererOptions() {
  return CMS_WIDGET_RENDERER_KEYS.map((key) => ({ key, label: CMS_WIDGET_RENDERER_LABELS[key] }));
}

function cloneItems(value: unknown): { items: CmsWidgetItem[] } {
  const items = value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
    ? (value as { items: CmsWidgetItem[] }).items
    : [];
  return { items: items.map((item) => ({ ...item })) };
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
      if (!widget || widget.status !== 'published') return fail(400, '主题插槽只能绑定已发布页面部件');
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
    for (const id of ids) {
      const index = mockCmsWidgets.findIndex((widget) => widget.id === id);
      if (index < 0) continue;
      const widget = mockCmsWidgets[index];
      if (body.action === 'publish') {
        widget.publishedData = cloneItems(widget.draftData);
        widget.publishedName = widget.name;
        widget.publishedRevision = widget.draftRevision;
        widget.status = 'published';
      } else if (body.action === 'offline') {
        if (widget.status === 'published') widget.status = 'offline';
      } else if (body.action === 'delete' && !mockCmsWidgetRefs.some((ref) => ref.widgetId === id)) {
        mockCmsWidgets.splice(index, 1);
      }
    }
    refreshCounts();
    const task = createProgressingMockTask({
      taskType: 'cms-widget-batch',
      title: '页面部件批量操作',
      payload: { totalItems: Math.max(1, ids.length), itemDelayMs: 250, action: body.action },
      totalItems: Math.max(1, ids.length),
    });
    return ok(task, '批量任务已提交');
  }),

  http.get('/api/cms/widgets/:id/refs', ({ params }) => {
    const id = Number(params.id);
    return ok(mockCmsWidgetRefs.filter((ref) => ref.widgetId === id));
  }),

  http.get('/api/cms/widgets/:id/preview', ({ params, request }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return fail(404, '页面部件不存在');
    const rendererKey = (new URL(request.url).searchParams.get('rendererKey') || widget.defaultRendererKey) as CmsWidgetRendererKey;
    const resolved: CmsResolvedWidget = {
      id: widget.id,
      name: widget.name,
      type: widget.type,
      rendererKey,
      items: resolveItems(widget, true),
    };
    return ok({ widget: resolved, html: renderPreview(resolved), renderers: rendererOptions() });
  }),

  http.post('/api/cms/widgets/:id/publish', ({ params }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return fail(404, '页面部件不存在');
    widget.publishedData = cloneItems(widget.draftData);
    widget.publishedName = widget.name;
    widget.publishedRevision = widget.draftRevision;
    widget.status = 'published';
    widget.hasUnpublishedChanges = false;
    widget.updatedAt = mockDateTime();
    return ok(widget, '发布成功');
  }),

  http.post('/api/cms/widgets/:id/offline', ({ params }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return fail(404, '页面部件不存在');
    if (widget.status !== 'published') return fail(400, `当前状态（${widget.status}）不允许下线`);
    widget.status = 'offline';
    widget.updatedAt = mockDateTime();
    return ok(widget, '下线成功');
  }),

  http.get('/api/cms/widgets/:id', ({ params }) => {
    refreshCounts();
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    return widget ? ok(widget) : fail(404, '页面部件不存在');
  }),

  http.get('/api/cms/widgets', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = Number(url.searchParams.get('pageSize')) || 10;
    const siteId = Number(url.searchParams.get('siteId'));
    const keyword = url.searchParams.get('keyword') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const type = url.searchParams.get('type') ?? '';
    refreshCounts();
    let list = mockCmsWidgets.filter((widget) => widget.siteId === siteId);
    if (keyword) list = list.filter((widget) => widget.name.includes(keyword) || widget.code.includes(keyword));
    if (status) list = list.filter((widget) => widget.status === status);
    if (type) list = list.filter((widget) => widget.type === type);
    return ok({
      list: list.slice((page - 1) * pageSize, page * pageSize),
      total: list.length,
      page,
      pageSize,
    });
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
      hasUnpublishedChanges: true,
      createdAt: now,
      updatedAt: now,
    };
    mockCmsWidgets.push(row);
    return ok(row, '创建成功');
  }),

  http.put('/api/cms/widgets/:id', async ({ params, request }) => {
    const widget = mockCmsWidgets.find((entry) => entry.id === Number(params.id));
    if (!widget) return fail(404, '页面部件不存在');
    const body = (await request.json()) as Body;
    const changed = body.name !== undefined || body.draftData !== undefined;
    if (body.name !== undefined) widget.name = String(body.name);
    if (body.draftData !== undefined) widget.draftData = cloneItems(body.draftData);
    if (body.defaultRendererKey !== undefined) widget.defaultRendererKey = String(body.defaultRendererKey) as CmsWidgetRendererKey;
    if (body.remark !== undefined) widget.remark = body.remark == null ? null : String(body.remark);
    if (changed) widget.draftRevision += 1;
    widget.hasUnpublishedChanges = widget.draftRevision !== widget.publishedRevision;
    widget.updatedAt = mockDateTime();
    return ok(widget, '保存成功');
  }),

  http.delete('/api/cms/widgets/:id', ({ params }) => {
    const id = Number(params.id);
    const index = mockCmsWidgets.findIndex((widget) => widget.id === id);
    if (index < 0) return fail(404, '页面部件不存在');
    const count = mockCmsWidgetRefs.filter((ref) => ref.widgetId === id).length;
    if (count > 0) return fail(409, `该页面部件仍被 ${count} 个位置引用，请先解除引用`);
    mockCmsWidgets.splice(index, 1);
    return ok(null, '删除成功');
  }),
];
