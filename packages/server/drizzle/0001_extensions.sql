-- 手写 DDL：无法由 Drizzle schema 表达，`drizzle-kit generate` 不会重新生成它们，
-- 重建迁移基线时必须随基线一并保留（详见 docs/ai-platform/knowledge.md）。

-- ─── pg_trgm：CMS 标题模糊检索 ────────────────────────────────────────────────
-- gin_trgm_ops 操作符类不在 Drizzle 索引 DSL 的表达范围内，故手写。
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cms_contents_title_trgm_idx" ON "cms_contents" USING gin ("title" gin_trgm_ops);--> statement-breakpoint

-- ─── pgvector：知识库向量检索加速（条件启用）────────────────────────────────
-- 扩展可用时创建 ai_kb_chunks.embedding_vec（无维度 vector 列，兼容任意 embedding 模型），
-- 不可用时静默跳过；运行时由 ai-knowledge.service.ts 的 hasPgVector() 探测，
-- 不可用则回退 JS 余弦相似度。该列不进入 Drizzle schema，读写走原生 SQL。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    ALTER TABLE "ai_kb_chunks" ADD COLUMN IF NOT EXISTS "embedding_vec" vector;
  END IF;
END $$;
