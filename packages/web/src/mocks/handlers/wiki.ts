import { http } from 'msw';
import type { WikiComment, WikiDoc, WikiDocTreeNode, WikiSettings, WikiSpace, WikiSpaceMemberRole, WikiTag, WikiTemplate } from '@zenith/shared/wiki';
import { badRequest, notFound, ok, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockDateTime } from '@/mocks/utils/date';
import {
  getNextWikiCommentId, getNextWikiDocId, getNextWikiSpaceId, getNextWikiTagId,
  getNextWikiTemplateId, getNextWikiVersionId, mockWikiComments, mockWikiDocVersions,
  mockWikiDocs, mockWikiFavoriteDocIds, mockWikiReadConfirmedDocIds, mockWikiSettings,
  mockWikiSpaceMembers, mockWikiSpaces, mockWikiSubscribedDocIds, mockWikiTags,
  mockWikiTemplates, type MockWikiDoc,
} from '../data/wiki';

/** 审核时间线（内存） */
interface MockReviewRecord {
  id: number;
  docId: number;
  docTitle?: string;
  version: number;
  action: 'submit' | 'approve' | 'reject' | 'withdraw';
  actorId: number | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}
const mockReviewRecords: MockReviewRecord[] = [];
let nextReviewRecordId = 1;

function pushReviewRecord(doc: MockWikiDoc, action: MockReviewRecord['action'], reason: string | null = null) {
  mockReviewRecords.push({
    id: nextReviewRecordId++,
    docId: doc.id,
    version: doc.currentVersion,
    action,
    actorId: 1,
    actorName: '管理员',
    reason,
    createdAt: mockDateTime(),
  });
}

// ─── 派生工具 ─────────────────────────────────────────────────────────────────

function spaceName(spaceId: number): string {
  return mockWikiSpaces.find((s) => s.id === spaceId)?.name ?? '';
}

function docTags(doc: MockWikiDoc): WikiTag[] {
  return mockWikiTags.filter((t) => doc.tagIds.includes(t.id));
}

function toListDoc(doc: MockWikiDoc): WikiDoc {
  const { content: _content, ...rest } = doc;
  return {
    ...rest,
    spaceName: spaceName(doc.spaceId),
    tags: docTags(doc),
    tagIds: [...doc.tagIds],
  };
}

function toDetailDoc(doc: MockWikiDoc): WikiDoc {
  return {
    ...toListDoc(doc),
    content: doc.content,
    favorited: mockWikiFavoriteDocIds.has(doc.id),
    favoriteCount: mockWikiFavoriteDocIds.has(doc.id) ? 1 : 0,
    commentCount: mockWikiComments.filter((c) => c.docId === doc.id && c.status === 'visible').length,
    commentsEnabled: mockWikiSettings.commentsEnabled,
    subscribed: mockWikiSubscribedDocIds.has(doc.id),
    readConfirmed: mockWikiReadConfirmedDocIds.has(doc.id),
    readReceiptCount: mockWikiReadConfirmedDocIds.has(doc.id) ? 1 : 0,
    attachments: [],
  };
}

function findDoc(id: number): MockWikiDoc | undefined {
  return mockWikiDocs.find((d) => d.id === id);
}

function pushVersion(doc: MockWikiDoc, changeNote: string | null) {
  mockWikiDocVersions.push({
    id: getNextWikiVersionId(),
    docId: doc.id,
    version: doc.currentVersion,
    title: doc.title,
    content: doc.content,
    changeNote,
    authorId: 1,
    authorName: '管理员',
    createdAt: mockDateTime(),
  });
}

// ─── 空间 ─────────────────────────────────────────────────────────────────────

const spaceHandlers = [
  http.get('/api/wiki/spaces/my', () =>
    ok(mockWikiSpaces.filter((s) => s.status === 'enabled'))),

  http.get('/api/wiki/spaces', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const visibility = url.searchParams.get('visibility') || '';
    const status = url.searchParams.get('status') || '';

    let list = mockWikiSpaces.map((s) => ({
      ...s,
      memberCount: mockWikiSpaceMembers.filter((m) => m.spaceId === s.id).length,
      docCount: mockWikiDocs.filter((d) => d.spaceId === s.id && !d.deletedAt).length,
    }));
    if (keyword) list = list.filter((s) => s.name.includes(keyword) || (s.description ?? '').includes(keyword));
    if (visibility) list = list.filter((s) => s.visibility === visibility);
    if (status) list = list.filter((s) => s.status === status);
    return ok(paginate(list, url));
  }),

  http.get('/api/wiki/spaces/:id/members', ({ params }) =>
    ok(mockWikiSpaceMembers.filter((m) => m.spaceId === Number(params.id)))),

  http.put('/api/wiki/spaces/:id/members', async ({ params, request }) => {
    const spaceId = Number(params.id);
    if (!mockWikiSpaces.some((s) => s.id === spaceId)) return notFound('知识空间不存在', { status: 404 });
    const body = (await request.json()) as { members: Array<{ userId: number; role: WikiSpaceMemberRole }> };
    if (!body.members.some((m) => m.role === 'owner')) {
      return badRequest('空间至少需要一名负责人', { status: 400 });
    }
    removeWhere(mockWikiSpaceMembers, (m) => m.spaceId === spaceId);
    for (const m of body.members) {
      mockWikiSpaceMembers.push({
        spaceId, userId: m.userId, role: m.role, username: `user${m.userId}`, nickname: `用户 ${m.userId}`, createdAt: mockDateTime(),
      });
    }
    return ok(null, '保存成功');
  }),

  http.get('/api/wiki/spaces/:id', ({ params }) => {
    const space = mockWikiSpaces.find((s) => s.id === Number(params.id));
    if (!space) return notFound('知识空间不存在', { status: 404 });
    return ok(space);
  }),

  http.post('/api/wiki/spaces', async ({ request }) => {
    const body = (await request.json()) as Partial<WikiSpace>;
    const now = mockDateTime();
    const space: WikiSpace = {
      id: getNextWikiSpaceId(),
      name: body.name ?? '',
      description: body.description ?? null,
      icon: body.icon ?? null,
      visibility: body.visibility ?? 'public',
      status: body.status ?? 'enabled',
      sort: body.sort ?? 0,
      aiSyncEnabled: body.aiSyncEnabled ?? false,
      tenantId: null,
      myRole: 'owner',
      createdAt: now,
      updatedAt: now,
    };
    mockWikiSpaces.push(space);
    mockWikiSpaceMembers.push({ spaceId: space.id, userId: 1, role: 'owner', username: 'admin', nickname: '管理员', createdAt: now });
    return ok(space, '创建成功');
  }),

  http.put('/api/wiki/spaces/:id', async ({ params, request }) => {
    const idx = mockWikiSpaces.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('知识空间不存在', { status: 404 });
    const body = (await request.json()) as Partial<WikiSpace>;
    Object.assign(mockWikiSpaces[idx], { ...body, updatedAt: mockDateTime() });
    return ok(mockWikiSpaces[idx], '更新成功');
  }),

  http.delete('/api/wiki/spaces/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockWikiSpaces.findIndex((s) => s.id === id);
    if (idx === -1) return notFound('知识空间不存在', { status: 404 });
    if (mockWikiDocs.some((d) => d.spaceId === id)) {
      return badRequest('空间下仍有文档（含回收站），请先清空后再删除', { status: 400 });
    }
    mockWikiSpaces.splice(idx, 1);
    removeWhere(mockWikiSpaceMembers, (m) => m.spaceId === id);
    return ok(null, '删除成功');
  }),
];

// ─── 文档 ─────────────────────────────────────────────────────────────────────

const docHandlers = [
  http.get('/api/wiki/docs/search', ({ request }) => {
    const url = new URL(request.url);
    const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
    const spaceId = url.searchParams.get('spaceId');
    const tagId = url.searchParams.get('tagId');
    let list = mockWikiDocs.filter((d) => !d.deletedAt);
    if (keyword) {
      list = list.filter((d) => d.title.toLowerCase().includes(keyword)
        || (d.summary ?? '').toLowerCase().includes(keyword)
        || d.content.toLowerCase().includes(keyword));
    }
    if (spaceId) list = list.filter((d) => d.spaceId === Number(spaceId));
    if (tagId) list = list.filter((d) => d.tagIds.includes(Number(tagId)));
    const withSnippet = list.map((d) => ({
      ...toListDoc(d),
      snippet: d.content.replace(/[#>*`\-|[\]()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120),
    }));
    return ok(paginate(withSnippet, url));
  }),

  http.post('/api/wiki/docs/search/click', () => ok(null)),

  http.get('/api/wiki/docs/recent', () =>
    ok(mockWikiDocs.filter((d) => !d.deletedAt && d.status === 'published').slice(0, 5).map(toListDoc))),

  http.get('/api/wiki/docs/reviews/processed', ({ request }) => {
    const url = new URL(request.url);
    const list = mockReviewRecords
      .filter((r) => r.action === 'approve' || r.action === 'reject')
      .map((r) => ({ ...r, docTitle: mockWikiDocs.find((d) => d.id === r.docId)?.title ?? '' }))
      .sort((a, b) => b.id - a.id);
    return ok(paginate(list, url));
  }),

  http.get('/api/wiki/docs/tree', ({ request }) => {
    const url = new URL(request.url);
    const spaceId = Number(url.searchParams.get('spaceId'));
    const docs = mockWikiDocs
      .filter((d) => d.spaceId === spaceId && !d.deletedAt)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.sort - b.sort || a.id - b.id);
    const nodes = new Map<number, WikiDocTreeNode>();
    for (const d of docs) {
      nodes.set(d.id, { id: d.id, parentId: d.parentId ?? null, title: d.title, status: d.status, isPinned: d.isPinned, sort: d.sort, createdBy: d.createdBy ?? null, children: [] });
    }
    const roots: WikiDocTreeNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId !== null ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children!.push(node);
      else roots.push(node);
    }
    return ok(roots);
  }),

  http.get('/api/wiki/docs/favorites', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let list = mockWikiDocs.filter((d) => mockWikiFavoriteDocIds.has(d.id) && !d.deletedAt);
    if (keyword) list = list.filter((d) => d.title.includes(keyword));
    return ok(paginate(list.map(toListDoc), url));
  }),

  http.get('/api/wiki/docs/recycle', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let list = mockWikiDocs.filter((d) => d.deletedAt);
    if (keyword) list = list.filter((d) => d.title.includes(keyword));
    return ok(paginate(list.map(toListDoc), url));
  }),

  http.get('/api/wiki/docs', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const spaceId = url.searchParams.get('spaceId');
    const tagId = url.searchParams.get('tagId');
    const mine = url.searchParams.get('mine') === 'true';
    const submitted = url.searchParams.get('submitted') === 'true';

    let list = mockWikiDocs.filter((d) => !d.deletedAt);
    if (keyword) list = list.filter((d) => d.title.includes(keyword) || (d.summary ?? '').includes(keyword) || d.content.includes(keyword));
    if (status) list = list.filter((d) => d.status === status);
    if (spaceId) list = list.filter((d) => d.spaceId === Number(spaceId));
    if (tagId) list = list.filter((d) => d.tagIds.includes(Number(tagId)));
    if (mine) list = list.filter((d) => d.createdBy === 1);
    if (submitted) {
      const submittedIds = new Set(
        mockReviewRecords.filter((record) => record.action === 'submit' && record.actorId === 1).map((record) => record.docId),
      );
      list = list.filter((d) => submittedIds.has(d.id));
    }
    return ok(paginate(list.map(toListDoc), url));
  }),

  http.post('/api/wiki/docs', async ({ request }) => {
    const body = (await request.json()) as Partial<MockWikiDoc>;
    const now = mockDateTime();
    // 与服务端一致：新文档追加到目标层级末尾
    const nextSort = 1 + Math.max(-1, ...mockWikiDocs
      .filter((d) => d.spaceId === (body.spaceId ?? 1) && (d.parentId ?? null) === (body.parentId ?? null) && !d.deletedAt)
      .map((d) => d.sort));
    const doc: MockWikiDoc = {
      id: getNextWikiDocId(),
      spaceId: body.spaceId ?? 1,
      parentId: body.parentId ?? null,
      title: body.title ?? '',
      summary: body.summary ?? null,
      content: body.content ?? '',
      status: 'draft',
      rejectReason: null,
      sort: nextSort,
      isPinned: false,
      viewCount: 0,
      currentVersion: 1,
      revision: 1,
      requireReadReceipt: (body as { requireReadReceipt?: boolean }).requireReadReceipt ?? false,
      ownerId: 1,
      ownerName: '管理员',
      expireAt: null,
      reviewCycleDays: null,
      nextReviewAt: null,
      isArchived: false,
      publishedAt: null,
      deletedAt: null,
      tagIds: body.tagIds ?? [],
      authorName: '管理员',
      createdBy: 1,
      createdAt: now,
      updatedAt: now,
    };
    mockWikiDocs.push(doc);
    pushVersion(doc, '创建文档');
    return ok(toDetailDoc(doc), '创建成功');
  }),

  http.get('/api/wiki/docs/:id/versions/:version', ({ params }) => {
    const version = mockWikiDocVersions.find(
      (v) => v.docId === Number(params.id) && v.version === Number(params.version),
    );
    if (!version) return notFound('版本不存在', { status: 404 });
    return ok(version);
  }),

  http.get('/api/wiki/docs/:id/versions', ({ params, request }) => {
    const url = new URL(request.url);
    const list = mockWikiDocVersions
      .filter((v) => v.docId === Number(params.id))
      .sort((a, b) => b.version - a.version)
      .map(({ content: _content, ...rest }) => rest);
    return ok(paginate(list, url));
  }),

  http.post('/api/wiki/docs/:id/move', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    const body = (await request.json()) as { parentId: number | null; index?: number };
    // 与服务端一致：目标层级兄弟（不含自身）按展示序在 index 处插入后整层重排 sort
    const siblings = mockWikiDocs
      .filter((d) => d.spaceId === doc.spaceId && (d.parentId ?? null) === body.parentId && !d.deletedAt && !d.isArchived && d.id !== doc.id)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.sort - b.sort || a.id - b.id);
    const insertAt = body.index === undefined ? siblings.length : Math.min(body.index, siblings.length);
    siblings.splice(insertAt, 0, doc);
    doc.parentId = body.parentId;
    siblings.forEach((d, position) => { d.sort = position; });
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '移动成功');
  }),

  http.post('/api/wiki/docs/:id/submit', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'draft' && doc.status !== 'rejected') {
      return badRequest('只有草稿或已驳回的文档可以提交发布', { status: 400 });
    }
    doc.status = mockWikiSettings.requireApproval ? 'pending' : 'published';
    doc.rejectReason = null;
    pushReviewRecord(doc, 'submit');
    if (doc.status === 'published') {
      doc.publishedAt = mockDateTime();
      pushReviewRecord(doc, 'approve', '审批未开启，提交即发布');
    }
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '提交成功');
  }),

  http.post('/api/wiki/docs/:id/withdraw', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'pending') return badRequest('只有待审核的文档可以撤回', { status: 400 });
    doc.status = 'draft';
    pushReviewRecord(doc, 'withdraw');
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '已撤回');
  }),

  http.post('/api/wiki/docs/:id/subscribe', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    const body = (await request.json()) as { subscribe: boolean };
    if (body.subscribe) mockWikiSubscribedDocIds.add(doc.id);
    else mockWikiSubscribedDocIds.delete(doc.id);
    return ok(null, body.subscribe ? '已订阅' : '已取消订阅');
  }),

  http.post('/api/wiki/docs/:id/read-receipt', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    mockWikiReadConfirmedDocIds.add(doc.id);
    return ok(null, '已确认阅读');
  }),

  http.get('/api/wiki/docs/:id/read-receipts', ({ params }) => {
    const docId = Number(params.id);
    const confirmed = mockWikiReadConfirmedDocIds.has(docId)
      ? [{ userId: 1, nickname: '管理员', confirmedAt: mockDateTime() }]
      : [];
    return ok({
      confirmed,
      unconfirmed: confirmed.length > 0 ? [] : [{ userId: 1, nickname: '管理员' }],
    });
  }),

  http.get('/api/wiki/docs/:id/review-records', ({ params }) =>
    ok(mockReviewRecords.filter((r) => r.docId === Number(params.id)).sort((a, b) => b.id - a.id))),

  http.post('/api/wiki/docs/:id/review', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'pending') return badRequest('只有待审核的文档可以审核', { status: 400 });
    const body = (await request.json()) as { action: 'approve' | 'reject'; reason?: string };
    if (body.action === 'approve') {
      doc.status = 'published';
      doc.rejectReason = null;
      doc.publishedAt = mockDateTime();
      pushReviewRecord(doc, 'approve', body.reason ?? null);
    } else {
      doc.status = 'rejected';
      doc.rejectReason = body.reason ?? null;
      pushReviewRecord(doc, 'reject', body.reason ?? null);
    }
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '审核完成');
  }),

  http.post('/api/wiki/docs/:id/favorite', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    const body = (await request.json()) as { favorite: boolean };
    if (body.favorite) mockWikiFavoriteDocIds.add(doc.id);
    else mockWikiFavoriteDocIds.delete(doc.id);
    return ok(null, body.favorite ? '已收藏' : '已取消收藏');
  }),

  http.post('/api/wiki/docs/:id/view', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (doc && doc.status === 'published') doc.viewCount += 1;
    return ok(null);
  }),

  http.post('/api/wiki/docs/:id/rollback', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    const body = (await request.json()) as { version: number };
    const target = mockWikiDocVersions.find((v) => v.docId === doc.id && v.version === body.version);
    if (!target) return notFound('版本不存在', { status: 404 });
    doc.title = target.title;
    doc.content = target.content ?? '';
    doc.currentVersion += 1;
    doc.status = 'draft';
    doc.updatedAt = mockDateTime();
    pushVersion(doc, `回滚自 v${body.version}`);
    return ok(toDetailDoc(doc), '回滚成功');
  }),

  http.post('/api/wiki/docs/:id/restore', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc) return notFound('文档不存在', { status: 404 });
    if (!doc.deletedAt) return badRequest('文档不在回收站中', { status: 400 });
    doc.deletedAt = null;
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '还原成功');
  }),

  http.delete('/api/wiki/docs/:id/purge', ({ params }) => {
    const id = Number(params.id);
    const doc = findDoc(id);
    if (!doc) return notFound('文档不存在', { status: 404 });
    if (!doc.deletedAt) return badRequest('只能彻底删除回收站中的文档', { status: 400 });
    removeWhere(mockWikiDocs, (d) => d.id === id);
    removeWhere(mockWikiDocVersions, (v) => v.docId === id);
    removeWhere(mockWikiComments, (c) => c.docId === id);
    mockWikiFavoriteDocIds.delete(id);
    return ok(null, '已彻底删除');
  }),

  http.get('/api/wiki/docs/:id', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    return ok(toDetailDoc(doc));
  }),

  http.put('/api/wiki/docs/:id', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    const body = (await request.json()) as Partial<MockWikiDoc> & { changeNote?: string };
    const contentChanged = body.content !== undefined && body.content !== doc.content;
    const titleChanged = body.title !== undefined && body.title !== doc.title;

    if (body.title !== undefined) doc.title = body.title;
    if (body.summary !== undefined) doc.summary = body.summary;
    if (body.content !== undefined) doc.content = body.content;
    if (body.tagIds !== undefined) doc.tagIds = [...body.tagIds];
    if (body.sort !== undefined) doc.sort = body.sort;
    if (body.isPinned !== undefined) doc.isPinned = body.isPinned;
    if (contentChanged && doc.status === 'published') doc.status = 'draft';
    if (contentChanged || titleChanged) {
      doc.currentVersion += 1;
      pushVersion(doc, body.changeNote ?? null);
    }
    doc.revision += 1;
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '更新成功');
  }),

  http.delete('/api/wiki/docs/:id', ({ params }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (mockWikiDocs.some((d) => d.parentId === doc.id && !d.deletedAt)) {
      return badRequest('该文档下还有子文档，请先移动或删除子文档', { status: 400 });
    }
    doc.deletedAt = mockDateTime();
    return ok(null, '已移入回收站');
  }),
];

// ─── 模板与标签 ───────────────────────────────────────────────────────────────

const templateHandlers = [
  http.get('/api/wiki/templates/all', () =>
    ok(mockWikiTemplates.filter((t) => t.status === 'enabled'))),

  http.get('/api/wiki/templates', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockWikiTemplates];
    if (keyword) list = list.filter((t) => t.name.includes(keyword) || (t.description ?? '').includes(keyword));
    if (status) list = list.filter((t) => t.status === status);
    return ok(paginate(list, url));
  }),

  http.get('/api/wiki/templates/:id', ({ params }) => {
    const tpl = mockWikiTemplates.find((t) => t.id === Number(params.id));
    if (!tpl) return notFound('模板不存在', { status: 404 });
    return ok(tpl);
  }),

  http.post('/api/wiki/templates', async ({ request }) => {
    const body = (await request.json()) as Partial<WikiTemplate>;
    const now = mockDateTime();
    const tpl: WikiTemplate = {
      id: getNextWikiTemplateId(),
      name: body.name ?? '',
      description: body.description ?? null,
      content: body.content ?? '',
      status: body.status ?? 'enabled',
      sort: body.sort ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    mockWikiTemplates.push(tpl);
    return ok(tpl, '创建成功');
  }),

  http.put('/api/wiki/templates/:id', async ({ params, request }) => {
    const idx = mockWikiTemplates.findIndex((t) => t.id === Number(params.id));
    if (idx === -1) return notFound('模板不存在', { status: 404 });
    const body = (await request.json()) as Partial<WikiTemplate>;
    Object.assign(mockWikiTemplates[idx], { ...body, updatedAt: mockDateTime() });
    return ok(mockWikiTemplates[idx], '更新成功');
  }),

  http.delete('/api/wiki/templates/:id', ({ params }) => {
    const idx = mockWikiTemplates.findIndex((t) => t.id === Number(params.id));
    if (idx === -1) return notFound('模板不存在', { status: 404 });
    mockWikiTemplates.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];

const tagHandlers = [
  http.get('/api/wiki/tags/all', () => ok(mockWikiTags)),

  http.get('/api/wiki/tags', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    let list = mockWikiTags.map((t) => ({
      ...t,
      docCount: mockWikiDocs.filter((d) => !d.deletedAt && d.tagIds.includes(t.id)).length,
    }));
    if (keyword) list = list.filter((t) => t.name.includes(keyword));
    return ok(paginate(list, url));
  }),

  http.post('/api/wiki/tags', async ({ request }) => {
    const body = (await request.json()) as Partial<WikiTag>;
    if (mockWikiTags.some((t) => t.name === body.name)) {
      return badRequest('标签名称已存在', { status: 400 });
    }
    const now = mockDateTime();
    const tag: WikiTag = { id: getNextWikiTagId(), name: body.name ?? '', color: body.color ?? null, createdAt: now, updatedAt: now };
    mockWikiTags.push(tag);
    return ok(tag, '创建成功');
  }),

  http.put('/api/wiki/tags/:id', async ({ params, request }) => {
    const idx = mockWikiTags.findIndex((t) => t.id === Number(params.id));
    if (idx === -1) return notFound('标签不存在', { status: 404 });
    const body = (await request.json()) as Partial<WikiTag>;
    Object.assign(mockWikiTags[idx], { ...body, updatedAt: mockDateTime() });
    return ok(mockWikiTags[idx], '更新成功');
  }),

  http.delete('/api/wiki/tags/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockWikiTags.findIndex((t) => t.id === id);
    if (idx === -1) return notFound('标签不存在', { status: 404 });
    mockWikiTags.splice(idx, 1);
    for (const d of mockWikiDocs) d.tagIds = d.tagIds.filter((t) => t !== id);
    return ok(null, '删除成功');
  }),
];

// ─── 评论 ─────────────────────────────────────────────────────────────────────

const commentHandlers = [
  http.get('/api/wiki/comments/doc/:id', ({ params }) => {
    const docId = Number(params.id);
    const visible = mockWikiComments.filter((c) => c.docId === docId && c.status === 'visible');
    const byId = new Map(visible.map((c) => [c.id, { ...c, replies: [] as WikiComment[] }]));
    const roots: WikiComment[] = [];
    for (const c of byId.values()) {
      const parent = c.parentId !== null && c.parentId !== undefined ? byId.get(c.parentId) : undefined;
      if (parent) parent.replies!.push(c);
      else roots.push(c);
    }
    return ok(roots.sort((a, b) => b.id - a.id));
  }),

  http.delete('/api/wiki/comments/mine/:id', ({ params }) => {
    const removed = removeWhere(mockWikiComments, (c) => c.id === Number(params.id) || c.parentId === Number(params.id));
    if (removed === 0) return notFound('评论不存在', { status: 404 });
    return ok(null, '删除成功');
  }),

  http.get('/api/wiki/comments', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    const docId = url.searchParams.get('docId');

    let list = mockWikiComments.map((c) => ({
      ...c,
      docTitle: mockWikiDocs.find((d) => d.id === c.docId)?.title ?? '',
    }));
    if (keyword) list = list.filter((c) => c.content.includes(keyword));
    if (status) list = list.filter((c) => c.status === status);
    if (docId) list = list.filter((c) => c.docId === Number(docId));
    return ok(paginate(list.sort((a, b) => b.id - a.id), url));
  }),

  http.post('/api/wiki/comments', async ({ request }) => {
    const body = (await request.json()) as { docId: number; parentId?: number | null; content: string; mentionedUserIds?: number[]; isQuestion?: boolean };
    const doc = findDoc(body.docId);
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'published') return badRequest('只能评论已发布的文档', { status: 400 });
    const comment: WikiComment = {
      id: getNextWikiCommentId(),
      docId: body.docId,
      parentId: body.parentId ?? null,
      content: body.content,
      status: 'visible',
      mentionedUserIds: body.mentionedUserIds ?? [],
      isQuestion: body.isQuestion ?? false,
      resolvedAt: null,
      authorId: 1,
      authorName: '管理员',
      createdAt: mockDateTime(),
    };
    mockWikiComments.push(comment);
    return ok(comment, '评论成功');
  }),

  http.post('/api/wiki/comments/:id/resolve', ({ params }) => {
    const comment = mockWikiComments.find((c) => c.id === Number(params.id));
    if (!comment) return notFound('评论不存在', { status: 404 });
    if (!comment.isQuestion) return badRequest('只有标记为问题的评论可以解决', { status: 400 });
    comment.resolvedAt = mockDateTime();
    return ok(comment, '已标记解决');
  }),

  http.put('/api/wiki/comments/:id/status', async ({ params, request }) => {
    const comment = mockWikiComments.find((c) => c.id === Number(params.id));
    if (!comment) return notFound('评论不存在', { status: 404 });
    const body = (await request.json()) as { status: 'visible' | 'hidden' };
    comment.status = body.status;
    return ok(comment, '操作成功');
  }),

  http.delete('/api/wiki/comments/:id', ({ params }) => {
    const removed = removeWhere(mockWikiComments, (c) => c.id === Number(params.id) || c.parentId === Number(params.id));
    if (removed === 0) return notFound('评论不存在', { status: 404 });
    return ok(null, '删除成功');
  }),
];

// ─── 统计与设置 ───────────────────────────────────────────────────────────────

const statsHandlers = [
  http.get('/api/wiki/stats/overview', () => {
    const active = mockWikiDocs.filter((d) => !d.deletedAt);
    return ok({
      spaceCount: mockWikiSpaces.length,
      docCount: active.length,
      publishedCount: active.filter((d) => d.status === 'published').length,
      pendingCount: active.filter((d) => d.status === 'pending').length,
      commentCount: mockWikiComments.filter((c) => c.status === 'visible').length,
      weekNewDocs: active.length,
      weekViews: active.reduce((sum, d) => sum + d.viewCount, 0),
    });
  }),

  http.get('/api/wiki/stats/hot-docs', () =>
    ok(mockWikiDocs
      .filter((d) => !d.deletedAt && d.status === 'published')
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10)
      .map((d) => ({ id: d.id, title: d.title, spaceName: spaceName(d.spaceId), viewCount: d.viewCount })))),

  http.get('/api/wiki/stats/contributors', () =>
    ok([{ userId: 1, nickname: '管理员', docCount: mockWikiDocs.filter((d) => !d.deletedAt).length }])),

  http.get('/api/wiki/stats/stale-docs', () => ok([])),
];

const settingsHandlers = [
  http.get('/api/wiki/settings', () => ok({ ...mockWikiSettings })),

  http.put('/api/wiki/settings', async ({ request }) => {
    const body = (await request.json()) as WikiSettings;
    Object.assign(mockWikiSettings, body);
    return ok({ ...mockWikiSettings }, '保存成功');
  }),
];

// ─── 治理 ─────────────────────────────────────────────────────────────────────

const governanceHandlers = [
  http.get('/api/wiki/governance/docs', ({ request }) => {
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind') || 'expired';
    let list = mockWikiDocs.filter((d) => !d.deletedAt);
    if (kind === 'all') list = list.filter((d) => !d.isArchived);
    else if (kind === 'archived') list = list.filter((d) => d.isArchived);
    else if (kind === 'no-owner') list = list.filter((d) => !d.isArchived && d.ownerId == null);
    else if (kind === 'draft-backlog') list = list.filter((d) => !d.isArchived && d.status === 'draft');
    else if (kind === 'review-backlog') list = list.filter((d) => !d.isArchived && d.status === 'pending');
    else list = [];
    const rows = list.map((d) => ({
      id: d.id,
      spaceId: d.spaceId,
      spaceName: spaceName(d.spaceId),
      title: d.title,
      status: d.status,
      ownerId: d.ownerId ?? null,
      ownerName: d.ownerName ?? null,
      expireAt: d.expireAt ?? null,
      reviewCycleDays: d.reviewCycleDays ?? null,
      nextReviewAt: d.nextReviewAt ?? null,
      isArchived: d.isArchived,
      updatedAt: d.updatedAt,
    }));
    return ok(paginate(rows, url));
  }),

  http.get('/api/wiki/governance/no-result-keywords', () => ok([
    { keyword: '差旅报销标准', searchCount: 6, lastSearchedAt: mockDateTime() },
    { keyword: 'VPN 配置', searchCount: 3, lastSearchedAt: mockDateTime() },
  ])),

  http.post('/api/wiki/governance/remind', async ({ request }) => {
    const { ids = [] } = (await request.json()) as { ids?: number[] };
    return ok(null, `已提醒 ${ids.length} 位负责人`);
  }),

  http.post('/api/wiki/governance/archive', async ({ request }) => {
    const { ids = [], archived } = (await request.json()) as { ids?: number[]; archived: boolean };
    for (const doc of mockWikiDocs) {
      if (ids.includes(doc.id)) doc.isArchived = archived;
    }
    return ok(null, `${archived ? '已归档' : '已取消归档'} ${ids.length} 篇`);
  }),

  http.post('/api/wiki/governance/owner', async ({ request }) => {
    const { ids = [], ownerId } = (await request.json()) as { ids?: number[]; ownerId: number };
    for (const doc of mockWikiDocs) {
      if (ids.includes(doc.id)) {
        doc.ownerId = ownerId;
        doc.ownerName = `用户 ${ownerId}`;
      }
    }
    return ok(null, `已为 ${ids.length} 篇文档指定负责人`);
  }),

  http.post('/api/wiki/governance/review-cycle', async ({ request }) => {
    const { ids = [], reviewCycleDays, expireAt } = (await request.json()) as {
      ids?: number[];
      reviewCycleDays: number | null;
      expireAt?: string | null;
    };
    for (const doc of mockWikiDocs) {
      if (ids.includes(doc.id)) {
        doc.reviewCycleDays = reviewCycleDays;
        doc.nextReviewAt = reviewCycleDays === null ? null : mockDateTime();
        if (expireAt !== undefined) doc.expireAt = expireAt;
      }
    }
    return ok(null, `已为 ${ids.length} 篇文档设置复审`);
  }),

  http.post('/api/wiki/governance/import', async ({ request }) => {
    const body = (await request.json()) as { spaceId: number; parentId?: number | null; files: Array<{ name: string; content: string }> };
    const docIds: number[] = [];
    const created = mockDateTime();
    for (const file of body.files) {
      const headingMatch = /^#\s+(.+)$/m.exec(file.content);
      const doc: MockWikiDoc = {
        id: getNextWikiDocId(),
        spaceId: body.spaceId,
        parentId: body.parentId ?? null,
        title: (headingMatch?.[1] ?? file.name.replace(/\.(md|markdown|txt)$/i, '')).trim().slice(0, 200),
        summary: null,
        content: file.content,
        status: 'draft',
        rejectReason: null,
        sort: 0,
        isPinned: false,
        viewCount: 0,
        currentVersion: 1,
        revision: 1,
        requireReadReceipt: false,
        ownerId: 1,
        ownerName: '管理员',
        expireAt: null,
        reviewCycleDays: null,
        nextReviewAt: null,
        isArchived: false,
        publishedAt: null,
        deletedAt: null,
        tagIds: [],
        authorName: '管理员',
        createdBy: 1,
        createdAt: created,
        updatedAt: created,
      };
      mockWikiDocs.push(doc);
      docIds.push(doc.id);
    }
    return ok({ importedCount: docIds.length, docIds }, `已导入 ${docIds.length} 篇草稿`);
  }),
];

// ─── 运营统计 ─────────────────────────────────────────────────────────────────

const opsStatsHandlers = [
  http.get('/api/wiki/stats/ops', () => {
    const active = mockWikiDocs.filter((d) => !d.deletedAt);
    return ok({
      createdTrend: [{ date: mockDateTime().slice(0, 10), count: active.length }],
      spaceDistribution: mockWikiSpaces.map((s) => ({
        spaceName: s.name,
        count: active.filter((d) => d.spaceId === s.id).length,
      })),
      searchCount30d: 12,
      noResultCount30d: 2,
      approvedCount30d: mockReviewRecords.filter((r) => r.action === 'approve').length,
      rejectedCount30d: mockReviewRecords.filter((r) => r.action === 'reject').length,
      pendingBacklog: active.filter((d) => d.status === 'pending').length,
      expiredCount: 0,
      reviewDueCount: 0,
      noOwnerCount: active.filter((d) => d.ownerId == null).length,
      archivedCount: active.filter((d) => d.isArchived).length,
    });
  }),
];

export const wikiHandlers = [
  ...spaceHandlers,
  ...opsStatsHandlers,
  ...docHandlers,
  ...templateHandlers,
  ...tagHandlers,
  ...commentHandlers,
  ...statsHandlers,
  ...settingsHandlers,
  ...governanceHandlers,
];
