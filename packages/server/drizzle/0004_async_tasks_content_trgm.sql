-- ─── pg_trgm：任务中心 payload / result 内容检索 ────────────────────────────────
-- jsonb 列的子串检索需先转 text；「表达式 + gin_trgm_ops 操作符类」超出 Drizzle
-- 索引 DSL 的表达范围，故照 0001_extensions.sql 先例手写（扩展已启用）。
CREATE INDEX IF NOT EXISTS "async_tasks_payload_trgm_idx" ON "async_tasks" USING gin ((payload::text) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "async_tasks_result_trgm_idx" ON "async_tasks" USING gin ((result::text) gin_trgm_ops);
