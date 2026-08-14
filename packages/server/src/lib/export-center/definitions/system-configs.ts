import { desc } from 'drizzle-orm';
import { db } from '../../../db';
import { systemConfigs } from '../../../db/schema';
import { currentUser } from '../../context';
import { tenantCondition } from '../../tenant';
import { defineExport } from '../registry';
import type { ExportColumn } from '../types';

const columns: ExportColumn[] = [
  { key: 'id', header: 'ID', width: 8, type: 'number' },
  { key: 'configKey', header: '配置键', width: 30 },
  { key: 'configName', header: '配置名称', width: 24 },
  { key: 'configValue', header: '配置值', width: 40 },
  { key: 'configType', header: '类型', width: 10 },
  { key: 'description', header: '描述', width: 30 },
];

export const systemConfigsExportDefinition = defineExport({
  entity: 'system.configs',
  moduleName: '系统配置',
  filenamePrefix: '系统配置',
  sourcePath: '/system/configs',
  sheetName: '系统配置',
  permissions: { export: 'system:config:list' },
  execution: { mode: 'sync', syncModeOverridesAsyncPolicies: true },
  retention: { normalDays: 7, sensitiveDays: 7, rawDays: 7 },
  columns,
  countRows: async () => db.$count(systemConfigs, tenantCondition(systemConfigs, currentUser())),
  streamRows: async () =>
    db.select().from(systemConfigs).where(tenantCondition(systemConfigs, currentUser())).orderBy(desc(systemConfigs.id)),
});
