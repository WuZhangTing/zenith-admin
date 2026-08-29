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
    /** 导出行数绝对上限（sync/async 通用），超出时提交被拒绝 */
    maxRows: number;
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
  /** 链路 ID（= 提交请求的 X-Request-Id），可跳转链路追踪 */
  traceId?: string | null;
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
  /** 近 24 小时完成任务耗时分位（毫秒）；无数据为 null */
  duration: { p50: number | null; p95: number | null; max: number | null };
  /** 今日提交概览与昨日提交数（环比用） */
  today: { submitted: number; success: number; failed: number; yesterdaySubmitted: number };
  /** 近 14 天每日提交/成功/失败数（date: YYYY-MM-DD） */
  daily: Array<{ date: string; submitted: number; success: number; failed: number }>;
  /** 近 24 小时每小时提交/失败数（hour: YYYY-MM-DD HH:00，服务器时区） */
  hourly: Array<{ hour: string; submitted: number; failed: number }>;
  /** 已结束任务（成功 + 失败）中的成功占比；无已结束任务为 null */
  successRate: number | null;
  /** 等待执行的积压情况 */
  backlog: {
    pending: number;
    /** 最早一条待执行任务已等待的分钟数；无积压为 null */
    oldestPendingMinutes: number | null;
  };
  /** 发生过重试的任务数（attempts > 1） */
  retried: number;
  /** 重试后最终成功的任务数（自动重试挽回） */
  retriedRecovered: number;
  /** 行级处理量（全部任务 processedCount / failedCount 累计） */
  items: { processed: number; failed: number };
  /** 近 30 天提交人 Top 5（createdBy 为空的系统任务合并为「系统」） */
  topSubmitters: Array<{ userId: number | null; username: string; count: number; failed: number }>;
  /** 按任务类型聚合（按总数降序，仅含有记录的类型） */
  byType: AsyncTaskTypeStat[];
}

/** 单个任务类型的执行统计 */
export interface AsyncTaskTypeStat {
  taskType: string;
  /** 注册表中的展示名；类型已下线时回落为 taskType */
  title: string;
  /** 注册表中的归属模块；类型已下线时为 null */
  module: string | null;
  total: number;
  running: number;
  success: number;
  failed: number;
  /** 已结束任务中的成功占比；无已结束任务为 null */
  successRate: number | null;
  /** 成功任务的平均耗时（毫秒）；无数据为 null */
  avgDurationMs: number | null;
}

// ─── 数据导入中心 ─────────────────────────────────────────────────────────────
/** 导入模板列说明（模板生成与前端展示共用） */
export interface ImportColumnMeta {
  key: string;
  /** 表头文案（上传文件按它定位列） */
  header: string;
  required?: boolean;
  /** 示例值（模板示例行） */
  example?: string;
  /** 枚举可选值（模板做数据验证下拉） */
  enumValues?: string[];
  /** 补充说明（如格式要求） */
  note?: string;
}

/** 可导入实体元信息（按权限过滤后返回前端） */
export interface ImportEntityMeta {
  entity: string;
  title: string;
  module: string;
  description: string | null;
  /** 单文件最大数据行数 */
  maxRows: number;
  /** 是否需要页面上下文（如 CMS 内容的 siteId/channelId），需到业务页面发起导入 */
  requiresContext: boolean;
  columns: ImportColumnMeta[];
}
