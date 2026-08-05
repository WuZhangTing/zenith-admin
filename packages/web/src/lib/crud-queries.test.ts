/**
 * createCrudQueries 契约测试。
 *
 * 断言全部落在**可观测行为**上（实际发出的请求、实际重新进入 fetching 的查询、
 * 缓存条目是否还在），而不是 spy `invalidateQueries` 的调用参数——
 * 详见 test-utils/query-harness.ts 顶部说明：`xxxKeys.all` 是 `xxxKeys.detail(id)`
 * 的前缀，spy 式断言在「冗余现状」和「收敛后被改坏」两种情况下都会通过。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  hasCacheEntry,
  isFresh,
  observeFetches,
  type RecordedCall,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import { createCrudQueries } from './crud-queries';

interface Widget {
  id: number;
  name: string;
}

const widgets = createCrudQueries<Widget>({ resource: 'widgets', lookup: true });
const LIST_PARAMS = { page: 1, pageSize: 10 };

beforeEach(() => {
  api.reset();
  api.on('GET', '/api/widgets', { list: [{ id: 1, name: 'a' }], total: 1, page: 1, pageSize: 10 });
  api.on('GET', '/api/widgets/all', [{ id: 1, name: 'a' }]);
  api.on('GET', /\/api\/widgets\/\d+$/, (c: RecordedCall) => ({ id: Number(c.url.split('/').pop()), name: 'detail' }));
  api.on('POST', '/api/widgets', { id: 9, name: 'created' });
  api.on('PUT', /\/api\/widgets\/\d+$/, (c: RecordedCall) => ({ id: Number(c.url.split('/').pop()), name: 'updated' }));
  api.on('DELETE', /\/api\/widgets\/(\d+|batch)$/, null);
});

describe('key 工厂', () => {
  it('detail 与 list 都挂在资源前缀下，lists 是全部列表查询的公共前缀', () => {
    expect(widgets.keys.all).toEqual(['widgets']);
    expect(widgets.keys.lists).toEqual(['widgets', 'list']);
    expect(widgets.keys.list(LIST_PARAMS)).toEqual(['widgets', 'list', LIST_PARAMS]);
    expect(widgets.keys.detail(3)).toEqual(['widgets', 'detail', 3]);
  });
});

describe('查询', () => {
  it('列表按参数构造查询串', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => widgets.useList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.urls('GET')[0]).toBe('/api/widgets?page=1&pageSize=10');
    expect(result.current.data?.total).toBe(1);
  });

  it('详情在 id 为 undefined 时不发请求', async () => {
    const qc = createTestQueryClient();
    renderHook(() => widgets.useDetail(undefined), { wrapper: createWrapper(qc) });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.countOf('GET', /\/api\/widgets\/\d+/)).toBe(0);
  });
});

describe('保存', () => {
  it('无 id 走 POST，有 id 走 PUT', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => widgets.useSave(), { wrapper: createWrapper(qc) });

    await result.current.mutateAsync({ values: { name: 'x' } });
    expect(api.countOf('POST', '/api/widgets')).toBe(1);

    await result.current.mutateAsync({ id: 4, values: { name: 'y' } });
    expect(api.countOf('PUT', '/api/widgets/4')).toBe(1);
  });

  it('保存后列表真的重新回源', async () => {
    const qc = createTestQueryClient();
    const list = renderHook(() => widgets.useList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const save = renderHook(() => widgets.useSave(), { wrapper: createWrapper(qc) });
    const fetches = observeFetches(qc);
    await save.result.current.mutateAsync({ values: { name: 'x' } });

    await waitFor(() => expect(fetches.countOf(widgets.keys.lists)).toBe(1));
    fetches.stop();
  });

  it('保存后下拉源一并失效（下拉展示的是名称，改名后必须刷新）', async () => {
    const qc = createTestQueryClient();
    const lookup = renderHook(() => widgets.useLookup(), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(lookup.result.current.isSuccess).toBe(true));
    expect(isFresh(qc, widgets.keys.lookup)).toBe(true);

    const save = renderHook(() => widgets.useSave(), { wrapper: createWrapper(qc) });
    const fetches = observeFetches(qc);
    await save.result.current.mutateAsync({ id: 1, values: { name: 'renamed' } });

    await waitFor(() => expect(fetches.countOf(widgets.keys.lookup)).toBe(1));
    fetches.stop();
  });
});

describe('删除', () => {
  it('单条走 /:id，多条走 /batch', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => widgets.useDelete(), { wrapper: createWrapper(qc) });

    await result.current.mutateAsync([3]);
    expect(api.countOf('DELETE', '/api/widgets/3')).toBe(1);

    await result.current.mutateAsync([3, 4]);
    expect(api.countOf('DELETE', '/api/widgets/batch')).toBe(1);
  });

  it('删除后移除详情缓存而非失效——失效会让已删记录被重新请求并 404', async () => {
    const qc = createTestQueryClient();
    qc.setQueryData(widgets.keys.detail(3), { id: 3, name: 'doomed' });
    expect(hasCacheEntry(qc, widgets.keys.detail(3))).toBe(true);

    const { result } = renderHook(() => widgets.useDelete(), { wrapper: createWrapper(qc) });
    await result.current.mutateAsync([3]);

    expect(hasCacheEntry(qc, widgets.keys.detail(3))).toBe(false);
  });

  it('删除后列表回源', async () => {
    const qc = createTestQueryClient();
    const list = renderHook(() => widgets.useList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const del = renderHook(() => widgets.useDelete(), { wrapper: createWrapper(qc) });
    const fetches = observeFetches(qc);
    await del.result.current.mutateAsync([1]);

    await waitFor(() => expect(fetches.countOf(widgets.keys.lists)).toBe(1));
    fetches.stop();
  });
});

describe('跨域联动', () => {
  it('onSaved 可追加额外失效', async () => {
    const other = ['menus', 'user-access'] as const;
    const linked = createCrudQueries<Widget>({
      resource: 'linked-widgets',
      onSaved: (qc) => void qc.invalidateQueries({ queryKey: other }),
    });
    api.on('POST', '/api/linked-widgets', { id: 1, name: 'x' });

    const qc = createTestQueryClient();
    qc.setQueryData(other, { ok: true });
    expect(isFresh(qc, other)).toBe(true);

    const save = renderHook(() => linked.useSave(), { wrapper: createWrapper(qc) });
    await save.result.current.mutateAsync({ values: { name: 'x' } });

    expect(isFresh(qc, other)).toBe(false);
  });
});

describe('自定义路径', () => {
  it('path 覆盖默认 /api/{resource}', async () => {
    const nested = createCrudQueries<Widget>({ resource: 'cms-links', path: '/api/cms/links' });
    api.on('GET', '/api/cms/links', { list: [], total: 0, page: 1, pageSize: 10 });

    const qc = createTestQueryClient();
    const { result } = renderHook(() => nested.useList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.urls('GET').some((u) => u.startsWith('/api/cms/links?'))).toBe(true);
  });
});
