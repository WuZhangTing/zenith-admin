/**
 * 观测工具自检。
 *
 * 这些用例守护的是「度量本身可信」——如果 harness 把「被标脏」误记成「重拉」，
 * 后续所有域的收敛结论都不成立。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  isFresh,
  isInvalidated,
  observeFetches,
} from './query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import { positionKeys, usePositionList } from '@/hooks/queries/positions';

const LIST_PARAMS = { page: 1, pageSize: 10 };

beforeEach(() => {
  api.reset();
  api.on('GET', '/api/positions', { list: [], total: 0, page: 1, pageSize: 10 });
});

describe('observeFetches', () => {
  it('counts only queries that actually refetch, not those merely marked stale', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => usePositionList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 未挂载的详情缓存：失效整个域时它只应被标脏，不应产生 fetching
    qc.setQueryData(positionKeys.detail(999), { id: 999 });

    const fetches = observeFetches(qc);
    await qc.invalidateQueries({ queryKey: positionKeys.all });
    await waitFor(() => expect(fetches.count).toBeGreaterThan(0));

    expect(fetches.countOf(positionKeys.lists)).toBe(1);
    expect(fetches.countOf(positionKeys.detail(999))).toBe(0);
    // 这正是 `.all` 的真实语义：全部标脏，但只有活跃查询立刻回源
    expect(isInvalidated(qc, positionKeys.detail(999))).toBe(true);

    fetches.stop();
  });

  it('reports an inactive cache entry as fresh until something invalidates it', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => usePositionList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // 用未挂载的条目断言新鲜度：活跃查询被失效后会立即重拉，转瞬又回到 fresh
    qc.setQueryData(positionKeys.detail(999), { id: 999 });
    expect(isFresh(qc, positionKeys.detail(999))).toBe(true);

    await qc.invalidateQueries({ queryKey: positionKeys.all });
    expect(isFresh(qc, positionKeys.detail(999))).toBe(false);
  });
});

describe('ApiRecorder', () => {
  it('records每次调用并按注册的桩返回统一响应外壳', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(() => usePositionList(LIST_PARAMS), { wrapper: createWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.countOf('GET', '/api/positions')).toBe(1);
    expect(api.urls('GET')[0]).toContain('/api/positions');
  });

  it('rejects with a descriptive error when no stub matches, instead of silently resolving undefined', async () => {
    await expect(api.dispatch('GET', '/api/not-stubbed')).rejects.toThrow('未注册响应桩');
  });
});
