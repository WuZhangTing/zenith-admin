import { http } from 'msw';
import { ok, badRequest, notFound, paginate } from '@/mocks/utils/handlers';
import type { DirectorySyncSource, ResolveDirectorySyncConflictInput } from '@zenith/shared/identity';
import { mockDateTime } from '@/mocks/utils/date';
import { createImmediateMockTask } from './async-tasks';
import {
  mockDirectorySyncSources, getNextDirectorySyncSourceId,
  mockDirectorySyncRuns, mockDirectorySyncRunItems, mockDirectorySyncConflicts,
  simulateDirectorySyncRun,
} from '../data/directory-sync';

function findSource(id: string | readonly string[]) {
  return mockDirectorySyncSources.find((s) => s.id === Number(id));
}

export const directorySyncHandlers = [
  // ─── 同步源 ─────────────────────────────────────────────────────────────
  http.get('/api/directory-sync/sources', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const type = url.searchParams.get('type') || '';
    const status = url.searchParams.get('status') || '';
    let list = [...mockDirectorySyncSources];
    if (keyword) list = list.filter((s) => s.name.includes(keyword) || (s.remark ?? '').includes(keyword));
    if (type) list = list.filter((s) => s.type === type);
    if (status) list = list.filter((s) => s.status === status);
    return ok(paginate(list, url));
  }),

  http.post('/api/directory-sync/sources', async ({ request }) => {
    const body = (await request.json()) as Partial<DirectorySyncSource> & { contactSecret?: string | null };
    if (mockDirectorySyncSources.some((s) => s.name === body.name)) {
      return badRequest('同名同步源已存在', { status: 400 });
    }
    const now = mockDateTime();
    const source: DirectorySyncSource = {
      id: getNextDirectorySyncSourceId(),
      name: body.name ?? '',
      type: (body.type ?? 'ldap') as DirectorySyncSource['type'],
      status: body.status ?? 'disabled',
      tenantId: body.tenantId ?? null,
      identityProviderId: body.identityProviderId ?? null,
      identityProviderName: body.identityProviderId ? '企业 AD' : null,
      oauthProvider: body.oauthProvider ?? null,
      matchKey: body.matchKey ?? 'phone',
      fieldMapping: body.fieldMapping ?? {},
      scopeConfig: body.scopeConfig ?? {},
      conflictPolicy: body.conflictPolicy ?? 'suspend',
      lifecycle: body.lifecycle ?? { disableOnLeave: true, kickSessions: true, defaultRoleIds: [] },
      syncDepartments: body.syncDepartments ?? true,
      cronExpression: body.cronExpression ?? null,
      circuitBreakerPercent: body.circuitBreakerPercent ?? 30,
      contactSecretSet: Boolean(body.contactSecret),
      nextRunAt: null,
      lastRunAt: null,
      lastRunStatus: null,
      remark: body.remark ?? null,
      createdAt: now,
      updatedAt: now,
    };
    mockDirectorySyncSources.push(source);
    return ok(source, '创建成功');
  }),

  http.get('/api/directory-sync/sources/:id', ({ params }) => {
    const source = findSource(params.id as string);
    if (!source) return notFound('同步源不存在', { status: 404 });
    return ok(source);
  }),

  http.put('/api/directory-sync/sources/:id', async ({ params, request }) => {
    const source = findSource(params.id as string);
    if (!source) return notFound('同步源不存在', { status: 404 });
    const body = (await request.json()) as Partial<DirectorySyncSource> & { contactSecret?: string | null };
    const { contactSecret, ...rest } = body;
    Object.assign(source, { ...rest, updatedAt: mockDateTime() });
    if (contactSecret) source.contactSecretSet = true;
    return ok(source, '更新成功');
  }),

  http.delete('/api/directory-sync/sources/:id', ({ params }) => {
    const idx = mockDirectorySyncSources.findIndex((s) => s.id === Number(params.id));
    if (idx === -1) return notFound('同步源不存在', { status: 404 });
    mockDirectorySyncSources.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  http.post('/api/directory-sync/sources/:id/test', ({ params }) => {
    const source = findSource(params.id as string);
    if (!source) return notFound('同步源不存在', { status: 404 });
    return ok({
      ok: true,
      message: '连接成功，抽样 3 个目录用户',
      sampleUsers: [
        { externalId: 'demo-1', username: 'wangxm', nickname: '王小明' },
        { externalId: 'demo-2', username: 'chenj', nickname: '陈静' },
        { externalId: 'demo-3', username: 'zhoul', nickname: '周磊' },
      ],
    });
  }),

  http.post('/api/directory-sync/sources/:id/preview', ({ params }) => {
    const source = findSource(params.id as string);
    if (!source) return notFound('同步源不存在', { status: 404 });
    simulateDirectorySyncRun(source, { dryRun: true, triggerType: 'preview' });
    const task = createImmediateMockTask({
      taskType: 'directory-sync-run',
      title: `通讯录差异预览（${source.name}）`,
      module: '通讯录同步',
      payload: { sourceId: source.id, dryRun: true },
      maxAttempts: 1,
    });
    return ok(task, '预览任务已提交，请在同步记录中查看差异');
  }),

  http.post('/api/directory-sync/sources/:id/run', ({ params }) => {
    const source = findSource(params.id as string);
    if (!source) return notFound('同步源不存在', { status: 404 });
    simulateDirectorySyncRun(source, { dryRun: false, triggerType: 'manual' });
    const task = createImmediateMockTask({
      taskType: 'directory-sync-run',
      title: `通讯录同步（${source.name}）`,
      module: '通讯录同步',
      payload: { sourceId: source.id, dryRun: false },
      maxAttempts: 1,
    });
    return ok(task, '同步任务已提交');
  }),

  // ─── 同步记录 ───────────────────────────────────────────────────────────
  http.get('/api/directory-sync/runs', ({ request }) => {
    const url = new URL(request.url);
    const sourceId = url.searchParams.get('sourceId');
    const status = url.searchParams.get('status') || '';
    let list = [...mockDirectorySyncRuns];
    if (sourceId) list = list.filter((r) => r.sourceId === Number(sourceId));
    if (status) list = list.filter((r) => r.status === status);
    return ok(paginate(list, url));
  }),

  http.get('/api/directory-sync/runs/:id', ({ params }) => {
    const run = mockDirectorySyncRuns.find((r) => r.id === Number(params.id));
    if (!run) return notFound('同步记录不存在', { status: 404 });
    return ok(run);
  }),

  http.get('/api/directory-sync/runs/:id/items', ({ params, request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    const entityType = url.searchParams.get('entityType') || '';
    let list = mockDirectorySyncRunItems.filter((i) => i.runId === Number(params.id));
    if (action) list = list.filter((i) => i.action === action);
    if (entityType) list = list.filter((i) => i.entityType === entityType);
    return ok(paginate(list, url, 20));
  }),

  http.post('/api/directory-sync/runs/:id/retry', ({ params }) => {
    const run = mockDirectorySyncRuns.find((r) => r.id === Number(params.id));
    if (!run) return notFound('同步记录不存在', { status: 404 });
    const source = mockDirectorySyncSources.find((s) => s.id === run.sourceId);
    if (!source) return badRequest('同步源已删除', { status: 400 });
    simulateDirectorySyncRun(source, { dryRun: false, triggerType: 'manual' });
    const task = createImmediateMockTask({
      taskType: 'directory-sync-run',
      title: `通讯录同步（${source.name}）`,
      module: '通讯录同步',
      payload: { sourceId: source.id, dryRun: false },
      maxAttempts: 1,
    });
    return ok(task, '重试任务已提交');
  }),

  // ─── 冲突处理 ───────────────────────────────────────────────────────────
  http.get('/api/directory-sync/conflicts', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const sourceId = url.searchParams.get('sourceId');
    const status = url.searchParams.get('status') || '';
    let list = [...mockDirectorySyncConflicts];
    if (keyword) list = list.filter((c) => (c.name ?? '').includes(keyword) || c.externalId.includes(keyword));
    if (sourceId) list = list.filter((c) => c.sourceId === Number(sourceId));
    if (status) list = list.filter((c) => c.status === status);
    return ok(paginate(list, url));
  }),

  http.post('/api/directory-sync/conflicts/ignore', async ({ request }) => {
    const { ids = [] } = (await request.json()) as { ids?: number[] };
    if (ids.length === 0) return badRequest('请选择要忽略的冲突', { status: 400 });
    const selected = new Set(ids);
    let count = 0;
    const now = mockDateTime();
    for (const conflict of mockDirectorySyncConflicts) {
      if (selected.has(conflict.id) && conflict.status === 'pending') {
        conflict.status = 'ignored';
        conflict.resolution = 'local';
        conflict.resolvedBy = 1;
        conflict.resolvedByNickname = '管理员';
        conflict.resolvedAt = now;
        conflict.updatedAt = now;
        count += 1;
      }
    }
    return ok(null, `已忽略 ${count} 条冲突`);
  }),

  http.post('/api/directory-sync/conflicts/:id/resolve', async ({ params, request }) => {
    const conflict = mockDirectorySyncConflicts.find((c) => c.id === Number(params.id));
    if (!conflict) return notFound('冲突记录不存在', { status: 404 });
    if (conflict.status !== 'pending') return badRequest('该冲突已处理', { status: 400 });
    const body = (await request.json()) as ResolveDirectorySyncConflictInput;
    if (conflict.conflictType === 'multi_match' && body.resolution === 'source' && !body.targetUserId) {
      return badRequest('请选择要绑定的本地账号', { status: 400 });
    }
    const now = mockDateTime();
    conflict.status = 'resolved';
    conflict.resolution = body.resolution;
    conflict.resolvedBy = 1;
    conflict.resolvedByNickname = '管理员';
    conflict.resolvedAt = now;
    conflict.updatedAt = now;
    return ok(conflict, '裁决成功');
  }),
];
