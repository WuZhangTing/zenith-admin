/**
 * 统一导入任务 handler（taskType 'data-import'）。
 *
 * 流程：文件中心取件 → 表头校验 → prepare 预载 → 逐行 parseRow/insertRow →
 * 行级 reportItems + 每 10 行进度/checkpoint（断点续跑）→ finalize。
 * 校验失败的行 skip 继续，全部行的成败明细在任务项列表中可查。
 */
import { registerTaskHandler } from '../task-center';
import { readFileContent } from '../../services/files/files.service';
import { getImportDefinition } from './registry';
import { parseImportWorkbook } from './parser';
import { DEFAULT_MAX_ROWS, IMPORT_TASK_TYPE } from './types';

export function registerImportTaskHandler(): void {
  registerTaskHandler({
    taskType: IMPORT_TASK_TYPE,
    title: '数据导入',
    module: '导入中心',
    allowConcurrent: false,
    maxAttempts: 1,
    async run(ctx) {
      const { entity, fileId } = ctx.payload as { entity?: string; fileId?: string };
      if (!entity || !fileId) throw new Error('缺少 entity / fileId 参数');
      const def = getImportDefinition(entity);

      const stored = await readFileContent(fileId);
      const buffer = await new Response(stored.stream).arrayBuffer();
      const rows = await parseImportWorkbook(buffer, def.columns, def.maxRows ?? DEFAULT_MAX_ROWS);
      if (rows.length === 0) throw new Error('文件中没有可导入的数据行');

      const prepared = await def.prepare();
      const firstKey = def.columns[0]?.key ?? '';

      let processed = Number(ctx.checkpoint?.processed ?? 0);
      let succeeded = Number(ctx.checkpoint?.succeeded ?? 0);
      let failed = Number(ctx.checkpoint?.failed ?? 0);

      for (let i = processed; i < rows.length; i++) {
        const { rowNum, cells } = rows[i];
        const fallbackLabel = cells[firstKey] || `第 ${rowNum} 行`;
        try {
          const row = await def.parseRow(cells, prepared, rowNum);
          await def.insertRow(row, prepared);
          succeeded += 1;
          await ctx.reportItems([{
            key: `row-${rowNum}`,
            label: (def.rowLabel?.(row) ?? fallbackLabel).slice(0, 100),
            status: 'success',
            message: null,
          }]);
        } catch (err) {
          failed += 1;
          await ctx.reportItems([{
            key: `row-${rowNum}`,
            label: fallbackLabel.slice(0, 100),
            status: 'failed',
            message: (err instanceof Error ? err.message : '导入失败').slice(0, 200),
          }]);
        }
        processed = i + 1;
        if (processed % 10 === 0 || processed === rows.length) {
          const { cancelRequested } = await ctx.progress({
            processed,
            total: rows.length,
            note: `成功 ${succeeded} / 失败 ${failed}（共 ${rows.length} 行）`,
            checkpoint: { processed, succeeded, failed },
          });
          if (cancelRequested) return { processed, succeeded, failed, cancelled: true };
        }
      }

      await def.finalize?.(prepared, { succeeded, failed });
      return { total: rows.length, succeeded, failed };
    },
  });
}
