import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { WikiDoc, WikiOpsStats, WikiStatsOverview } from '@zenith/shared/wiki';
import {
  ApiRecorder,
  createRequestMock,
  createTestQueryClient,
  createWrapper,
  observeFetches,
} from '@/test-utils/query-harness';

const api = new ApiRecorder();
vi.mock('@/utils/request', () => ({ request: createRequestMock(() => api) }));

import {
  useMyProcessedReviews,
  useReviewWikiDoc,
  useSubmitWikiDoc,
  useWikiDocReviewRecords,
  wikiReviewRecordKeys,
} from './wiki-docs';
import { useWikiOpsStats, useWikiStatsOverview } from './wiki-stats';

const PROCESSED_PARAMS = { page: 1, pageSize: 10 };
const DOC: WikiDoc = {
  id: 1,
  spaceId: 1,
  parentId: null,
  title: '审核文档',
  summary: null,
  status: 'pending',
  rejectReason: null,
  sort: 0,
  isPinned: false,
  viewCount: 0,
  currentVersion: 1,
  revision: 1,
  requireReadReceipt: false,
  isArchived: false,
  createdAt: '2026-08-15 10:00:00',
  updatedAt: '2026-08-15 10:00:00',
};
const OVERVIEW: WikiStatsOverview = {
  spaceCount: 1,
  docCount: 1,
  publishedCount: 0,
  pendingCount: 1,
  commentCount: 0,
  weekNewDocs: 1,
  weekViews: 0,
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

beforeEach(() => {
  api.reset();
  api
    .on('GET', '/api/wiki/docs/1/review-records', [])
    .on('GET', '/api/wiki/docs/reviews/processed?page=1&pageSize=10', {
      list: [],
      total: 0,
      page: 1,
      pageSize: 10,
    })
    .on('GET', '/api/wiki/stats/overview', OVERVIEW)
    .on('GET', '/api/wiki/stats/ops', OPS)
    .on('POST', '/api/wiki/docs/1/review', { ...DOC, status: 'published' })
    .on('POST', '/api/wiki/docs/1/submit', DOC);
});

describe('知识中心审核缓存契约', () => {
  it('审核后同时刷新文档时间线与已处理列表', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        timeline: useWikiDocReviewRecords(1),
        processed: useMyProcessedReviews(PROCESSED_PARAMS),
        overview: useWikiStatsOverview(),
        ops: useWikiOpsStats(),
        review: useReviewWikiDoc(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.timeline.isSuccess).toBe(true);
      expect(result.current.processed.isSuccess).toBe(true);
      expect(result.current.overview.isSuccess).toBe(true);
      expect(result.current.ops.isSuccess).toBe(true);
    });

    const fetches = observeFetches(qc);
    api.resetCalls();
    await result.current.review.mutateAsync({ id: 1, action: 'approve' });
    await waitFor(() => expect(fetches.countOf(wikiReviewRecordKeys.processedLists)).toBe(1));

    expect(fetches.countOf(wikiReviewRecordKeys.of(1))).toBe(1);
    expect(api.countOf('GET', '/api/wiki/docs/1/review-records')).toBe(1);
    expect(api.countOf('GET', '/api/wiki/docs/reviews/processed?page=1&pageSize=10')).toBe(1);
    expect(api.countOf('GET', '/api/wiki/stats/overview')).toBe(1);
    expect(api.countOf('GET', '/api/wiki/stats/ops')).toBe(1);
    fetches.stop();
  });

  it('提交只刷新该文档时间线，不刷新与之无关的已处理列表', async () => {
    const qc = createTestQueryClient();
    const { result } = renderHook(
      () => ({
        timeline: useWikiDocReviewRecords(1),
        processed: useMyProcessedReviews(PROCESSED_PARAMS),
        overview: useWikiStatsOverview(),
        ops: useWikiOpsStats(),
        submit: useSubmitWikiDoc(),
      }),
      { wrapper: createWrapper(qc) },
    );
    await waitFor(() => {
      expect(result.current.timeline.isSuccess).toBe(true);
      expect(result.current.processed.isSuccess).toBe(true);
      expect(result.current.overview.isSuccess).toBe(true);
      expect(result.current.ops.isSuccess).toBe(true);
    });

    const fetches = observeFetches(qc);
    api.resetCalls();
    await result.current.submit.mutateAsync(1);
    await waitFor(() => expect(fetches.countOf(wikiReviewRecordKeys.of(1))).toBe(1));

    expect(fetches.countOf(wikiReviewRecordKeys.processedLists)).toBe(0);
    expect(api.countOf('GET', '/api/wiki/docs/reviews/processed?page=1&pageSize=10')).toBe(0);
    expect(api.countOf('GET', '/api/wiki/stats/overview')).toBe(1);
    expect(api.countOf('GET', '/api/wiki/stats/ops')).toBe(1);
    fetches.stop();
  });
});
