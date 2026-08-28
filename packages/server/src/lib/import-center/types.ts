/**
 * 数据导入中心：Definition 契约。
 *
 * 与导出中心（lib/export-center）对偶的 registry 模式：每个可导入实体声明一个
 * Definition（模板列、行校验、落库逻辑），框架统一承担模板生成、表头校验、
 * 逐行解析、任务进度、行级错误报告与取消——业务域不再各写一套 exceljs 轮子。
 *
 * 执行载体是任务中心（taskType 'data-import'），零独立存储：
 * 进度/重试/取消/行级 items/幂等/链路追踪全部复用。
 */
import type { ImportColumnMeta } from '@zenith/shared/tasks';

export interface ImportDefinition<TRow = unknown, TPrepared = unknown> {
  /** 实体标识，如 'member.members'（提交与模板下载的路径参数） */
  entity: string;
  /** 实体名（导入中心卡片与任务标题） */
  title: string;
  module: string;
  /** 提交与模板下载所需权限 */
  permission: string;
  description?: string;
  /** 单文件最大数据行数，默认 10000 */
  maxRows?: number;
  columns: ImportColumnMeta[];
  /**
   * 一次性预载上下文：查重集合、外键编码 Map、策略配置等。
   * 在任务开始时调用一次，供 parseRow / insertRow 复用，避免逐行查库。
   */
  prepare(): Promise<TPrepared>;
  /**
   * 校验并归一一行。cells 为按 column.key 取的单元格文本（已 trim）。
   * 校验失败时抛 Error（message 记入该行的失败原因），不影响其他行。
   */
  parseRow(cells: Record<string, string>, prepared: TPrepared, rowNum: number): TRow | Promise<TRow>;
  /** 落库单行（内部可用事务）；抛错记为该行失败 */
  insertRow(row: TRow, prepared: TPrepared): Promise<void>;
  /** 行标签（行级报告的 label，默认取第一列的值） */
  rowLabel?(row: TRow): string;
  /** 全部行处理完后的收尾钩子（如动态组同步、缓存失效） */
  finalize?(prepared: TPrepared, stats: { succeeded: number; failed: number }): Promise<void>;
}

export const IMPORT_TASK_TYPE = 'data-import';

export const DEFAULT_MAX_ROWS = 10_000;

/** 上传文件大小上限（提交侧校验文件中心记录） */
export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
