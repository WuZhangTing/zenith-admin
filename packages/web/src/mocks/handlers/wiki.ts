import { http } from 'msw';
import type { WikiComment, WikiDoc, WikiDocTreeNode, WikiSettings, WikiSpace, WikiSpaceMemberRole, WikiTag, WikiTemplate } from '@zenith/shared/wiki';
import { badRequest, notFound, ok, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockDateTime } from '@/mocks/utils/date';
import {
  getNextWikiCommentId, getNextWikiDocId, getNextWikiSpaceId, getNextWikiTagId,
  getNextWikiTemplateId, getNextWikiVersionId, mockWikiComments, mockWikiDocVersions,
  mockWikiDocs, mockWikiFavoriteDocIds, mockWikiSettings, mockWikiSpaceMembers,
  mockWikiSpaces, mockWikiTags, mockWikiTemplates, type MockWikiDoc,
} from '../data/wiki';

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
  http.get('/api/wiki/docs/tree', ({ request }) => {
    const url = new URL(request.url);
    const spaceId = Number(url.searchParams.get('spaceId'));
    const docs = mockWikiDocs
      .filter((d) => d.spaceId === spaceId && !d.deletedAt)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || a.sort - b.sort || a.id - b.id);
    const nodes = new Map<number, WikiDocTreeNode>();
    for (const d of docs) {
      nodes.set(d.id, { id: d.id, parentId: d.parentId ?? null, title: d.title, status: d.status, isPinned: d.isPinned, sort: d.sort, children: [] });
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

    let list = mockWikiDocs.filter((d) => !d.deletedAt);
    if (keyword) list = list.filter((d) => d.title.includes(keyword) || (d.summary ?? '').includes(keyword) || d.content.includes(keyword));
    if (status) list = list.filter((d) => d.status === status);
    if (spaceId) list = list.filter((d) => d.spaceId === Number(spaceId));
    if (tagId) list = list.filter((d) => d.tagIds.includes(Number(tagId)));
    return ok(paginate(list.map(toListDoc), url));
  }),

  http.post('/api/wiki/docs', async ({ request }) => {
    const body = (await request.json()) as Partial<MockWikiDoc>;
    const now = mockDateTime();
    const doc: MockWikiDoc = {
      id: getNextWikiDocId(),
      spaceId: body.spaceId ?? 1,
      parentId: body.parentId ?? null,
      title: body.title ?? '',
      summary: body.summary ?? null,
      content: body.content ?? '',
      status: 'draft',
      rejectReason: null,
      sort: 0,
      isPinned: false,
      viewCount: 0,
      currentVersion: 1,
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
    const body = (await request.json()) as { parentId: number | null; sort?: number };
    doc.parentId = body.parentId;
    if (body.sort !== undefined) doc.sort = body.sort;
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
    if (doc.status === 'published') doc.publishedAt = mockDateTime();
    doc.updatedAt = mockDateTime();
    return ok(toDetailDoc(doc), '提交成功');
  }),

  http.post('/api/wiki/docs/:id/review', async ({ params, request }) => {
    const doc = findDoc(Number(params.id));
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'pending') return badRequest('只有待审核的文档可以审核', { status: 400 });
    const body = (await request.json()) as { action: 'approve' | 'reject'; reason?: string };
    if (body.action === 'approve') {
      doc.status = 'published';
      doc.rejectReason = null;
      doc.publishedAt = mockDateTime();
    } else {
      doc.status = 'rejected';
      doc.rejectReason = body.reason ?? null;
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
    const body = (await request.json()) as { docId: number; parentId?: number | null; content: string };
    const doc = findDoc(body.docId);
    if (!doc || doc.deletedAt) return notFound('文档不存在', { status: 404 });
    if (doc.status !== 'published') return badRequest('只能评论已发布的文档', { status: 400 });
    const comment: WikiComment = {
      id: getNextWikiCommentId(),
      docId: body.docId,
      parentId: body.parentId ?? null,
      content: body.content,
      status: 'visible',
      authorId: 1,
      authorName: '管理员',
      createdAt: mockDateTime(),
    };
    mockWikiComments.push(comment);
    return ok(comment, '评论成功');
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

export const wikiHandlers = [
  ...spaceHandlers,
  ...docHandlers,
  ...templateHandlers,
  ...tagHandlers,
  ...commentHandlers,
  ...statsHandlers,
  ...settingsHandlers,
];
