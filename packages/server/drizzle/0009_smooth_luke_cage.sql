ALTER TABLE "ai_kb_chunks" DROP COLUMN "embedding";--> statement-breakpoint
-- 运行时物化列(旧自研 pgvector 路径):一并清理,向量迁移至 mastra schema 的 PgVector 索引
ALTER TABLE "ai_kb_chunks" DROP COLUMN IF EXISTS "embedding_vec";