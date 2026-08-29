import { describe, expect, it } from 'vitest';
import type { JwtPayload } from '../../middleware/auth';
import { DEFAULT_EXPORT_EXECUTION, type AnyExportDefinition, type ExportRuntimeContext } from './types';
import { renderExportCsv, renderExportWorkbook } from './writer';

const definition = {
  entity: 'test.rows',
  moduleName: '测试导出',
  filenamePrefix: '测试导出',
  renderMode: 'table',
  permissions: { export: 'test:export' },
  columns: [
    { key: 'id', header: 'ID', type: 'number' as const },
    { key: 'name', header: '名称' },
  ],
  countRows: async () => 0,
  streamRows: async () => [],
} as unknown as AnyExportDefinition;

const user: JwtPayload = { userId: 1, username: 'tester', roles: [], tenantId: null };

function ctx(format: 'xlsx' | 'csv', rowLimit: number | null): ExportRuntimeContext {
  return {
    jobId: 1,
    entity: definition.entity,
    moduleName: definition.moduleName,
    format,
    query: {},
    selectedColumns: null,
    raw: true,
    masked: false,
    sensitive: false,
    watermark: false,
    currentUser: user,
    createdByName: null,
    exportedAt: new Date('2026-08-29T10:00:00.000Z'),
    maskRules: null,
    rowLimit,
  };
}

async function* rowsOf(count: number): AsyncGenerator<Record<string, unknown>> {
  for (let i = 1; i <= count; i++) yield { id: i, name: `row-${i}` };
}

describe('导出行数兜底上限（ExportRuntimeContext.rowLimit）', () => {
  it('默认执行策略带 50000 行绝对上限', () => {
    expect(DEFAULT_EXPORT_EXECUTION.maxRows).toBe(50_000);
  });

  it('xlsx：行数超过 rowLimit 时中止渲染', async () => {
    await expect(renderExportWorkbook(definition, rowsOf(6), ctx('xlsx', 5)))
      .rejects.toThrow('导出行数超过上限 5 行');
  });

  it('xlsx：行数在上限内正常产出文件', async () => {
    const buffer = await renderExportWorkbook(definition, rowsOf(3), ctx('xlsx', 5));
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('csv：行数超过 rowLimit 时中止渲染', async () => {
    await expect(renderExportCsv(definition, rowsOf(6), ctx('csv', 5)))
      .rejects.toThrow('导出行数超过上限 5 行');
  });

  it('csv：行数在上限内正常产出且包含全部数据行', async () => {
    const buffer = await renderExportCsv(definition, rowsOf(3), ctx('csv', 5));
    const text = buffer.toString('utf-8');
    expect(text).toContain('row-1');
    expect(text).toContain('row-3');
  });

  it('rowLimit 为 null 时不限制（同步小导出路径不受影响）', async () => {
    const buffer = await renderExportCsv(definition, rowsOf(8), ctx('csv', null));
    expect(buffer.toString('utf-8')).toContain('row-8');
  });
});
