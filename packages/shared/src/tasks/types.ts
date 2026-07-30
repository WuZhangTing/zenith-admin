import type { ExportColumnMeta } from '../chat/types';

// ─── Export Center ───────────────────────────────────────────────────────

export const EXPORT_JOB_FORMATS = ['xlsx', 'csv', 'pdf', 'docx'] as const;

export type ExportJobFormat = typeof EXPORT_JOB_FORMATS[number];

export type ExportJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'expired';

export type ExportJobExecutionMode = 'sync' | 'async';

export type ExportJobRequestMode = 'sync' | 'async' | 'auto';

export type ExportJobDeleteReason = 'expired' | 'manual' | 'file_missing';

export interface ExportEntityMeta {
  entity: string;
  moduleName: string;
  filenamePrefix: string;
  sourcePath?: string;
  formats: ExportJobFormat[];
  renderMode: 'table' | 'layout' | 'custom';
  columns: ExportColumnMeta[];
  sensitive: boolean;
  execution: {
    mode: ExportJobRequestMode;
    syncMaxRows: number;
    forceAsyncWhenSensitive: boolean;
    forceAsyncWhenRaw: boolean;
    syncModeOverridesAsyncPolicies: boolean;
  };
  permissions: {
    export: string;
    exportRaw?: string;
    requireExportRawPermission?: boolean;
  };
}

export interface ExportJob {
  id: number;
  entity: string;
  moduleName: string;
  format: ExportJobFormat;
  status: ExportJobStatus;
  executionMode: ExportJobExecutionMode;
  query: Record<string, unknown>;
  columns: string[] | null;
  rowCount: number | null;
  fileId: string | null;
  filename: string | null;
  fileSize: number | null;
  raw: boolean;
  masked: boolean;
  sensitive: boolean;
  watermark: boolean;
  errorMessage: string | null;
  expiresAt: string | null;
  fileDeletedAt: string | null;
  deleteReason: ExportJobDeleteReason | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
  tenantId: number | null;
  createdBy: number | null;
  createdByName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportJobCreateResult {
  mode: ExportJobExecutionMode;
  job: ExportJob;
}

export interface ExportJobDownload {
  id: number;
  jobId: number;
  downloadedBy: number | null;
  downloadedByName: string | null;
  tenantId: number | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ─── WebSocket 消息类型 ──────────────────────────────────────────────────────
// ─── 任务中心（通用异步任务）────────────────────────────────────────────
export type AsyncTaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface AsyncTask {
  id: number;
  taskType: string;
  title: string;
  module: string | null;
  status: AsyncTaskStatus;
  payload: Record<string, unknown>;
  /** 总量；不可枚举的任务为 null（前端显示不定进度条） */
  totalCount: number | null;
  processedCount: number;
  failedCount: number;
  progressNote: string | null;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  cancelRequested: boolean;
  attempts: number;
  /** 最大执行次数（提交时从类型策略快照；失败自动重试直到用尽） */
  maxAttempts: number;
  /** 下次自动重试时间（退避中）；null = 无待定重试 */
  nextRunAt: string | null;
  createdBy: number | null;
  createdByName: string | null;
  tenantId: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 任务类型元信息（注册默认值 + 运行时策略合并后的生效值） */
export interface AsyncTaskTypeMeta {
  taskType: string;
  title: string;
  module: string;
  description: string | null;
  /** false：同一用户存在未结束任务时禁止重复提交 */
  allowConcurrent: boolean;
  /** false：暂停新提交 */
  enabled: boolean;
  maxAttempts: number;
  /** 重试退避基数（毫秒），实际延迟 = retryDelayMs * 2^(attempts-1) */
  retryDelayMs: number;
  /** 已结束任务保留天数；null = 跟随全局 */
  retentionDays: number | null;
}

export type AsyncTaskItemStatus = 'pending' | 'success' | 'failed' | 'skipped';

/** 任务项明细（行级处理状态） */
export interface AsyncTaskItem {
  id: number;
  taskId: number;
  itemKey: string;
  label: string | null;
  status: AsyncTaskItemStatus;
  message: string | null;
  data: Record<string, unknown> | null;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

/** 任务中心统计概览 */
export interface AsyncTaskStats {
  total: number;
  pending: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  /** 近 24 小时完成任务平均耗时（毫秒）；无数据为 null */
  avgDurationMs: number | null;
  /** 近 7 天每日提交/失败数（date: YYYY-MM-DD） */
  daily: Array<{ date: string; submitted: number; failed: number }>;
}
