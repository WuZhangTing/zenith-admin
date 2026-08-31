-- 新增 enum value 必须在独立事务提交后才能用于 partial index predicate。
-- 0004 先建立不含 unknown 的临时唯一索引，本迁移切换为完整状态集合。
DROP INDEX IF EXISTS "payment_contracts_member_renewal_active_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_contracts_active_biz_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_orders_active_biz_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "payment_preauths_active_biz_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "payment_contracts_member_renewal_active_uq" ON "payment_contracts" USING btree (coalesce("tenant_id", 0),"biz_type","biz_id","currency") WHERE "payment_contracts"."biz_type" = 'member_renewal' and "payment_contracts"."status" in ('pending', 'unknown', 'signed', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "payment_contracts_active_biz_uq" ON "payment_contracts" USING btree (coalesce("tenant_id", 0),"app_id","biz_type","biz_id","currency") WHERE "payment_contracts"."status" in ('pending', 'unknown', 'signed', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_active_biz_uq" ON "payment_orders" USING btree (coalesce("tenant_id", 0),coalesce("app_id", 0),"biz_type","biz_id","currency") WHERE "payment_orders"."status" in ('pending', 'paying', 'unknown');--> statement-breakpoint
CREATE UNIQUE INDEX "payment_preauths_active_biz_uq" ON "payment_preauths" USING btree (coalesce("tenant_id", 0),"app_id","biz_type","biz_id","currency") WHERE "payment_preauths"."status" in ('pending', 'unknown', 'frozen');
