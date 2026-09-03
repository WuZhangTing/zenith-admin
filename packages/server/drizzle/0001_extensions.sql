-- 手写 DDL：无法由 Drizzle schema 表达，`drizzle-kit generate` 不会重新生成它们，
-- 重建迁移基线时必须随基线一并保留（本文件为唯一收口，见 docs/backend/database.md「迁移目录」）。
-- 注：pg_trgm 扩展在 0000_baseline.sql 顶部创建（其索引已全部收进 schema DSL 随基线生成）。

-- ─── pgvector：Mastra PgVector 向量存储依赖（条件启用）──────────────────────────
-- 知识库向量由 Mastra PgVector 存放在 mastra schema（索引 kb_{kbId}），ai_kb_chunks 只存分块文本，
-- 业务表上没有任何 vector 列。扩展可用时在此预建，让全新库开箱即用；不可用时静默跳过——
-- Mastra 首次建索引时会再次 CREATE EXTENSION IF NOT EXISTS，届时才因缺扩展报错，其余功能不受影响。
-- 扩展创建与条件 DDL 均在 Drizzle 表达范围之外。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;
END $$;