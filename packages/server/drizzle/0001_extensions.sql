-- 手写 DDL：无法由 Drizzle schema 表达，`drizzle-kit generate` 不会重新生成它们，
-- 重建迁移基线时必须随基线一并保留（本文件为唯一收口，见 docs/backend/database.md「迁移目录」）。
-- 注：pg_trgm 扩展在 0000_baseline.sql 顶部创建（其索引已全部收进 schema DSL 随基线生成）。

-- ─── pgvector：知识库向量检索加速（条件启用）────────────────────────────────
-- 扩展可用时创建 ai_kb_chunks.embedding_vec（无维度 vector 列，兼容任意 embedding 模型），
-- 不可用时静默跳过；运行时由 ai-knowledge.service.ts 的 hasPgVector() 探测，
-- 不可用则回退 JS 余弦相似度。条件 DDL、扩展创建与无维度 vector 列均在 Drizzle
-- 表达范围之外，且该列**刻意**不进 Drizzle schema——无 pgvector 的部署必须照常工作。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    ALTER TABLE "ai_kb_chunks" ADD COLUMN IF NOT EXISTS "embedding_vec" vector;
  END IF;
END $$;