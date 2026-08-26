ALTER TABLE "rule_executions" ADD COLUMN "biz_ref" varchar(128);--> statement-breakpoint
CREATE INDEX "rule_executions_biz_ref_idx" ON "rule_executions" USING btree ("biz_ref");