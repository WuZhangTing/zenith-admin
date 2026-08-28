/**
 * 导入任务提交与模板下载（导入中心统一入口）。
 * 历史列表复用任务中心（taskType 'data-import'），无独立存储。
 */
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { managedFiles } from '../../db/schema';
import { hasPermission } from '../../lib/context';
import { submitAsyncTask } from '../../lib/task-center';
import { getImportDefinition } from '../../lib/import-center/registry';
import { buildImportTemplate } from '../../lib/import-center/template';
import { IMPORT_MAX_FILE_BYTES, IMPORT_TASK_TYPE } from '../../lib/import-center/types';

export { listImportEntities } from '../../lib/import-center/registry';

async function ensureImportPermission(entity: string) {
  const def = getImportDefinition(entity);
  if (!(await hasPermission(def.permission))) {
    throw new HTTPException(403, { message: '权限不足' });
  }
  return def;
}

export async function getImportTemplate(entity: string) {
  const def = await ensureImportPermission(entity);
  const buffer = await buildImportTemplate(def.title, def.columns);
  return { buffer, filename: `${def.title}导入模板.xlsx` };
}

export async function submitImportJob(entity: string, fileId: string) {
  const def = await ensureImportPermission(entity);
  const [file] = await db.select({ id: managedFiles.id, size: managedFiles.size, originalName: managedFiles.originalName })
    .from(managedFiles).where(eq(managedFiles.id, fileId)).limit(1);
  if (!file) throw new HTTPException(400, { message: '文件不存在，请重新上传' });
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    throw new HTTPException(400, { message: `文件超过 ${Math.round(IMPORT_MAX_FILE_BYTES / 1024 / 1024)}MB 上限` });
  }
  return submitAsyncTask({
    taskType: IMPORT_TASK_TYPE,
    title: `${def.title}导入（${file.originalName ?? fileId}）`,
    payload: { entity, fileId },
    // 同一文件对同一实体只跑一次；换文件重新上传即产生新 fileId
    idempotencyKey: `${entity}:${fileId}`,
  });
}
