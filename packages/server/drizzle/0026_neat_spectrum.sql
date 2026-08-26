DROP INDEX "rule_executions_instance_idx";--> statement-breakpoint
ALTER TABLE "rule_executions" DROP COLUMN "instance_id";--> statement-breakpoint
ALTER TABLE "rule_executions" DROP COLUMN "node_key";