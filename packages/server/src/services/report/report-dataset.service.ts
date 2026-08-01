/**
 * 报表数据集 Service
 * CRUD + 取数执行（preview 试跑 / data 取数）。
 * - sql：只读事务（READ ONLY + statement_timeout + 行上限）+ ${param} 绑定参数（防注入）。
 * - api：统一走 http-client 的 httpRequest（防 SSRF），按 itemsPath 提取数组，运行时参数注入。
 */
// 已按职责拆分为同目录 report-dataset-* 子模块，本文件仅作 facade 统一 re-export，
// 对外导出符号与拆分前完全一致。
export type { DatasetExecutionContext, DatasetExecutionResult } from './report-dataset-shared';
export { getReportRuntimeGovernance } from './report-dataset-shared';
export {
  resolveDatasetParams,
  buildSystemParams,
  buildExternalParamSql,
  resolveEffectiveRowRules,
  applyRowRulesToSql,
} from './report-dataset-params';
export {
  mapDataset,
  ensureDatasetExists,
  assertDatasetEvaluableGlobally,
  getDataset,
  listDatasets,
  listDatasetLookup,
  batchSetDatasetStatus,
  cloneDataset,
  createDataset,
  updateDataset,
  collectDatasetRefs,
  deleteDataset,
} from './report-dataset-crud.service';
export {
  runReportData,
  previewDataset,
  executeGovernedReportSql,
  clearDatasetCache,
  getDatasetDataExecution,
  getDatasetData,
} from './report-dataset-execution.service';
export {
  listDatasetExecutionLogs,
  getDatasetExecutionStats,
} from './report-dataset-execution-logs.service';
export {
  refreshMaterialization,
  dispatchDueMaterializations,
} from './report-dataset-refresh.service';
