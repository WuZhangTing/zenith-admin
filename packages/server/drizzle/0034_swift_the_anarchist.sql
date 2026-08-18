ALTER TYPE "public"."oauth_provider" ADD VALUE 'feishu';--> statement-breakpoint
ALTER TYPE "public"."directory_sync_source_type" ADD VALUE 'wechat_work';--> statement-breakpoint
ALTER TYPE "public"."directory_sync_source_type" ADD VALUE 'feishu';--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "contact_secret" text;