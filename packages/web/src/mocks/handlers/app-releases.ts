/**
 * 应用版本管理 Mock（Demo 模式）。
 *
 * 覆盖管理侧全部端点：应用 / 版本 / 制品 CRUD、发布状态机、灰度调整与看板统计。
 * 看板统计由确定性伪随机数生成（同一应用同一天数结果恒定），不重复维护静态数组。
 */
import { http } from 'msw';
import type { AppArtifact, AppRelease, AppReleaseStats, ClientApp } from '@zenith/shared/ops';
import { badRequest, notFound, ok, paginate } from '@/mocks/utils/handlers';
import { removeWhere } from '@/mocks/utils/array';
import { mockDateTime } from '@/mocks/utils/date';
import {
  getNextAppArtifactId,
  getNextAppReleaseId,
  getNextClientAppId,
  mockAppArtifacts,
  mockAppReleases,
  mockClientApps,
} from '../data/app-releases';

/** 组装列表 / 详情输出：附加应用冗余字段与制品 */
function decorateRelease(release: AppRelease): AppRelease {
  const app = mockClientApps.find((a) => a.id === release.appId);
  const artifacts = mockAppArtifacts.filter((a) => a.releaseId === release.id);
  return {
    ...release,
    appKey: app?.appKey,
    appName: app?.name,
    artifacts,
    artifactCount: artifacts.length,
  };
}

function decorateApp(app: ClientApp): ClientApp {
  const releases = mockAppReleases.filter((r) => r.appId === app.id);
  const published = releases
    .filter((r) => r.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  return { ...app, releaseCount: releases.length, latestVersion: published[0]?.version ?? null };
}

/** 确定性伪随机：同一 seed 恒定，看板刷新不跳数 */
function seededInt(seed: string, max: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % max;
}

export const appReleasesHandlers = [
  // ─── 应用 ──────────────────────────────────────────────────────────────────
  http.get('/api/app-releases/apps/all', () =>
    ok(mockClientApps.filter((a) => a.status === 'enabled').map(decorateApp))),

  http.get('/api/app-releases/apps', ({ request }) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const status = url.searchParams.get('status') || '';
    let list = mockClientApps.map(decorateApp);
    if (keyword) list = list.filter((a) => a.name.includes(keyword) || a.appKey.includes(keyword));
    if (status) list = list.filter((a) => a.status === status);
    return ok(paginate(list, url));
  }),

  http.post('/api/app-releases/apps', async ({ request }) => {
    const body = (await request.json()) as Partial<ClientApp>;
    if (mockClientApps.some((a) => a.appKey === body.appKey)) {
      return badRequest('应用标识（appKey）已存在', { status: 400 });
    }
    const now = mockDateTime();
    const app: ClientApp = {
      id: getNextClientAppId(),
      appKey: body.appKey ?? '',
      name: body.name ?? '',
      description: body.description ?? '',
      status: body.status ?? 'enabled',
      createdAt: now,
      updatedAt: now,
    };
    mockClientApps.push(app);
    return ok(decorateApp(app), '创建成功');
  }),

  http.put('/api/app-releases/apps/:id', async ({ params, request }) => {
    const idx = mockClientApps.findIndex((a) => a.id === Number(params.id));
    if (idx === -1) return notFound('应用不存在', { status: 404 });
    const body = (await request.json()) as Partial<ClientApp>;
    // appKey 创建后不可修改，与后端一致
    delete body.appKey;
    Object.assign(mockClientApps[idx], { ...body, updatedAt: mockDateTime() });
    return ok(decorateApp(mockClientApps[idx]), '更新成功');
  }),

  http.delete('/api/app-releases/apps/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockClientApps.findIndex((a) => a.id === id);
    if (idx === -1) return notFound('应用不存在', { status: 404 });
    if (mockAppReleases.some((r) => r.appId === id)) {
      return badRequest('该应用下仍有版本记录，请先删除全部版本', { status: 400 });
    }
    mockClientApps.splice(idx, 1);
    return ok(null, '删除成功');
  }),

  // ─── 看板统计（静态路径须早于 /releases/:id 之类的动态段）──────────────────
  http.get('/api/app-releases/stats', ({ request }) => {
    const url = new URL(request.url);
    const appId = Number(url.searchParams.get('appId'));
    const days = Number(url.searchParams.get('days') || 30);
    if (!mockClientApps.some((a) => a.id === appId)) return notFound('应用不存在', { status: 404 });

    const trend: AppReleaseStats['trend'] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const checks = 40 + seededInt(`${appId}:${date}:c`, 160);
      const downloads = Math.floor(checks * 0.18) + seededInt(`${appId}:${date}:d`, 8);
      const installSuccess = Math.max(0, downloads - seededInt(`${appId}:${date}:s`, 4));
      const installFail = seededInt(`${appId}:${date}:f`, 3);
      trend.push({ date, checks, downloads, installSuccess, installFail });
    }
    const totals = trend.reduce(
      (acc, t) => ({
        checks: acc.checks + t.checks,
        downloads: acc.downloads + t.downloads,
        devices: acc.devices,
        installSuccess: acc.installSuccess + t.installSuccess,
        installFail: acc.installFail + t.installFail,
      }),
      { checks: 0, downloads: 0, devices: 120 + seededInt(`${appId}:devices:${days}`, 300), installSuccess: 0, installFail: 0 },
    );

    const platformSet = new Set(
      mockAppArtifacts
        .filter((a) => mockAppReleases.some((r) => r.id === a.releaseId && r.appId === appId))
        .map((a) => a.platform),
    );
    const platforms: AppReleaseStats['platforms'] = [...platformSet].map((platform) => ({
      platform,
      count: 100 + seededInt(`${appId}:${platform}:${days}`, 900),
    }));

    const versions: AppReleaseStats['versions'] = mockAppReleases
      .filter((r) => r.appId === appId && r.status === 'published')
      .map((r) => ({ version: r.version, devices: 30 + seededInt(`${appId}:${r.version}:${days}`, 260) }))
      .sort((a, b) => b.devices - a.devices);

    return ok({ totals, trend, platforms, versions } satisfies AppReleaseStats);
  }),

  // ─── 版本 ──────────────────────────────────────────────────────────────────
  http.get('/api/app-releases/releases', ({ request }) => {
    const url = new URL(request.url);
    const appId = url.searchParams.get('appId');
    const channel = url.searchParams.get('channel') || '';
    const status = url.searchParams.get('status') || '';
    const keyword = url.searchParams.get('keyword') || '';
    let list = mockAppReleases.map(decorateRelease);
    if (appId) list = list.filter((r) => r.appId === Number(appId));
    if (channel) list = list.filter((r) => r.channel === channel);
    if (status) list = list.filter((r) => r.status === status);
    if (keyword) list = list.filter((r) => r.version.includes(keyword) || (r.notes ?? '').includes(keyword));
    list = list.sort((a, b) => b.id - a.id);
    return ok(paginate(list, url));
  }),

  http.get('/api/app-releases/releases/:id', ({ params }) => {
    const release = mockAppReleases.find((r) => r.id === Number(params.id));
    if (!release) return notFound('版本不存在', { status: 404 });
    return ok(decorateRelease(release));
  }),

  http.post('/api/app-releases/releases', async ({ request }) => {
    const body = (await request.json()) as Partial<AppRelease>;
    if (!mockClientApps.some((a) => a.id === body.appId)) return badRequest('指定的应用不存在', { status: 400 });
    if (mockAppReleases.some((r) => r.appId === body.appId && r.channel === (body.channel ?? 'stable') && r.version === body.version)) {
      return badRequest('该应用在此渠道下已存在相同版本号', { status: 400 });
    }
    const now = mockDateTime();
    const release: AppRelease = {
      id: getNextAppReleaseId(),
      appId: body.appId ?? 0,
      channel: body.channel ?? 'stable',
      version: body.version ?? '',
      notes: body.notes ?? '',
      status: 'draft',
      mandatory: body.mandatory ?? false,
      minVersion: body.minVersion ?? null,
      rolloutPercent: body.rolloutPercent ?? 100,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    mockAppReleases.push(release);
    return ok(decorateRelease(release), '创建成功');
  }),

  http.put('/api/app-releases/releases/:id', async ({ params, request }) => {
    const release = mockAppReleases.find((r) => r.id === Number(params.id));
    if (!release) return notFound('版本不存在', { status: 404 });
    const body = (await request.json()) as Partial<AppRelease>;
    if (release.status !== 'draft') {
      if (body.version !== undefined && body.version !== release.version) {
        return badRequest('仅草稿状态可修改版本号', { status: 400 });
      }
      if (body.channel !== undefined && body.channel !== release.channel) {
        return badRequest('仅草稿状态可修改发布渠道', { status: 400 });
      }
    }
    delete body.appId;
    Object.assign(release, { ...body, updatedAt: mockDateTime() });
    return ok(decorateRelease(release), '更新成功');
  }),

  http.post('/api/app-releases/releases/:id/publish', ({ params }) => {
    const release = mockAppReleases.find((r) => r.id === Number(params.id));
    if (!release) return notFound('版本不存在', { status: 404 });
    if (release.status === 'published') return badRequest('该版本已是发布状态', { status: 400 });
    if (!mockAppArtifacts.some((a) => a.releaseId === release.id)) {
      return badRequest('该版本还没有任何制品，无法发布', { status: 400 });
    }
    Object.assign(release, { status: 'published', publishedAt: mockDateTime(), updatedAt: mockDateTime() });
    return ok(decorateRelease(release), '发布成功');
  }),

  http.post('/api/app-releases/releases/:id/revoke', ({ params }) => {
    const release = mockAppReleases.find((r) => r.id === Number(params.id));
    if (!release) return notFound('版本不存在', { status: 404 });
    if (release.status !== 'published') return badRequest('仅已发布版本可以撤回', { status: 400 });
    Object.assign(release, { status: 'revoked', updatedAt: mockDateTime() });
    return ok(decorateRelease(release), '撤回成功');
  }),

  http.put('/api/app-releases/releases/:id/rollout', async ({ params, request }) => {
    const release = mockAppReleases.find((r) => r.id === Number(params.id));
    if (!release) return notFound('版本不存在', { status: 404 });
    const body = (await request.json()) as { rolloutPercent?: number };
    Object.assign(release, { rolloutPercent: body.rolloutPercent ?? 100, updatedAt: mockDateTime() });
    return ok(decorateRelease(release), '调整成功');
  }),

  http.delete('/api/app-releases/releases/:id', ({ params }) => {
    const id = Number(params.id);
    const idx = mockAppReleases.findIndex((r) => r.id === id);
    if (idx === -1) return notFound('版本不存在', { status: 404 });
    if (mockAppReleases[idx].status === 'published') {
      return badRequest('已发布版本不可删除，请先撤回', { status: 400 });
    }
    mockAppReleases.splice(idx, 1);
    removeWhere(mockAppArtifacts, (a) => a.releaseId === id);
    return ok(null, '删除成功');
  }),

  // ─── 制品 ──────────────────────────────────────────────────────────────────
  http.post('/api/app-releases/releases/:id/artifacts', async ({ params, request }) => {
    const releaseId = Number(params.id);
    if (!mockAppReleases.some((r) => r.id === releaseId)) return notFound('版本不存在', { status: 404 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return badRequest('请选择要上传的制品文件', { status: 400 });
    if (mockAppArtifacts.some((a) => a.releaseId === releaseId && a.fileName === file.name)) {
      return badRequest('该版本下已存在同名制品文件', { status: 400 });
    }
    const now = mockDateTime();
    const artifact: AppArtifact = {
      id: getNextAppArtifactId(),
      releaseId,
      platform: (form.get('platform') as AppArtifact['platform']) ?? 'windows',
      arch: (form.get('arch') as AppArtifact['arch']) ?? 'x64',
      kind: (form.get('kind') as AppArtifact['kind']) ?? 'installer',
      fileId: null,
      externalUrl: null,
      fileName: file.name,
      size: file.size,
      sha256: null,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockAppArtifacts.push(artifact);
    return ok(artifact, '上传成功');
  }),

  http.post('/api/app-releases/releases/:id/artifacts/external', async ({ params, request }) => {
    const releaseId = Number(params.id);
    if (!mockAppReleases.some((r) => r.id === releaseId)) return notFound('版本不存在', { status: 404 });
    const body = (await request.json()) as { platform?: AppArtifact['platform']; arch?: AppArtifact['arch']; externalUrl?: string; fileName?: string };
    if (mockAppArtifacts.some((a) => a.releaseId === releaseId && a.fileName === body.fileName)) {
      return badRequest('该版本下已存在同名制品文件', { status: 400 });
    }
    const now = mockDateTime();
    const artifact: AppArtifact = {
      id: getNextAppArtifactId(),
      releaseId,
      platform: body.platform ?? 'ios',
      arch: body.arch ?? 'universal',
      kind: 'external',
      fileId: null,
      externalUrl: body.externalUrl ?? '',
      fileName: body.fileName ?? '',
      size: 0,
      sha256: null,
      downloadCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    mockAppArtifacts.push(artifact);
    return ok(artifact, '添加成功');
  }),

  http.delete('/api/app-releases/artifacts/:id', ({ params }) => {
    const idx = mockAppArtifacts.findIndex((a) => a.id === Number(params.id));
    if (idx === -1) return notFound('制品不存在', { status: 404 });
    mockAppArtifacts.splice(idx, 1);
    return ok(null, '删除成功');
  }),
];
