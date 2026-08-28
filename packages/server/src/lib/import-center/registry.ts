/**
 * 导入 Definition 注册表（与 export-center/registry 对偶）。
 */
import { HTTPException } from 'hono/http-exception';
import type { ImportEntityMeta } from '@zenith/shared/tasks';
import { hasPermission } from '../context';
import { DEFAULT_MAX_ROWS, type ImportDefinition } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const definitions = new Map<string, ImportDefinition<any, any>>();

export function registerImport<TRow, TPrepared>(def: ImportDefinition<TRow, TPrepared>): void {
  if (definitions.has(def.entity)) return; // 幂等：路由模块可能被重复加载
  definitions.set(def.entity, def);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getImportDefinition(entity: string): ImportDefinition<any, any> {
  const def = definitions.get(entity);
  if (!def) throw new HTTPException(400, { message: `未注册的导入实体：${entity}` });
  return def;
}

/** 当前用户有权限的可导入实体清单 */
export async function listImportEntities(): Promise<ImportEntityMeta[]> {
  const metas: ImportEntityMeta[] = [];
  for (const def of definitions.values()) {
    if (!(await hasPermission(def.permission))) continue;
    metas.push({
      entity: def.entity,
      title: def.title,
      module: def.module,
      description: def.description ?? null,
      maxRows: def.maxRows ?? DEFAULT_MAX_ROWS,
      columns: def.columns,
    });
  }
  return metas.sort((a, b) => a.module.localeCompare(b.module) || a.entity.localeCompare(b.entity));
}
