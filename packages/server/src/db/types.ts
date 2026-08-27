import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
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
