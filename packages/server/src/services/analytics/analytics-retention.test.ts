import { beforeEach, describe, expect, it, vi } from 'vitest';

const { select, selectDistinct, deleteFrom, deleteWhere } = vi.hoisted(() => ({
  select: vi.fn(),
  selectDistinct: vi.fn(),
  deleteFrom: vi.fn(),
  deleteWhere: vi.fn(async () => ({ rowCount: 1 })),
}));

vi.mock('../../db', () => ({
  db: {
    select,
    selectDistinct,
    delete: deleteFrom,
  },
}));

import { runAnalyticsRetention } from './analytics-rollup.service';

describe('analytics retention isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue({
      from: vi.fn(async () => [
        { tenantId: 11, eventDays: 30, errorDays: 7 },
        { tenantId: 22, eventDays: 365, errorDays: 180 },
      ]),
    });
    selectDistinct.mockReturnValue({
      from: vi.fn(async () => [{ tenantId: 11 }, { tenantId: 22 }]),
    });
    deleteFrom.mockReturnValue({ where: deleteWhere });
  });

  it('executes independent cleanup statements for every tenant policy', async () => {
    await expect(runAnalyticsRetention()).resolves.toEqual({
      events: 2,
      sessions: 2,
      errors: 2,
      qualityDaily: 2,
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(selectDistinct).toHaveBeenCalledTimes(4);
    // 每租户 5 条 DELETE：events / sessions / error_events / quality_daily / error_groups
    expect(deleteFrom).toHaveBeenCalledTimes(10);
    expect(deleteWhere).toHaveBeenCalledTimes(10);
  });

  // 质量日聚合随事件采集持续写入，漏掉它会让该表无限增长（本次修复前即如此）
  it('includes analytics_event_quality_daily in the retention sweep', async () => {
    const result = await runAnalyticsRetention();
    expect(result.qualityDaily).toBe(2);
  });
});
