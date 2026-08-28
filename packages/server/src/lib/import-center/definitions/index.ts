/**
 * 导入 Definition 聚合注册（由 routes/tasks/import-jobs.ts 顶层调用，与导出中心同款模式）。
 */
import { registerImportTaskHandler } from '../handler';
import { registerMembersImport } from './members';
import { registerUsersImport } from './users';
import { registerIotDevicesImport } from './iot-devices';
import { registerDictItemsImport } from './dict-items';
import { registerCmsContentsImport } from './cms-contents';

export function registerImportDefinitions(): void {
  registerImportTaskHandler();
  registerMembersImport();
  registerUsersImport();
  registerIotDevicesImport();
  registerDictItemsImport();
  registerCmsContentsImport();
}
