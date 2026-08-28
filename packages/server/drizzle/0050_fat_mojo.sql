ALTER TABLE "async_tasks" ADD COLUMN "parent_ref" varchar(32);--> statement-breakpoint
ALTER TABLE "workflow_jobs" ADD COLUMN "parent_ref" varchar(32);--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "parent_ref" varchar(32);