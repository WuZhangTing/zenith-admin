import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { WikiDoc, WikiOpsStats, WikiSettings } from '@zenith/shared/wiki';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import { useWikiDocDetail } from './wiki-docs';
import { useSetGovernanceReview, useWikiGovernanceDocs } from './wiki-governance';
import { useUpdateWikiSettings, useWikiOpsStats, useWikiSettings } from './wiki-stats';

const SETTINGS: WikiSettings = {
  requireApproval: true,
  defaultVisibility: 'public',
  aiSyncEnabled: false,
  aiSyncKbId: null,
  commentsEnabled: true,
  recycleRetentionDays: 30,
  pendingRemindHours: 48,
};
const SAVED_SETTINGS: WikiSettings = {
  ...SETTINGS,
  commentsEnabled: false,
  pendingRemindHours: 24,
};
const DOC: WikiDoc = {
  id: 1,
  spaceId: 1,
  parentId: null,
  title: '治理文档',
  summary: null,
  status: 'published',
  rejectReason: null,
  sort: 0,
  isPinned: false,
  viewCount: 0,
  currentVersion: 1,
  revision: 1,
  requireReadReceipt: false,
  commentsEnabled: true,
  isArchived: false,
  createdAt: '2026-08-15 10:00:00',
  updatedAt: '2026-08-15 10:00:00',
};
const OPS: WikiOpsStats = {
  createdTrend: [],
  spaceDistribution: [],
  searchCount30d: 0,
  noResultCount30d: 0,
  approvedCount30d: 0,
  rejectedCount30d: 0,
  pendingBacklog: 0,
  expiredCount: 0,
  reviewDueCount: 0,
  noOwnerCount: 0,
  archivedCount: 0,
};
const GOVERNANCE_PATH = '/api/wiki/governance/docs?page=1&pageSize=10&kind=review-backlog';

beforeEach(() => {
  api.reset();
  api
    .on('GET', '/api/wiki/settings', SETTINGS)
    .on('PUT', '/api/wiki/settings', SAVED_SETTINGS)
    .on('GET', '/api/wiki/docs/1', DOC)
    .on('GET', '/api/wiki/stats/ops', OPS)
    .on('GET', GOVERNANCE_PATH, { list: [], total: 0, page: 1, pageSize: 10 })
    .on('POST', '/api/wiki/governance/review-cycle', null);
});

describe('知识中心治理缓存契约', () => {
  it('设置里的评论开关与审核积压阈值变化后刷新所有真实消费者', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        settings: useWikiSettings(),
        detail: useWikiDocDetail(1),
        ops: useWikiOpsStats(),
        backlog: useWikiGovernanceDocs('review-backlog', { page: 1, pageSize: 10 }),
        update: useUpdateWikiSettings(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.settings.isSuccess).toBe(true);
      expect(result.current.detail.isSuccess).toBe(true);
      expect(result.current.ops.isSuccess).toBe(true);
      expect(result.current.backlog.isSuccess).toBe(true);
    });

    api.resetCalls();
    await result.current.update.mutateAsync(SAVED_SETTINGS);
    await waitFor(() => expect(api.countOf('GET', GOVERNANCE_PATH)).toBe(1));

    expect(api.countOf('GET', '/api/wiki/docs/1')).toBe(1);
    expect(api.countOf('GET', '/api/wiki/stats/ops')).toBe(1);
  });

  it('设置或取消复审后同步刷新治理清单与运营统计', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        ops: useWikiOpsStats(),
        backlog: useWikiGovernanceDocs('review-backlog', { page: 1, pageSize: 10 }),
        review: useSetGovernanceReview(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.ops.isSuccess).toBe(true);
      expect(result.current.backlog.isSuccess).toBe(true);
    });

    api.resetCalls();
    await result.current.review.mutateAsync({ ids: [1], reviewCycleDays: null, expireAt: null });
    await waitFor(() => expect(api.countOf('GET', GOVERNANCE_PATH)).toBe(1));

    expect(api.countOf('GET', '/api/wiki/stats/ops')).toBe(1);
  });
});
