import { z } from 'zod';
import { EXPORT_JOB_FORMATS } from './types';

export const createExportJobSchema = z.object({
  entity: z.string().min(1, '导出实体不能为空').max(128),
  format: z.enum(EXPORT_JOB_FORMATS).default('xlsx'),
  query: z.record(z.string(), z.unknown()).optional().default({}),
  columns: z.array(z.string().min(1).max(128)).optional(),
  raw: z.boolean().optional().default(false),
  watermark: z.boolean().optional().default(true),
  executionMode: z.enum(['sync', 'async', 'auto']).optional().default('sync'),
});

/** 提交数据导入任务 */
export const submitImportJobSchema = z.object({
  entity: z.string().min(1).max(64),
  /** 文件中心 fileId（先经 /api/files/upload 上传） */
  fileId: z.string().min(8).max(64),
});

export type SubmitImportJobInput = z.infer<typeof submitImportJobSchema>;
