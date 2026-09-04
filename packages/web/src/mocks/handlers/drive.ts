import { http, HttpResponse } from 'msw';
import {
  DRIVE_SYNC_ZIP_MAX_FILES,
  type CreateDriveFolderInput,
  type CreateDriveShareLinkInput,
  type CreateDriveSpaceInput,
  type DriveNode,
  type DriveNodeDetail,
  type DriveNodeListResult,
  type DriveNodePermissionsResult,
  type DrivePublicNode,
  type DriveRole,
  type DriveShareLink,
  type DriveShareLinkState,
  type DriveSpace,
  type DriveSubjectType,
  type DriveTag,
  type SaveDriveNodePermissionsInput,
  type UpdateDriveShareLinkInput,
} from '@zenith/shared/drive';
import { badRequest, forbidden, notFound, ok, paginate, unauthorized } from '@/mocks/utils/handlers';
import { mockDateTime } from '@/mocks/utils/date';
import { removeWhere } from '@/mocks/utils/array';
import { createImmediateMockTask } from './async-tasks';
import {
  MOCK_USER,
  getNextDriveCommentId,
  getNextDriveNodeId,
  getNextDrivePermissionId,
  getNextDriveShareId,
  getNextDriveSpaceId,
  getNextDriveTagId,
  getNextDriveVersionId,
  logMockDriveActivity,
  mockDriveActivities,
  mockDriveComments,
  mockDriveMembers,
  mockDriveNodeTags,
  mockDriveNodes,
  mockDrivePermissions,
  mockDriveRecent,
  mockDriveSettings,
  mockDriveShareAccessLogs,
  mockDriveShareLinks,
  mockDriveSharePasswords,
  mockDriveShareSessions,
  mockDriveSpaces,
  mockDriveStars,
  mockDriveTags,
  mockDriveTexts,
  mockDriveVersions,
  recalcMockDriveUsage,
} from '../data/drive';

// ─── 工具 ─────────────────────────────────────────────────────────────────────

const SUBJECT_NAMES: Record<DriveSubjectType, Record<number, string>> = {
  user: { 1: '管理员', 2: '张三', 3: '李四' },
  department: { 1: '总部', 2: '研发部', 3: '市场部' },
  role: { 1: '超级管理员', 2: '普通用户' },
  user_group: { 1: '产品组', 2: '运维组' },
};

function subjectName(type: DriveSubjectType, id: number): string {
  return SUBJECT_NAMES[type]?.[id] ?? `${type}#${id}`;
}

function liveNodes(): DriveNode[] {
  return mockDriveNodes.filter((n) => !n.deletedAt);
}

function findNode(id: number | string): DriveNode | undefined {
  return mockDriveNodes.find((n) => n.id === Number(id));
}

function spaceName(spaceId: number): string {
  return mockDriveSpaces.find((s) => s.id === spaceId)?.name ?? '';
}

function decorate(node: DriveNode): DriveNode {
  const tagIds = mockDriveNodeTags.get(node.id) ?? [];
  return { ...node, isStarred: mockDriveStars.has(node.id), tags: mockDriveTags.filter((t) => tagIds.includes(t.id)) };
}

function breadcrumbsOf(node: DriveNode | null) {
  if (!node) return [];
  return [...node.ancestorIds, node.id].map((id) => findNode(id)).filter((n): n is DriveNode => !!n).map((n) => ({ id: n.id, name: n.name }));
}

function detailOf(node: DriveNode): DriveNodeDetail {
  const space = mockDriveSpaces.find((s) => s.id === node.spaceId);
  return {
    ...decorate(node),
    spaceName: space?.name ?? '', spaceType: space?.type ?? 'personal',
    breadcrumbs: breadcrumbsOf(node.parentId ? findNode(node.parentId) ?? null : null),
    versionCount: node.type === 'file' ? Math.max(1, mockDriveVersions.filter((v) => v.nodeId === node.id).length) : 0,
    shareLinkCount: mockDriveShareLinks.filter((l) => l.nodeId === node.id && l.state === 'active').length,
    childCount: node.type === 'folder' ? liveNodes().filter((n) => n.parentId === node.id).length : 0,
  };
}

function subtree(rootId: number): DriveNode[] {
  return mockDriveNodes.filter((n) => n.id === rootId || n.ancestorIds.includes(rootId));
}

function sortNodes(list: DriveNode[], sortBy: string, order: string): DriveNode[] {
  const dir = order === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    switch (sortBy) {
      case 'size': return (a.size - b.size) * dir;
      case 'updatedAt': return a.updatedAt.localeCompare(b.updatedAt) * dir;
      case 'createdAt': return a.createdAt.localeCompare(b.createdAt) * dir;
      default: return a.name.localeCompare(b.name, 'zh-CN') * dir;
    }
  });
}

function uniqueName(name: string, spaceId: number, parentId: number | null, excludeId?: number): string {
  const siblings = liveNodes().filter((n) => n.spaceId === spaceId && n.parentId === parentId && n.id !== excludeId).map((n) => n.name.toLowerCase());
  if (!siblings.includes(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = `${base}(${i})${ext}`;
    if (!siblings.includes(candidate.toLowerCase())) return candidate;
  }
}

function shareState(link: DriveShareLink): DriveShareLinkState {
  if (link.revokedAt) return 'revoked';
  if (!link.enabled) return 'disabled';
  if (link.expireAt && link.expireAt < mockDateTime()) return 'expired';
  if (link.maxAccessCount && link.accessCount >= link.maxAccessCount) return 'exhausted';
  return 'active';
}

function withState(link: DriveShareLink): DriveShareLink {
  const node = findNode(link.nodeId);
  return { ...link, state: shareState(link), nodeName: node?.name ?? link.nodeName };
}

function svgPlaceholder(label: string): string {
  const hue = Array.from(label).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="hsl(${hue} 60% 55%)"/><circle cx="320" cy="180" r="110" fill="hsl(${(hue + 40) % 360} 80% 70%)"/><text x="320" y="360" font-size="28" text-anchor="middle" fill="#fff" font-family="sans-serif">${label}</text></svg>`;
}

function contentResponse(node: DriveNode, download: boolean): Response {
  const isImage = node.mimeType?.startsWith('image/');
  const body = isImage ? svgPlaceholder(node.name) : (mockDriveTexts.get(node.id) ?? `这是演示模式下「${node.name}」的占位内容。`);
  const type = isImage ? 'image/svg+xml' : (node.mimeType?.startsWith('text/') ? `${node.mimeType}; charset=utf-8` : 'text/plain; charset=utf-8');
  const headers: Record<string, string> = { 'Content-Type': type };
  if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(node.name)}`;
  return new HttpResponse(body, { status: 200, headers });
}

function toPublicNode(node: DriveNode, token: string): DrivePublicNode {
  return {
    id: node.id, parentId: node.parentId, type: node.type, name: node.name, extension: node.extension, mimeType: node.mimeType, size: node.size,
    url: node.type === 'file' ? `/api/drive/public/shares/${token}/nodes/${node.id}/content` : null, updatedAt: node.updatedAt,
  };
}

function permissionsResult(node: DriveNode): DriveNodePermissionsResult {
  const direct = mockDrivePermissions.filter((p) => p.nodeId === node.id).map((p) => ({ ...p, inheritedFrom: null }));
  const inherited = node.inheritPermissions
    ? node.ancestorIds.flatMap((aid) => {
      const anc = findNode(aid);
      return mockDrivePermissions.filter((p) => p.nodeId === aid).map((p) => ({ ...p, inheritedFrom: anc ? { id: anc.id, name: anc.name } : null }));
    })
    : [];
  return { nodeId: node.id, inheritPermissions: node.inheritPermissions, spaceRole: 'manager', effectiveRole: 'manager', direct, inherited };
}

function softDelete(ids: number[]) {
  const now = mockDateTime();
  for (const id of ids) {
    for (const n of subtree(id)) {
      if (n.deletedAt) continue;
      n.deletedAt = now; n.deletedBy = MOCK_USER.id; n.deletedByName = MOCK_USER.name;
      (n as DriveNode & { deletedRootId?: number }).deletedRootId = id;
    }
    const root = findNode(id);
    if (root) logMockDriveActivity({ spaceId: root.spaceId, nodeId: root.id, nodeName: root.name, nodeType: root.type, action: 'delete', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
  }
}

function pageQuery(url: URL) {
  return {
    keyword: url.searchParams.get('keyword')?.trim() ?? '',
    spaceId: url.searchParams.get('spaceId') ? Number(url.searchParams.get('spaceId')) : undefined,
    type: url.searchParams.get('type') ?? undefined,
  };
}

function filterByQuery(list: DriveNode[], q: ReturnType<typeof pageQuery>): DriveNode[] {
  return list.filter((n) => (!q.keyword || n.name.toLowerCase().includes(q.keyword.toLowerCase())) && (!q.spaceId || n.spaceId === q.spaceId) && (!q.type || n.type === q.type));
}

// ─── 空间 ─────────────────────────────────────────────────────────────────────

const spaceHandlers = [
  http.get('/api/drive/spaces/my', () => { recalcMockDriveUsage(); return ok(mockDriveSpaces.filter((s) => s.status === 'enabled')); }),
  http.get('/api/drive/spaces', ({ request }) => {
    const url = new URL(request.url);
    const { keyword, type } = pageQuery(url);
    const status = url.searchParams.get('status');
    recalcMockDriveUsage();
    let list = mockDriveSpaces.filter((s) => s.type !== 'personal' || s.ownerId === MOCK_USER.id);
    if (keyword) list = list.filter((s) => s.name.includes(keyword) || (s.ownerName ?? '').includes(keyword));
    if (type) list = list.filter((s) => s.type === type);
    if (status) list = list.filter((s) => s.status === status);
    return ok(paginate(list, url));
  }),
  http.post('/api/drive/spaces', async ({ request }) => {
    const body = (await request.json()) as CreateDriveSpaceInput;
    if (!body.name?.trim()) return badRequest('空间名称不能为空', { status: 400 });
    const now = mockDateTime();
    const space: DriveSpace = {
      id: getNextDriveSpaceId(), type: 'team', name: body.name.trim(), description: body.description ?? null, icon: body.icon ?? null,
      ownerId: MOCK_USER.id, ownerName: MOCK_USER.name, departmentId: null, departmentName: null, defaultMemberRole: body.defaultMemberRole ?? null,
      quotaBytes: (body.quotaGb ?? mockDriveSettings.teamQuotaGb) * 1024 ** 3, customQuotaBytes: body.quotaGb === null || body.quotaGb === undefined ? null : body.quotaGb * 1024 ** 3,
      usedBytes: 0, maxVersions: body.maxVersions ?? null, allowExternalShare: body.allowExternalShare ?? true, status: body.status ?? 'enabled', sort: body.sort ?? 0,
      tenantId: null, myRole: 'manager', memberCount: body.members?.length ?? 0, nodeCount: 0, createdAt: now, updatedAt: now,
    };
    mockDriveSpaces.push(space);
    for (const m of body.members ?? []) mockDriveMembers.push({ spaceId: space.id, ...m, subjectName: subjectName(m.subjectType, m.subjectId), createdAt: now });
    return ok(space, '创建成功');
  }),
  http.get('/api/drive/spaces/:id', ({ params }) => {
    const space = mockDriveSpaces.find((s) => s.id === Number(params.id));
    if (!space) return notFound('空间不存在', { status: 404 });
    recalcMockDriveUsage();
    return ok(space);
  }),
  http.put('/api/drive/spaces/:id', async ({ params, request }) => {
    const space = mockDriveSpaces.find((s) => s.id === Number(params.id));
    if (!space) return notFound('空间不存在', { status: 404 });
    const body = (await request.json()) as Partial<CreateDriveSpaceInput>;
    const { quotaGb, ...rest } = body;
    Object.assign(space, rest, { updatedAt: mockDateTime() });
    if (quotaGb !== undefined) {
      space.customQuotaBytes = quotaGb === null ? null : quotaGb * 1024 ** 3;
      space.quotaBytes = (quotaGb ?? mockDriveSettings.teamQuotaGb) * 1024 ** 3;
    }
    return ok(space, '更新成功');
  }),
  http.delete('/api/drive/spaces/:id', ({ params }) => {
    const idx = mockDriveSpaces.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('空间不存在', { status: 404 });
    if (mockDriveSpaces[idx].type === 'personal') return badRequest('个人空间不能删除', { status: 400 });
    const spaceId = mockDriveSpaces[idx].id;
    softDelete(liveNodes().filter((n) => n.spaceId === spaceId && n.parentId === null).map((n) => n.id));
    mockDriveSpaces.splice(idx, 1);
    removeWhere(mockDriveMembers, (m) => m.spaceId === spaceId);
    return ok(null, '删除成功');
  }),
  http.get('/api/drive/spaces/:id/members', ({ params }) => ok(mockDriveMembers.filter((m) => m.spaceId === Number(params.id)))),
  http.put('/api/drive/spaces/:id/members', async ({ params, request }) => {
    const spaceId = Number(params.id);
    const body = (await request.json()) as { members: Array<{ subjectType: DriveSubjectType; subjectId: number; role: DriveRole }> };
    removeWhere(mockDriveMembers, (m) => m.spaceId === spaceId);
    const now = mockDateTime();
    for (const m of body.members) mockDriveMembers.push({ spaceId, ...m, subjectName: subjectName(m.subjectType, m.subjectId), createdAt: now });
    recalcMockDriveUsage();
    return ok(null, '成员已更新');
  }),
  http.post('/api/drive/spaces/:id/transfer', async ({ params, request }) => {
    const space = mockDriveSpaces.find((s) => s.id === Number(params.id));
    if (!space) return notFound('空间不存在', { status: 404 });
    const { ownerId } = (await request.json()) as { ownerId: number };
    space.ownerId = ownerId; space.ownerName = subjectName('user', ownerId); space.updatedAt = mockDateTime();
    return ok(space, '已转让');
  }),
];

// ─── 节点：静态路径 ───────────────────────────────────────────────────────────

const nodeStaticHandlers = [
  http.get('/api/drive/nodes/recycle', ({ request }) => {
    const url = new URL(request.url);
    const q = pageQuery(url);
    const roots = mockDriveNodes.filter((n) => n.deletedAt && (n as DriveNode & { deletedRootId?: number }).deletedRootId === n.id);
    const list = filterByQuery(roots, q).sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')).map((n) => ({ ...decorate(n), spaceName: spaceName(n.spaceId) }));
    return ok(paginate(list, url));
  }),
  http.post('/api/drive/nodes/recycle/restore', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    for (const id of ids) {
      const root = findNode(id);
      if (!root?.deletedAt) continue;
      if (root.parentId && !liveNodes().some((n) => n.id === root.parentId)) { root.parentId = null; root.ancestorIds = []; root.depth = 0; }
      root.name = uniqueName(root.name, root.spaceId, root.parentId, root.id);
      for (const n of subtree(id)) { n.deletedAt = null; n.deletedBy = null; n.deletedByName = null; }
      logMockDriveActivity({ spaceId: root.spaceId, nodeId: root.id, nodeName: root.name, nodeType: root.type, action: 'restore', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    }
    return ok(null, '已还原');
  }),
  http.post('/api/drive/nodes/recycle/purge', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    const victims = new Set(ids.flatMap((id) => subtree(id).map((n) => n.id)));
    removeWhere(mockDriveNodes, (n) => victims.has(n.id));
    removeWhere(mockDriveVersions, (v) => victims.has(v.nodeId));
    recalcMockDriveUsage();
    return ok(null, '已彻底删除');
  }),
  http.delete('/api/drive/nodes/recycle', ({ request }) => {
    const spaceId = new URL(request.url).searchParams.get('spaceId');
    removeWhere(mockDriveNodes, (n) => !!n.deletedAt && (!spaceId || n.spaceId === Number(spaceId)));
    recalcMockDriveUsage();
    return ok(null, '回收站已清空');
  }),
  http.get('/api/drive/nodes/starred', ({ request }) => {
    const url = new URL(request.url);
    const list = filterByQuery(liveNodes().filter((n) => mockDriveStars.has(n.id)), pageQuery(url)).map((n) => ({ ...decorate(n), spaceName: spaceName(n.spaceId) }));
    return ok(paginate(list, url));
  }),
  http.get('/api/drive/nodes/recent', ({ request }) => {
    const url = new URL(request.url);
    const q = pageQuery(url);
    const list = mockDriveRecent
      .map((r) => ({ node: findNode(r.nodeId), r }))
      .filter((x): x is { node: DriveNode; r: typeof mockDriveRecent[number] } => !!x.node && !x.node.deletedAt)
      .sort((a, b) => b.r.lastAccessAt.localeCompare(a.r.lastAccessAt))
      .map(({ node, r }) => ({ ...decorate(node), spaceName: spaceName(node.spaceId), lastAccessAt: r.lastAccessAt, lastAction: r.lastAction }));
    return ok(paginate(filterByQuery(list, q) as typeof list, url));
  }),
  http.get('/api/drive/nodes/shared-with-me', ({ request }) => {
    const url = new URL(request.url);
    const q = pageQuery(url);
    const list = mockDrivePermissions
      .filter((p) => p.subjectType === 'user' && p.subjectId === MOCK_USER.id)
      .map((p) => ({ node: findNode(p.nodeId), p }))
      .filter((x): x is { node: DriveNode; p: typeof mockDrivePermissions[number] } => !!x.node && !x.node.deletedAt)
      .map(({ node, p }) => ({ ...decorate(node), spaceName: spaceName(node.spaceId), grantedVia: p.subjectType, grantedRole: p.role }));
    return ok(paginate(filterByQuery(list, q) as typeof list, url));
  }),
  http.get('/api/drive/nodes/search', ({ request }) => {
    const url = new URL(request.url);
    const q = pageQuery(url);
    if (!q.keyword) return badRequest('请输入搜索关键词', { status: 400 });
    const fullText = url.searchParams.get('fullText') === 'true';
    const kw = q.keyword.toLowerCase();
    const list = liveNodes()
      .filter((n) => (!q.spaceId || n.spaceId === q.spaceId) && (!q.type || n.type === q.type))
      .map((n) => {
        const text = fullText ? mockDriveTexts.get(n.id) : undefined;
        const hitName = n.name.toLowerCase().includes(kw);
        const idx = text ? text.toLowerCase().indexOf(kw) : -1;
        if (!hitName && idx < 0) return null;
        const snippet = idx >= 0 && text ? `${idx > 30 ? '…' : ''}${text.slice(Math.max(0, idx - 30), idx + kw.length + 30).replaceAll(/\s+/g, ' ')}…` : null;
        return { ...decorate(n), spaceName: spaceName(n.spaceId), snippet };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return ok(paginate(list, url, 20));
  }),
  http.post('/api/drive/nodes/precheck', async ({ request }) => {
    const body = (await request.json()) as { spaceId: number; parentId: number | null; fileName: string; fileSize: number; contentHash?: string; conflictPolicy?: string };
    const space = mockDriveSpaces.find((s) => s.id === body.spaceId);
    if (!space) return notFound('空间不存在', { status: 404 });
    const existing = liveNodes().find((n) => n.spaceId === body.spaceId && n.parentId === (body.parentId ?? null) && n.name.toLowerCase() === body.fileName.toLowerCase());
    const remaining = space.quotaBytes ? space.quotaBytes - space.usedBytes : null;
    return ok({ conflict: !!existing, existingNodeId: existing?.id ?? null, quotaOk: remaining === null || remaining >= body.fileSize, quotaRemaining: remaining, instant: false, node: null });
  }),
  http.post('/api/drive/nodes/upload', async ({ request }) => {
    const fd = await request.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return badRequest('缺少文件', { status: 400 });
    const spaceId = Number(fd.get('spaceId'));
    const parentId = fd.get('parentId') ? Number(fd.get('parentId')) : null;
    const policy = String(fd.get('conflictPolicy') ?? 'rename');
    const parent = parentId ? findNode(parentId) : null;
    const existing = liveNodes().find((n) => n.spaceId === spaceId && n.parentId === parentId && n.name.toLowerCase() === file.name.toLowerCase());
    if (existing && policy === 'fail') return badRequest('同名文件已存在', { status: 400 });
    const now = mockDateTime();
    if (existing && policy === 'version' && existing.type === 'file') {
      mockDriveVersions.forEach((v) => { if (v.nodeId === existing.id) v.isCurrent = false; });
      existing.currentVersion += 1; existing.size = file.size; existing.updatedAt = now;
      mockDriveVersions.push({ id: getNextDriveVersionId(), nodeId: existing.id, version: existing.currentVersion, fileId: `mock-file-${existing.id}-v${existing.currentVersion}`, size: file.size, contentHash: null, comment: null, authorId: MOCK_USER.id, authorName: MOCK_USER.name, isCurrent: true, url: existing.url ?? '', createdAt: now });
      if (file.type.startsWith('text/')) mockDriveTexts.set(existing.id, await file.text());
      recalcMockDriveUsage();
      return ok(decorate(existing), '已上传新版本');
    }
    const id = getNextDriveNodeId();
    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : null;
    const node: DriveNode = {
      id, spaceId, parentId, ancestorIds: parent ? [...parent.ancestorIds, parent.id] : [], depth: parent ? parent.depth + 1 : 0, type: 'file',
      name: uniqueName(file.name, spaceId, parentId), extension: ext, mimeType: file.type || null, fileId: `mock-file-${id}`, size: file.size, contentHash: null,
      currentVersion: 1, inheritPermissions: true, lockedBy: null, lockedByName: null, lockedAt: null, lockExpiresAt: null,
      thumbnailUrl: file.type.startsWith('image/') ? `/api/drive/nodes/${id}/thumbnail` : null, url: `/api/drive/nodes/${id}/content`,
      deletedAt: null, deletedBy: null, deletedByName: null, createdBy: MOCK_USER.id, createdByName: MOCK_USER.name, updatedBy: MOCK_USER.id, updatedByName: MOCK_USER.name, createdAt: now, updatedAt: now,
    };
    mockDriveNodes.push(node);
    if (file.type.startsWith('text/')) mockDriveTexts.set(id, await file.text());
    mockDriveRecent.unshift({ nodeId: id, lastAccessAt: now, lastAction: 'upload' });
    logMockDriveActivity({ spaceId, nodeId: id, nodeName: node.name, nodeType: 'file', action: 'upload', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: { size: file.size } });
    recalcMockDriveUsage();
    return ok(decorate(node), '上传成功');
  }),
  http.post('/api/drive/nodes/folder', async ({ request }) => {
    const body = (await request.json()) as CreateDriveFolderInput;
    const parent = body.parentId ? findNode(body.parentId) : null;
    if (body.parentId && !parent) return notFound('父目录不存在', { status: 404 });
    const name = body.name.trim();
    if (liveNodes().some((n) => n.spaceId === body.spaceId && n.parentId === (body.parentId ?? null) && n.name.toLowerCase() === name.toLowerCase())) {
      return badRequest('同一目录下已存在同名项目', { status: 400 });
    }
    const now = mockDateTime();
    const id = getNextDriveNodeId();
    const node: DriveNode = {
      id, spaceId: body.spaceId, parentId: body.parentId ?? null, ancestorIds: parent ? [...parent.ancestorIds, parent.id] : [], depth: parent ? parent.depth + 1 : 0,
      type: 'folder', name, extension: null, mimeType: null, fileId: null, size: 0, contentHash: null, currentVersion: 0, inheritPermissions: true,
      lockedBy: null, lockedByName: null, lockedAt: null, lockExpiresAt: null, thumbnailUrl: null, url: null, deletedAt: null, deletedBy: null, deletedByName: null,
      createdBy: MOCK_USER.id, createdByName: MOCK_USER.name, updatedBy: MOCK_USER.id, updatedByName: MOCK_USER.name, createdAt: now, updatedAt: now,
    };
    mockDriveNodes.push(node);
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: id, nodeName: name, nodeType: 'folder', action: 'create_folder', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    return ok(decorate(node), '文件夹已创建');
  }),
  http.post('/api/drive/nodes/move', async ({ request }) => {
    const body = (await request.json()) as { ids: number[]; targetSpaceId: number; targetParentId: number | null };
    const target = body.targetParentId ? findNode(body.targetParentId) : null;
    for (const id of body.ids) {
      const node = findNode(id);
      if (!node) continue;
      if (target && (target.id === id || target.ancestorIds.includes(id))) return badRequest('不能移动到自身或其子目录', { status: 400 });
      const oldDepth = node.ancestorIds.length;
      const newAncestors = target ? [...target.ancestorIds, target.id] : [];
      for (const n of subtree(id)) {
        n.ancestorIds = [...newAncestors, ...n.ancestorIds.slice(oldDepth)];
        n.depth = n.ancestorIds.length; n.spaceId = body.targetSpaceId;
      }
      node.parentId = body.targetParentId ?? null;
      node.name = uniqueName(node.name, body.targetSpaceId, node.parentId, node.id);
      node.updatedAt = mockDateTime();
      logMockDriveActivity({ spaceId: node.spaceId, nodeId: id, nodeName: node.name, nodeType: node.type, action: 'move', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    }
    recalcMockDriveUsage();
    return ok(null, '已移动');
  }),
  http.post('/api/drive/nodes/copy', async ({ request }) => {
    const body = (await request.json()) as { ids: number[]; targetSpaceId: number; targetParentId: number | null };
    const target = body.targetParentId ? findNode(body.targetParentId) : null;
    let copied = 0;
    const clone = (node: DriveNode, parent: DriveNode | null) => {
      const now = mockDateTime();
      const id = getNextDriveNodeId();
      const copy: DriveNode = {
        ...node, id, spaceId: body.targetSpaceId, parentId: parent?.id ?? null, ancestorIds: parent ? [...parent.ancestorIds, parent.id] : [], depth: parent ? parent.depth + 1 : 0,
        name: uniqueName(node.name, body.targetSpaceId, parent?.id ?? null), url: node.type === 'file' ? `/api/drive/nodes/${id}/content` : null,
        thumbnailUrl: node.thumbnailUrl ? `/api/drive/nodes/${id}/thumbnail` : null, currentVersion: node.type === 'file' ? 1 : 0, lockedBy: null, lockedByName: null, lockedAt: null, lockExpiresAt: null, createdAt: now, updatedAt: now,
      };
      mockDriveNodes.push(copy);
      copied += 1;
      const text = mockDriveTexts.get(node.id);
      if (text) mockDriveTexts.set(id, text);
      for (const child of liveNodes().filter((n) => n.parentId === node.id)) clone(child, copy);
    };
    for (const id of body.ids) { const node = findNode(id); if (node) clone(node, target ?? null); }
    recalcMockDriveUsage();
    return ok({ mode: 'sync', taskId: null, copied }, '已复制');
  }),
  http.delete('/api/drive/nodes/batch', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    softDelete(ids);
    return ok(null, '已移入回收站');
  }),
  http.post('/api/drive/nodes/batch-download', async ({ request }) => {
    const { ids } = (await request.json()) as { ids: number[] };
    const files = ids.flatMap((id) => subtree(id)).filter((n) => n.type === 'file');
    if (files.length > DRIVE_SYNC_ZIP_MAX_FILES) {
      const task = createImmediateMockTask({ taskType: 'drive-batch-download', title: `打包下载 ${files.length} 个文件`, module: '企业网盘' });
      return ok({ mode: 'task', taskId: task.id });
    }
    const manifest = files.map((f) => `${f.name}\t${f.size}`).join('\n');
    return new HttpResponse(`演示模式：打包内容清单\n${manifest}`, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`drive_${Date.now()}.zip`)}` } });
  }),
  http.get('/api/drive/nodes', ({ request }) => {
    const url = new URL(request.url);
    const q = pageQuery(url);
    const parentId = url.searchParams.get('parentId') ? Number(url.searchParams.get('parentId')) : null;
    const parent = parentId ? findNode(parentId) ?? null : null;
    if (parentId && !parent) return notFound('目录不存在', { status: 404 });
    const spaceId = parent?.spaceId ?? q.spaceId;
    const space = mockDriveSpaces.find((s) => s.id === spaceId);
    if (!space) return notFound('空间不存在', { status: 404 });
    recalcMockDriveUsage();
    const siblings = liveNodes().filter((n) => n.spaceId === space.id && n.parentId === parentId && (!q.keyword || n.name.toLowerCase().includes(q.keyword.toLowerCase())) && (!q.type || n.type === q.type));
    const sorted = sortNodes(siblings, url.searchParams.get('sortBy') ?? 'name', url.searchParams.get('order') ?? 'asc').map(decorate);
    const paged = paginate(sorted, url, 50);
    const result: DriveNodeListResult = {
      ...paged,
      space: { id: space.id, name: space.name, type: space.type, quotaBytes: space.quotaBytes, usedBytes: space.usedBytes, allowExternalShare: space.allowExternalShare },
      parent: parent ? decorate(parent) : null, breadcrumbs: breadcrumbsOf(parent), myRole: 'manager',
    };
    return ok(result);
  }),
];

// ─── 节点：动态路径 ───────────────────────────────────────────────────────────

const nodeItemHandlers = [
  http.get('/api/drive/nodes/:id/content', ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node || node.type !== 'file') return notFound('文件不存在', { status: 404 });
    return contentResponse(node, new URL(request.url).searchParams.get('download') === 'true');
  }),
  http.get('/api/drive/nodes/:id/thumbnail', ({ params }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('文件不存在', { status: 404 });
    return new HttpResponse(svgPlaceholder(node.name), { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
  }),
  http.put('/api/drive/nodes/:id/rename', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    const { name } = (await request.json()) as { name: string };
    if (liveNodes().some((n) => n.id !== node.id && n.spaceId === node.spaceId && n.parentId === node.parentId && n.name.toLowerCase() === name.trim().toLowerCase())) {
      return badRequest('同一目录下已存在同名项目', { status: 400 });
    }
    const from = node.name;
    node.name = name.trim(); node.updatedAt = mockDateTime();
    if (node.type === 'file') node.extension = node.name.includes('.') ? node.name.split('.').pop()!.toLowerCase() : null;
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'rename', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: { from, to: node.name } });
    return ok(decorate(node), '已重命名');
  }),
  http.post('/api/drive/nodes/:id/star', ({ params }) => { mockDriveStars.add(Number(params.id)); return ok(null); }),
  http.delete('/api/drive/nodes/:id/star', ({ params }) => { mockDriveStars.delete(Number(params.id)); return ok(null); }),
  http.get('/api/drive/nodes/:id/permissions', ({ params }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    return ok(permissionsResult(node));
  }),
  http.put('/api/drive/nodes/:id/permissions', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    const body = (await request.json()) as SaveDriveNodePermissionsInput;
    removeWhere(mockDrivePermissions, (p) => p.nodeId === node.id);
    const now = mockDateTime();
    for (const p of body.permissions) {
      mockDrivePermissions.push({ id: getNextDrivePermissionId(), nodeId: node.id, subjectType: p.subjectType, subjectId: p.subjectId, subjectName: subjectName(p.subjectType, p.subjectId), role: p.role, expireAt: p.expireAt ?? null, createdBy: MOCK_USER.id, createdByName: MOCK_USER.name, createdAt: now, inheritedFrom: null });
    }
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'permission_change', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    return ok(permissionsResult(node), '授权已保存');
  }),
  http.put('/api/drive/nodes/:id/inherit', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    const { inherit } = (await request.json()) as { inherit: boolean };
    node.inheritPermissions = inherit;
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'inherit_change', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: { inherit } });
    return ok(permissionsResult(node));
  }),
  http.get('/api/drive/nodes/:id/versions', ({ params }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    let versions = mockDriveVersions.filter((v) => v.nodeId === node.id);
    if (versions.length === 0 && node.type === 'file') {
      versions = [{ id: getNextDriveVersionId(), nodeId: node.id, version: node.currentVersion || 1, fileId: node.fileId ?? '', size: node.size, contentHash: node.contentHash, comment: null, authorId: node.createdBy, authorName: node.createdByName, isCurrent: true, url: node.url ?? '', createdAt: node.createdAt }];
      mockDriveVersions.push(...versions);
    }
    return ok([...versions].sort((a, b) => b.version - a.version));
  }),
  http.post('/api/drive/nodes/:id/versions', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node || node.type !== 'file') return notFound('文件不存在', { status: 404 });
    const fd = await request.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return badRequest('缺少文件', { status: 400 });
    const now = mockDateTime();
    mockDriveVersions.forEach((v) => { if (v.nodeId === node.id) v.isCurrent = false; });
    node.currentVersion += 1; node.size = file.size; node.updatedAt = now;
    mockDriveVersions.push({ id: getNextDriveVersionId(), nodeId: node.id, version: node.currentVersion, fileId: `mock-file-${node.id}-v${node.currentVersion}`, size: file.size, contentHash: null, comment: String(fd.get('comment') ?? '') || null, authorId: MOCK_USER.id, authorName: MOCK_USER.name, isCurrent: true, url: node.url ?? '', createdAt: now });
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: 'file', action: 'new_version', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: { size: file.size, version: node.currentVersion } });
    recalcMockDriveUsage();
    return ok(decorate(node), '已上传新版本');
  }),
  http.post('/api/drive/nodes/:id/versions/:version/restore', ({ params }) => {
    const node = findNode(params.id as string);
    const source = mockDriveVersions.find((v) => v.nodeId === Number(params.id) && v.version === Number(params.version));
    if (!node || !source) return notFound('版本不存在', { status: 404 });
    const now = mockDateTime();
    mockDriveVersions.forEach((v) => { if (v.nodeId === node.id) v.isCurrent = false; });
    node.currentVersion += 1; node.size = source.size; node.updatedAt = now;
    mockDriveVersions.push({ ...source, id: getNextDriveVersionId(), version: node.currentVersion, comment: `回滚自 v${source.version}`, isCurrent: true, createdAt: now, authorId: MOCK_USER.id, authorName: MOCK_USER.name });
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: 'file', action: 'version_restore', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: { version: source.version } });
    return ok(decorate(node), '已回滚');
  }),
  http.delete('/api/drive/nodes/:id/versions/:version', ({ params }) => {
    const idx = mockDriveVersions.findIndex((v) => v.nodeId === Number(params.id) && v.version === Number(params.version));
    if (idx === -1) return notFound('版本不存在', { status: 404 });
    if (mockDriveVersions[idx].isCurrent) return badRequest('不能删除当前版本', { status: 400 });
    mockDriveVersions.splice(idx, 1);
    recalcMockDriveUsage();
    return ok(null, '已删除');
  }),
  http.get('/api/drive/nodes/:id/activities', ({ params, request }) => {
    const url = new URL(request.url);
    return ok(paginate(mockDriveActivities.filter((a) => a.nodeId === Number(params.id)), url, 20));
  }),
  http.get('/api/drive/nodes/:id/comments', ({ params }) => ok(mockDriveComments.filter((c) => c.nodeId === Number(params.id)))),
  http.post('/api/drive/nodes/:id/comments', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    const body = (await request.json()) as { content: string; parentId?: number | null };
    const now = mockDateTime();
    const comment = { id: getNextDriveCommentId(), nodeId: node.id, parentId: body.parentId ?? null, content: body.content.trim(), authorId: MOCK_USER.id, authorName: MOCK_USER.name, createdAt: now, updatedAt: now };
    mockDriveComments.push(comment);
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'comment', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    return ok(comment, '已评论');
  }),
  http.delete('/api/drive/nodes/:id/comments/:commentId', ({ params }) => {
    removeWhere(mockDriveComments, (c) => c.id === Number(params.commentId));
    return ok(null, '已删除');
  }),
  http.put('/api/drive/nodes/:id/tags', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    const { tagIds } = (await request.json()) as { tagIds: number[] };
    mockDriveNodeTags.set(node.id, tagIds);
    return ok(decorate(node), '标签已更新');
  }),
  http.post('/api/drive/nodes/:id/lock', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    if (node.lockedBy && node.lockedBy !== MOCK_USER.id) return forbidden(`文件已被 ${node.lockedByName ?? '他人'} 锁定`, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { minutes?: number };
    const now = new Date();
    node.lockedBy = MOCK_USER.id; node.lockedByName = MOCK_USER.name; node.lockedAt = mockDateTime(now);
    node.lockExpiresAt = body.minutes ? mockDateTime(new Date(now.getTime() + body.minutes * 60_000)) : mockDateTime(new Date(now.getTime() + 60 * 60_000));
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'lock', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    return ok(decorate(node), '已锁定');
  }),
  http.delete('/api/drive/nodes/:id/lock', ({ params }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    node.lockedBy = null; node.lockedByName = null; node.lockedAt = null; node.lockExpiresAt = null;
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'unlock', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: null, detail: null });
    return ok(decorate(node), '已解锁');
  }),
  http.get('/api/drive/nodes/:id/share-links', ({ params }) => ok(mockDriveShareLinks.filter((l) => l.nodeId === Number(params.id)).map(withState))),
  http.post('/api/drive/nodes/:id/share-links', async ({ params, request }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    if (!mockDriveSettings.externalShareEnabled) return forbidden('管理员已关闭外链分享功能', { status: 403 });
    const body = (await request.json()) as CreateDriveShareLinkInput;
    if (mockDriveSettings.externalShareRequirePassword && !body.password) return badRequest('管理员要求外链必须设置访问密码', { status: 400 });
    const now = mockDateTime();
    const id = getNextDriveShareId();
    const token = `demo-share-${id.toString().padStart(4, '0')}-${Math.random().toString(36).slice(2, 10)}`;
    const link: DriveShareLink = {
      id, nodeId: node.id, nodeName: node.name, nodeType: node.type, spaceId: node.spaceId, token, url: `/public/drive/${token}`,
      hasPassword: !!body.password, permission: body.permission ?? 'preview', enabled: true, expireAt: body.expireAt ?? null, maxAccessCount: body.maxAccessCount ?? null,
      accessCount: 0, downloadCount: 0, revokedAt: null, remark: body.remark ?? null, state: 'active', createdBy: MOCK_USER.id, createdByName: MOCK_USER.name, createdAt: now, updatedAt: now,
    };
    if (body.password) mockDriveSharePasswords.set(id, body.password);
    mockDriveShareLinks.unshift(link);
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'share_create', actorId: MOCK_USER.id, actorName: MOCK_USER.name, shareId: id, detail: null });
    return ok(withState(link), '外链已创建');
  }),
  http.get('/api/drive/nodes/:id', ({ params }) => {
    const node = findNode(params.id as string);
    if (!node) return notFound('节点不存在', { status: 404 });
    return ok(detailOf(node));
  }),
];

// ─── 外链 ─────────────────────────────────────────────────────────────────────

const shareLinkHandlers = [
  http.get('/api/drive/share-links', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const state = url.searchParams.get('state');
    let list = mockDriveShareLinks.map(withState);
    if (keyword) list = list.filter((l) => l.nodeName.includes(keyword) || (l.remark ?? '').includes(keyword));
    if (state) list = list.filter((l) => l.state === state);
    return ok(paginate(list, url));
  }),
  http.get('/api/drive/share-links/:id/access-logs', ({ params, request }) => ok(paginate(mockDriveShareAccessLogs.filter((l) => l.shareId === Number(params.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), new URL(request.url), 20))),
  http.post('/api/drive/share-links/:id/revoke', ({ params }) => {
    const link = mockDriveShareLinks.find((l) => l.id === Number(params.id));
    if (!link) return notFound('外链不存在', { status: 404 });
    link.revokedAt = mockDateTime(); link.updatedAt = link.revokedAt;
    return ok(null, '已撤销');
  }),
  http.put('/api/drive/share-links/:id', async ({ params, request }) => {
    const link = mockDriveShareLinks.find((l) => l.id === Number(params.id));
    if (!link) return notFound('外链不存在', { status: 404 });
    if (link.revokedAt) return badRequest('外链已撤销，不能修改', { status: 400 });
    const body = (await request.json()) as UpdateDriveShareLinkInput;
    const { password, clearPassword, ...rest } = body;
    Object.assign(link, rest, { updatedAt: mockDateTime() });
    if (clearPassword) { mockDriveSharePasswords.delete(link.id); link.hasPassword = false; }
    if (password) { mockDriveSharePasswords.set(link.id, password); link.hasPassword = true; }
    return ok(withState(link), '已更新');
  }),
  http.delete('/api/drive/share-links/:id', ({ params }) => {
    removeWhere(mockDriveShareLinks, (l) => l.id === Number(params.id));
    return ok(null, '已删除');
  }),
];

// ─── 公开外链 ─────────────────────────────────────────────────────────────────

function shareByToken(token: string): DriveShareLink | undefined {
  return mockDriveShareLinks.find((l) => l.token === token);
}

function sessionShare(request: Request, token: string): DriveShareLink | null {
  const session = request.headers.get('session') ?? new URL(request.url).searchParams.get('session');
  if (!session) return null;
  const shareId = mockDriveShareSessions.get(session);
  const share = shareByToken(token);
  return share && share.id === shareId ? share : null;
}

const publicHandlers = [
  http.post('/api/drive/public/shares/:token/access', async ({ params, request }) => {
    const share = shareByToken(String(params.token));
    if (!share) return notFound('链接不存在或已失效', { status: 404 });
    const state = shareState(share);
    if (state !== 'active') return forbidden({ expired: '链接已过期', exhausted: '链接访问次数已用尽', disabled: '链接已停用', revoked: '链接已撤销', active: '' }[state], { status: 403 });
    const { password } = (await request.json().catch(() => ({}))) as { password?: string };
    const expected = mockDriveSharePasswords.get(share.id);
    if (expected && password !== expected) {
      mockDriveShareAccessLogs.push({ id: mockDriveShareAccessLogs.length + 1, shareId: share.id, nodeId: share.nodeId, action: 'access', clientIp: '127.0.0.1', ok: false, createdAt: mockDateTime() });
      return unauthorized('访问密码错误', { status: 401 });
    }
    const node = findNode(share.nodeId);
    if (!node || node.deletedAt) return notFound('分享的文件已被删除', { status: 404 });
    share.accessCount += 1;
    const session = `demo-session-${Math.random().toString(36).slice(2)}`;
    mockDriveShareSessions.set(session, share.id);
    mockDriveShareAccessLogs.push({ id: mockDriveShareAccessLogs.length + 1, shareId: share.id, nodeId: share.nodeId, action: 'access', clientIp: '127.0.0.1', ok: true, createdAt: mockDateTime() });
    logMockDriveActivity({ spaceId: node.spaceId, nodeId: node.id, nodeName: node.name, nodeType: node.type, action: 'share_access', actorId: null, actorName: null, shareId: share.id, detail: null });
    return ok({
      session, expiresAt: mockDateTime(new Date(Date.now() + 2 * 60 * 60_000)),
      meta: { token: share.token, permission: share.permission, requirePassword: !!expected, node: toPublicNode(node, share.token), expireAt: share.expireAt, sharerName: share.createdByName },
    });
  }),
  http.get('/api/drive/public/shares/:token/nodes/:nodeId/content', ({ params, request }) => {
    const share = sessionShare(request, String(params.token));
    if (!share) return unauthorized('访问会话已失效，请重新验证', { status: 401 });
    const download = new URL(request.url).searchParams.get('download') === 'true';
    if (download && share.permission !== 'download') return forbidden('该外链仅允许在线预览', { status: 403 });
    const node = findNode(params.nodeId as string);
    if (!node || node.type !== 'file' || (node.id !== share.nodeId && !node.ancestorIds.includes(share.nodeId))) return notFound('文件不存在', { status: 404 });
    if (download) share.downloadCount += 1;
    return contentResponse(node, download);
  }),
  http.get('/api/drive/public/shares/:token/nodes', ({ params, request }) => {
    const share = sessionShare(request, String(params.token));
    if (!share) return unauthorized('访问会话已失效，请重新验证', { status: 401 });
    const parentId = Number(new URL(request.url).searchParams.get('parentId') ?? share.nodeId);
    const parent = findNode(parentId);
    if (!parent || (parent.id !== share.nodeId && !parent.ancestorIds.includes(share.nodeId))) return notFound('目录不存在', { status: 404 });
    return ok(sortNodes(liveNodes().filter((n) => n.parentId === parentId), 'name', 'asc').map((n) => toPublicNode(n, share.token)));
  }),
  http.post('/api/drive/public/shares/:token/save', async ({ params, request }) => {
    const share = sessionShare(request, String(params.token));
    if (!share) return unauthorized('访问会话已失效，请重新验证', { status: 401 });
    if (share.permission !== 'download') return forbidden('该外链仅允许在线预览，不能转存', { status: 403 });
    const body = (await request.json()) as { nodeIds?: number[]; targetSpaceId: number; targetParentId: number | null };
    const target = body.targetParentId ? findNode(body.targetParentId) : null;
    const now = mockDateTime();
    for (const id of body.nodeIds ?? [share.nodeId]) {
      const src = findNode(id);
      if (!src) continue;
      const nid = getNextDriveNodeId();
      mockDriveNodes.push({ ...src, id: nid, spaceId: body.targetSpaceId, parentId: target?.id ?? null, ancestorIds: target ? [...target.ancestorIds, target.id] : [], depth: target ? target.depth + 1 : 0, name: uniqueName(src.name, body.targetSpaceId, target?.id ?? null), url: src.type === 'file' ? `/api/drive/nodes/${nid}/content` : null, createdAt: now, updatedAt: now });
    }
    recalcMockDriveUsage();
    return ok(null, '已转存');
  }),
  http.get('/api/drive/public/shares/:token', ({ params, request }) => {
    const share = shareByToken(String(params.token));
    if (!share) return notFound('链接不存在或已失效', { status: 404 });
    const state = shareState(share);
    if (state !== 'active') return forbidden({ expired: '链接已过期', exhausted: '链接访问次数已用尽', disabled: '链接已停用', revoked: '链接已撤销', active: '' }[state], { status: 403 });
    const authed = sessionShare(request, String(params.token));
    const node = findNode(share.nodeId);
    const hasSessionParam = !!(request.headers.get('session') ?? new URL(request.url).searchParams.get('session'));
    if (hasSessionParam && !authed) return unauthorized('访问会话已失效，请重新验证', { status: 401 });
    return ok({ token: share.token, permission: share.permission, requirePassword: mockDriveSharePasswords.has(share.id), node: authed && node ? toPublicNode(node, share.token) : null, expireAt: share.expireAt, sharerName: share.createdByName });
  }),
];

// ─── 标签 ─────────────────────────────────────────────────────────────────────

const tagHandlers = [
  http.get('/api/drive/tags', ({ request }) => {
    const spaceId = Number(new URL(request.url).searchParams.get('spaceId'));
    return ok(mockDriveTags.filter((t) => t.spaceId === spaceId));
  }),
  http.post('/api/drive/tags', async ({ request }) => {
    const body = (await request.json()) as { spaceId: number; name: string; color?: string };
    const existing = mockDriveTags.find((t) => t.spaceId === body.spaceId && t.name === body.name.trim());
    if (existing) return ok(existing);
    const now = mockDateTime();
    const tag: DriveTag = { id: getNextDriveTagId(), spaceId: body.spaceId, name: body.name.trim(), color: body.color ?? null, createdAt: now, updatedAt: now };
    mockDriveTags.push(tag);
    return ok(tag, '创建成功');
  }),
  http.put('/api/drive/tags/:id', async ({ params, request }) => {
    const tag = mockDriveTags.find((t) => t.id === Number(params.id));
    if (!tag) return notFound('标签不存在', { status: 404 });
    Object.assign(tag, await request.json() as Partial<DriveTag>, { updatedAt: mockDateTime() });
    return ok(tag, '更新成功');
  }),
  http.delete('/api/drive/tags/:id', ({ params }) => {
    const id = Number(params.id);
    removeWhere(mockDriveTags, (t) => t.id === id);
    for (const [nodeId, ids] of mockDriveNodeTags) mockDriveNodeTags.set(nodeId, ids.filter((x) => x !== id));
    return ok(null, '删除成功');
  }),
];

// ─── 治理 ─────────────────────────────────────────────────────────────────────

function categoryOf(node: DriveNode): string {
  const mime = node.mimeType ?? '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('sheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('word') || mime.includes('document')) return 'document';
  if (mime.startsWith('text/')) return 'text';
  return 'other';
}

const adminHandlers = [
  http.get('/api/drive/admin/stats', () => {
    recalcMockDriveUsage();
    const files = liveNodes().filter((n) => n.type === 'file');
    const byCategory = new Map<string, { count: number; bytes: number }>();
    for (const f of files) {
      const row = byCategory.get(categoryOf(f)) ?? { count: 0, bytes: 0 };
      row.count += 1; row.bytes += f.size; byCategory.set(categoryOf(f), row);
    }
    const today = mockDateTime().slice(0, 10);
    const dailyTrend = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      const date = mockDateTime(d).slice(0, 10);
      const dayActs = mockDriveActivities.filter((a) => a.createdAt.startsWith(date));
      return { date, uploads: dayActs.filter((a) => a.action === 'upload' || a.action === 'new_version').length + (i % 4 === 0 ? 2 : i % 3), downloads: dayActs.filter((a) => a.action === 'download').length + (i % 5 === 0 ? 3 : i % 2) };
    });
    return ok({
      spaceCount: mockDriveSpaces.length,
      spaceCountByType: { personal: mockDriveSpaces.filter((s) => s.type === 'personal').length, department: mockDriveSpaces.filter((s) => s.type === 'department').length, team: mockDriveSpaces.filter((s) => s.type === 'team').length },
      fileCount: files.length, folderCount: liveNodes().filter((n) => n.type === 'folder').length,
      totalBytes: mockDriveSpaces.reduce((s, x) => s + x.usedBytes, 0),
      recycleBytes: mockDriveNodes.filter((n) => n.deletedAt && n.type === 'file').reduce((s, n) => s + n.size, 0),
      versionBytes: mockDriveVersions.filter((v) => !v.isCurrent).reduce((s, v) => s + v.size, 0),
      activeShareLinks: mockDriveShareLinks.filter((l) => shareState(l) === 'active').length,
      todayUploads: mockDriveActivities.filter((a) => a.createdAt.startsWith(today) && (a.action === 'upload' || a.action === 'new_version')).length,
      todayDownloads: mockDriveActivities.filter((a) => a.createdAt.startsWith(today) && a.action === 'download').length,
      topSpaces: [...mockDriveSpaces].sort((a, b) => b.usedBytes - a.usedBytes).slice(0, 5).map((s) => ({ id: s.id, name: s.name, type: s.type, usedBytes: s.usedBytes, quotaBytes: s.quotaBytes })),
      typeDistribution: [...byCategory.entries()].map(([category, v]) => ({ category, ...v })),
      dailyTrend,
    });
  }),
  http.get('/api/drive/admin/spaces', ({ request }) => {
    const url = new URL(request.url);
    const { keyword, type } = pageQuery(url);
    const status = url.searchParams.get('status');
    recalcMockDriveUsage();
    let list = [...mockDriveSpaces];
    if (keyword) list = list.filter((s) => s.name.includes(keyword) || (s.ownerName ?? '').includes(keyword) || (s.departmentName ?? '').includes(keyword));
    if (type) list = list.filter((s) => s.type === type);
    if (status) list = list.filter((s) => s.status === status);
    return ok(paginate(list, url));
  }),
  http.post('/api/drive/admin/spaces/department', async ({ request }) => {
    const body = (await request.json()) as { departmentId: number; name?: string; defaultMemberRole?: DriveRole | null; quotaGb?: number | null };
    if (mockDriveSpaces.some((s) => s.type === 'department' && s.departmentId === body.departmentId)) return badRequest('该部门已有部门空间', { status: 400 });
    const now = mockDateTime();
    const deptName = subjectName('department', body.departmentId);
    const space: DriveSpace = {
      id: getNextDriveSpaceId(), type: 'department', name: body.name?.trim() || `${deptName} 部门空间`, description: null, icon: null, ownerId: null, ownerName: null,
      departmentId: body.departmentId, departmentName: deptName, defaultMemberRole: body.defaultMemberRole ?? 'editor',
      quotaBytes: (body.quotaGb ?? mockDriveSettings.departmentQuotaGb) * 1024 ** 3, customQuotaBytes: body.quotaGb == null ? null : body.quotaGb * 1024 ** 3, usedBytes: 0,
      maxVersions: null, allowExternalShare: true, status: 'enabled', sort: 0, tenantId: null, myRole: 'manager', memberCount: 0, nodeCount: 0, createdAt: now, updatedAt: now,
    };
    mockDriveSpaces.push(space);
    return ok(space, '部门空间已创建');
  }),
  http.post('/api/drive/admin/spaces/recalc', () => { recalcMockDriveUsage(); return ok(createImmediateMockTask({ taskType: 'drive-recalc-usage', title: '网盘容量重算', module: '企业网盘' })); }),
  http.post('/api/drive/admin/reindex', () => ok(createImmediateMockTask({ taskType: 'drive-reindex', title: '网盘索引补建', module: '企业网盘' }))),
  http.put('/api/drive/admin/spaces/:id', async ({ params, request }) => {
    const space = mockDriveSpaces.find((s) => s.id === Number(params.id));
    if (!space) return notFound('空间不存在', { status: 404 });
    const body = (await request.json()) as Record<string, unknown> & { quotaGb?: number | null; ownerId?: number };
    const { quotaGb, ownerId, ...rest } = body;
    Object.assign(space, rest, { updatedAt: mockDateTime() });
    if (quotaGb !== undefined) {
      space.customQuotaBytes = quotaGb === null ? null : quotaGb * 1024 ** 3;
      const fallback = space.type === 'personal' ? mockDriveSettings.personalQuotaGb : space.type === 'department' ? mockDriveSettings.departmentQuotaGb : mockDriveSettings.teamQuotaGb;
      space.quotaBytes = (quotaGb ?? fallback) * 1024 ** 3;
    }
    if (ownerId) { space.ownerId = ownerId; space.ownerName = subjectName('user', ownerId); }
    return ok(space, '更新成功');
  }),
  http.delete('/api/drive/admin/spaces/:id', ({ params }) => {
    const idx = mockDriveSpaces.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('空间不存在', { status: 404 });
    if (mockDriveSpaces[idx].type === 'personal') return badRequest('个人空间不能删除', { status: 400 });
    const spaceId = mockDriveSpaces[idx].id;
    softDelete(liveNodes().filter((n) => n.spaceId === spaceId && n.parentId === null).map((n) => n.id));
    mockDriveSpaces.splice(idx, 1);
    return ok(null, '删除成功');
  }),
  http.get('/api/drive/admin/share-links', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const state = url.searchParams.get('state');
    let list = mockDriveShareLinks.map(withState);
    if (keyword) list = list.filter((l) => l.nodeName.includes(keyword) || (l.remark ?? '').includes(keyword) || (l.createdByName ?? '').includes(keyword));
    if (state) list = list.filter((l) => l.state === state);
    return ok(paginate(list, url));
  }),
  http.post('/api/drive/admin/share-links/:id/revoke', ({ params }) => {
    const link = mockDriveShareLinks.find((l) => l.id === Number(params.id));
    if (!link) return notFound('外链不存在', { status: 404 });
    link.revokedAt = mockDateTime(); link.updatedAt = link.revokedAt;
    return ok(null, '已撤销');
  }),
  http.get('/api/drive/admin/activities', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') ?? '';
    const spaceId = url.searchParams.get('spaceId');
    const actorId = url.searchParams.get('actorId');
    const action = url.searchParams.get('action');
    let list = [...mockDriveActivities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (keyword) list = list.filter((a) => a.nodeName.includes(keyword));
    if (spaceId) list = list.filter((a) => a.spaceId === Number(spaceId));
    if (actorId) list = list.filter((a) => a.actorId === Number(actorId));
    if (action) list = list.filter((a) => a.action === action);
    return ok(paginate(list, url));
  }),
  http.get('/api/drive/admin/settings', () => ok(mockDriveSettings)),
  http.put('/api/drive/admin/settings', async ({ request }) => {
    Object.assign(mockDriveSettings, await request.json() as Partial<typeof mockDriveSettings>);
    for (const s of mockDriveSpaces) {
      if (s.customQuotaBytes !== null) continue;
      s.quotaBytes = (s.type === 'personal' ? mockDriveSettings.personalQuotaGb : s.type === 'department' ? mockDriveSettings.departmentQuotaGb : mockDriveSettings.teamQuotaGb) * 1024 ** 3;
    }
    return ok(mockDriveSettings, '设置已保存');
  }),
];

export const driveHandlers = [
  ...spaceHandlers,
  ...nodeStaticHandlers,
  ...nodeItemHandlers,
  ...shareLinkHandlers,
  ...publicHandlers,
  ...tagHandlers,
  ...adminHandlers,
];
