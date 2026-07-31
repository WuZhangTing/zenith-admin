/**
 * S0 度量基线 —— 记录收敛前 `xxxKeys.all` 的实际行为。
 *
 * 这些用例**不是**在validating正确性，而是把「现状」钉住，作为后续阶段的对照组：
 * 收敛后同一动作应减少无谓重拉，同时不得出现陈旧数据。
 *
 * 同时验证 harness 自身可用：能否精确捕获「进入 fetching」而非「被标脏」。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  isFresh,
  observeFetches,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import { positionKeys, useAllPositions, usePositionList, useSavePosition } from './positions';
import { cronJobKeys, useCronJobHandlers, useCronJobList, useRunCronJob } from './cron-jobs';

const LIST_PARAMS = { page: 1, pageSize: 10 };

beforeEach(() => {
  api.reset();
  api
    .on('GET', '/api/positions', { list: [{ id: 1, name: '工程师' }], total: 1, page: 1, pageSize: 10 })
    .on('GET', '/api/positions/all', [{ id: 1, name: '工程师' }])
    .on('PUT', /^\/api\/positions\/\d+$/, { id: 1, name: '高级工程师' })
    .on('GET', '/api/cron-jobs', { list: [{ id: 1, name: '对账' }], total: 1, page: 1, pageSize: 10 })
    .on('GET', '/api/cron-jobs/handlers', ['reconcile', 'cleanup'])
    .on('POST', /^\/api\/cron-jobs\/\d+\/run$/, null);
});

describe('S0 基线：positions 域 —— 保存岗位时 `.all` 的实际影响面', () => {
  it('records that saving a position also refetches the cross-page allPositions lookup', async () => {
    const qc = createTestQueryClient();
    const wrapper = createWrapper(qc);

    // 同时挂载列表与 lookup —— 对应 PositionsPage + UsersPage 都在使用的真实场景
    const { result } = renderHook(
      () => ({
        list: usePositionList(LIST_PARAMS),
        lookup: useAllPositions(),
        save: useSavePosition(),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.lookup.isSuccess).toBe(true);
    });

    const fetches = observeFetches(qc);
    api.resetCalls();

    await result.current.save.mutateAsync({ id: 1, values: { name: '高级工程师' } });
    await waitFor(() => expect(fetches.count).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));

    // 基线：列表与 lookup 都被重拉（lookup 本应 5 分钟才动一次）
    expect(fetches.countOf(positionKeys.lists)).toBe(1);
    expect(fetches.countOf(positionKeys.allPositions)).toBe(1);
    expect(api.countOf('GET', '/api/positions/all')).toBe(1);

    fetches.stop();
  });
});

describe('S0 基线：cron-jobs 域 —— 运行任务时 `.all` 的实际影响面', () => {
  it('records that running a job also refetches the always-active handlers lookup', async () => {
    const qc = createTestQueryClient();
    const wrapper = createWrapper(qc);

    // CronJobsPage 的真实挂载情况：list 与 handlers 都无 enabled 门控，长期活跃
    const { result } = renderHook(
      () => ({
        list: useCronJobList(LIST_PARAMS),
        handlers: useCronJobHandlers(),
        run: useRunCronJob(),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
      expect(result.current.handlers.isSuccess).toBe(true);
    });

    // handlers 是 LOOKUP_STALE_TIME(5min) 的静态 lookup，此刻理应新鲜
    expect(isFresh(qc, cronJobKeys.handlers)).toBe(true);

    const fetches = observeFetches(qc);
    api.resetCalls();

    await result.current.run.mutateAsync(1);
    await waitFor(() => expect(fetches.count).toBeGreaterThan(0));
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));

    // 基线：本该 5 分钟才动一次的 handlers，被一次「运行任务」直接打回源
    expect(fetches.countOf(cronJobKeys.handlers)).toBe(1);
    expect(api.countOf('GET', '/api/cron-jobs/handlers')).toBe(1);

    fetches.stop();
  });
});

describe('harness 自检', () => {
  it('counts only queries that actually refetch, not those merely marked stale', async () => {
    const qc = createTestQueryClient();
    const wrapper = createWrapper(qc);

    const { result } = renderHook(() => usePositionList(LIST_PARAMS), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const fetches = observeFetches(qc);

    // detail 从未被挂载：失效整个域时它只会被标脏，不应产生 fetching 事件
    await qc.invalidateQueries({ queryKey: positionKeys.all });
    await waitFor(() => expect(fetches.count).toBeGreaterThan(0));

    expect(fetches.countOf(positionKeys.lists)).toBe(1);
    expect(fetches.countOf(positionKeys.detail(999))).toBe(0);

    fetches.stop();
  });
});
