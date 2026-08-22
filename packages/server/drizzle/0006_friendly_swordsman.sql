ALTER TABLE "workflow_delegations" ADD COLUMN "mode" varchar(16) DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD COLUMN "delegation_mode" varchar(16);