ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_department_id_departments_id_fk";
--> statement-breakpoint
ALTER TABLE "user_groups" ADD COLUMN "member_mode" varchar(10) DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_groups" ADD COLUMN "member_rule" jsonb;--> statement-breakpoint
ALTER TABLE "user_groups" ADD COLUMN "rule_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_groups" DROP COLUMN "department_id";