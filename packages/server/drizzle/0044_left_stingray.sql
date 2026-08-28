ALTER TABLE "iot_automations" ADD COLUMN "decision_rule_key" varchar(64);--> statement-breakpoint
ALTER TABLE "iot_automations" DROP COLUMN "decision_table_id";