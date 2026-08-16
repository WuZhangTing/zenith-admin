ALTER TYPE "public"."workflow_instance_status" ADD VALUE 'returned' BEFORE 'approved';--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD COLUMN "sign_type" varchar(8);