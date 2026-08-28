/**
 * 导入 Definition 聚合注册（由 routes/tasks/import-jobs.ts 顶层调用，与导出中心同款模式）。
 */
import { registerImportTaskHandler } from '../handler';
import { registerMembersImport } from './members';

export function registerImportDefinitions(): void {
  registerImportTaskHandler();
  registerMembersImport();
}
