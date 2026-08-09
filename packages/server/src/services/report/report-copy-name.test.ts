import { describe, expect, it } from 'vitest';
import { buildReportCopyName } from './report-copy-name';

describe('buildReportCopyName', () => {
  it('uses a direct copy suffix when available', () => {
    expect(buildReportCopyName('销售看板', new Set())).toBe('销售看板 副本');
  });

  it('increments copy names case-insensitively', () => {
    expect(buildReportCopyName(
      '销售看板',
      new Set(['销售看板 副本', '销售看板 副本 2']),
    )).toBe('销售看板 副本 3');
  });
});
