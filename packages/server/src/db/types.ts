import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { toSnakeCase } from 'drizzle-orm/casing';
import type * as schema from './schema';

export type DbSchema = typeof schema;
export type Db = PostgresJsDatabase<DbSchema>;
/**
 * 从 db.transaction 回调参数反推事务类型，而非显式实例化
 * `PostgresJsTransaction<DbSchema, ExtractTablesWithRelations<DbSchema>>`——
 * 后者会强制展开全库 380+ 表的关系图，表数量增长后触发 TS2589（类型实例化过深）；
 * Parameters<> 提取保持惰性引用，语义等价且不受表规模影响。
 */
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbExecutor = Db | DbTransaction;

/**
 * 列在数据库中的真实名称。drizzle 配置 `casing: 'snake_case'` 后，未显式命名的列
 * 其 `column.name` 是 TS 属性名（camelCase），真实列名需按同一 casing 规则派生。
 * 任何做列名反射（schema 漂移对比、结构断言）的代码必须用本函数，禁止直接读 `column.name`。
 */
export function dbColumnName(column: { name: string; keyAsName: boolean }): string {
  return column.keyAsName ? toSnakeCase(column.name) : column.name;
}
