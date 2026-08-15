import { eq, asc, and, or, like, inArray, type SQL } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { cmsModels, cmsModelFields, cmsChannels, cmsContents, dicts, dictItems } from '../../db/schema';
import type { CmsModelRow, CmsModelFieldRow } from '../../db/schema';
import type { DbExecutor } from '../../db/types';
import { formatDateTime } from '../../lib/datetime';
import { mergeWhere, escapeLike, withPagination } from '../../lib/where-helpers';
import { rethrowPgUniqueViolation } from '../../lib/db-errors';
import type { CreateCmsModelInput, UpdateCmsModelInput, CmsModelFieldInput } from '@zenith/shared/cms';

// ─── 数据映射 ─────────────────────────────────────────────────────────────────

/**
 * 批量解析字段的最终选项。
 *
 * 字典来源的字段在这里一次性查回所有引用到的字典项（按 dictCode 分组），
 * 避免逐字段查询造成 N+1；解析结果统一放进 `resolvedOptions`，
 * 前端表单只消费该字段，不必各自判断来源。
 */
export async function resolveCmsModelFieldOptions(
  rows: readonly CmsModelFieldRow[],
): Promise<Map<number, { label: string; value: string }[]>> {
  const resolved = new Map<number, { label: string; value: string }[]>();
  const dictCodes = [...new Set(rows
    .filter((r) => r.optionSource === 'dict' && r.dictCode?.trim())
    .map((r) => r.dictCode!.trim()))];

  const byCode = new Map<string, { label: string; value: string }[]>();
  if (dictCodes.length > 0) {
    const items = await db.select({
      code: dicts.code,
      label: dictItems.label,
      value: dictItems.value,
      sort: dictItems.sort,
      id: dictItems.id,
    })
      .from(dictItems)
      .innerJoin(dicts, eq(dictItems.dictId, dicts.id))
      .where(and(
        inArray(dicts.code, dictCodes),
        eq(dicts.status, 'enabled'),
        eq(dictItems.status, 'enabled'),
      ))
      .orderBy(asc(dictItems.sort), asc(dictItems.id));
    for (const item of items) {
      const list = byCode.get(item.code) ?? [];
      list.push({ label: item.label, value: item.value });
      byCode.set(item.code, list);
    }
  }

  for (const row of rows) {
    resolved.set(row.id, row.optionSource === 'dict'
      // 字典被删/停用时给空数组而不是回落手工选项：静默回落会让运营以为配置仍生效
      ? (byCode.get(row.dictCode?.trim() ?? '') ?? [])
      : (row.options ?? []));
  }
  return resolved;
}

export function mapCmsModelField(row: CmsModelFieldRow, resolvedOptions?: { label: string; value: string }[]) {
  return {
    id: row.id,
    modelId: row.modelId,
    name: row.name,
    label: row.label,
    fieldType: row.fieldType,
    required: row.required,
    searchable: row.searchable,
    showInList: row.showInList,
    showInDetail: row.showInDetail,
    detailGroup: row.detailGroup ?? null,
    detailSort: row.detailSort,
    placeholder: row.placeholder ?? null,
    defaultValue: row.defaultValue ?? null,
    optionSource: row.optionSource,
    dictCode: row.dictCode ?? null,
    options: row.options ?? null,
    ...(resolvedOptions ? { resolvedOptions } : {}),
    sort: row.sort,
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

/** 带选项解析的字段映射（前端动态表单入口统一走这里） */
export async function mapCmsModelFieldsResolved(rows: readonly CmsModelFieldRow[]) {
  const resolved = await resolveCmsModelFieldOptions(rows);
  return rows.map((row) => mapCmsModelField(row, resolved.get(row.id) ?? []));
}

export function mapCmsModel(row: CmsModelRow, fields?: CmsModelFieldRow[]) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description ?? null,
    isSystem: row.isSystem,
    status: row.status,
    sort: row.sort,
    ...(fields ? { fields: fields.map((field) => mapCmsModelField(field)) } : {}),
    createdAt: formatDateTime(row.createdAt),
    updatedAt: formatDateTime(row.updatedAt),
  };
}

// ─── 前置校验 ─────────────────────────────────────────────────────────────────
export async function ensureCmsModelExists(id: number): Promise<CmsModelRow> {
  const [row] = await db.select().from(cmsModels).where(eq(cmsModels.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: '内容模型不存在' });
  return row;
}

export async function getCmsModel(id: number) {
  const row = await db.query.cmsModels.findFirst({
    where: eq(cmsModels.id, id),
    with: { fields: { orderBy: [asc(cmsModelFields.sort), asc(cmsModelFields.id)] } },
  });
  if (!row) throw new HTTPException(404, { message: '内容模型不存在' });
  return { ...mapCmsModel(row), fields: await mapCmsModelFieldsResolved(row.fields) };
}

/** 获取模型的字段定义（内容编辑动态表单/检索索引用） */
export async function listCmsModelFields(modelId: number): Promise<CmsModelFieldRow[]> {
  return db.select().from(cmsModelFields)
    .where(eq(cmsModelFields.modelId, modelId))
    .orderBy(asc(cmsModelFields.sort), asc(cmsModelFields.id));
}

// ─── 列表 ─────────────────────────────────────────────────────────────────────
export interface ListCmsModelsQuery {
  keyword?: string;
  status?: 'enabled' | 'disabled';
  page: number;
  pageSize: number;
}

export async function listCmsModels(q: ListCmsModelsQuery) {
  const { keyword = '', status, page, pageSize } = q;
  const conditions: SQL[] = [];
  if (keyword) {
    const kw = or(
      like(cmsModels.name, `%${escapeLike(keyword)}%`),
      like(cmsModels.code, `%${escapeLike(keyword)}%`),
    );
    if (kw) conditions.push(kw);
  }
  if (status) conditions.push(eq(cmsModels.status, status));

  const where = mergeWhere(and(...conditions));
  const [total, rows] = await Promise.all([
    db.$count(cmsModels, where),
    withPagination(
      db.select().from(cmsModels).where(where).orderBy(asc(cmsModels.sort), asc(cmsModels.id)).$dynamic(),
      page,
      pageSize,
    ),
  ]);
  // 附带字段列表（模型数量有限，一次查回避免 N+1）
  const ids = rows.map((r) => r.id);
  const fields = ids.length > 0
    ? await db.select().from(cmsModelFields).where(inArray(cmsModelFields.modelId, ids)).orderBy(asc(cmsModelFields.sort), asc(cmsModelFields.id))
    : [];
  const fieldMap = new Map<number, CmsModelFieldRow[]>();
  for (const f of fields) {
    const arr = fieldMap.get(f.modelId) ?? [];
    arr.push(f);
    fieldMap.set(f.modelId, arr);
  }
  return { list: rows.map((r) => mapCmsModel(r, fieldMap.get(r.id) ?? [])), total, page, pageSize };
}

/** 全部启用模型（栏目绑定下拉用） */
/**
 * 全部启用模型（含字段与解析后的选项）。
 *
 * 内容编辑页的模型字段动态表单直接消费本接口的 `fields`，因此必须带字段；
 * 选项在此一次性解析（字典来源查库展开），前端无需二次请求。
 */
export async function listAllCmsModels() {
  const rows = await db.query.cmsModels.findMany({
    where: eq(cmsModels.status, 'enabled'),
    orderBy: [asc(cmsModels.sort), asc(cmsModels.id)],
    with: { fields: { orderBy: [asc(cmsModelFields.sort), asc(cmsModelFields.id)] } },
  });
  const allFields = rows.flatMap((row) => row.fields);
  const resolved = await resolveCmsModelFieldOptions(allFields);
  return rows.map((row) => ({
    ...mapCmsModel(row),
    fields: row.fields.map((field) => mapCmsModelField(field, resolved.get(field.id) ?? [])),
  }));
}

/** 先删后插，原子性替换模型字段（保留 id 不变的字段做 update，避免外部引用失效） */
async function replaceModelFields(executor: DbExecutor, modelId: number, fields: CmsModelFieldInput[]): Promise<void> {
  const names = fields.map((f) => f.name);
  if (new Set(names).size !== names.length) {
    throw new HTTPException(400, { message: '字段标识重复' });
  }
  await executor.delete(cmsModelFields).where(eq(cmsModelFields.modelId, modelId));
  if (fields.length > 0) {
    await executor.insert(cmsModelFields).values(fields.map((f, i) => ({
      modelId,
      name: f.name,
      label: f.label,
      fieldType: f.fieldType ?? 'text',
      required: f.required ?? false,
      searchable: f.searchable ?? false,
      showInList: f.showInList ?? false,
      showInDetail: f.showInDetail ?? false,
      detailGroup: f.detailGroup ?? null,
      detailSort: f.detailSort ?? 0,
      placeholder: f.placeholder ?? null,
      defaultValue: f.defaultValue ?? null,
      optionSource: f.optionSource ?? 'manual',
      // 手动来源时清空 dictCode，避免切换来源后残留脏引用
      dictCode: f.optionSource === 'dict' ? (f.dictCode ?? null) : null,
      options: f.options ?? null,
      sort: f.sort ?? i,
    })));
  }
}

// ─── 创建 ─────────────────────────────────────────────────────────────────────
export async function createCmsModel(data: CreateCmsModelInput) {
  const { fields = [], ...model } = data;
  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(cmsModels).values(model).returning();
      await replaceModelFields(tx, created.id, fields);
      return created;
    });
    return getCmsModel(row.id);
  } catch (err) {
    rethrowPgUniqueViolation(err, '模型标识已存在');
  }
}

// ─── 更新 ─────────────────────────────────────────────────────────────────────
export async function updateCmsModel(id: number, data: UpdateCmsModelInput) {
  const { fields, ...model } = data;
  try {
    await db.transaction(async (tx) => {
      if (Object.keys(model).length > 0) {
        const [updated] = await tx.update(cmsModels).set(model).where(eq(cmsModels.id, id)).returning();
        if (!updated) throw new HTTPException(404, { message: '内容模型不存在' });
      }
      if (fields) {
        await replaceModelFields(tx, id, fields);
      }
    });
    return getCmsModel(id);
  } catch (err) {
    rethrowPgUniqueViolation(err, '模型标识已存在');
  }
}

// ─── 删除 ─────────────────────────────────────────────────────────────────────
export async function deleteCmsModel(id: number) {
  const row = await ensureCmsModelExists(id);
  if (row.isSystem) throw new HTTPException(400, { message: '系统内置模型不可删除' });
  const [channelCount, contentCount] = await Promise.all([
    db.$count(cmsChannels, eq(cmsChannels.modelId, id)),
    db.$count(cmsContents, eq(cmsContents.modelId, id)),
  ]);
  if (channelCount > 0 || contentCount > 0) {
    throw new HTTPException(400, { message: '该模型已被栏目或内容引用，不可删除' });
  }
  await db.delete(cmsModels).where(eq(cmsModels.id, id));
}
