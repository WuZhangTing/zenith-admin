ALTER TYPE "public"."monitor_metric" ADD VALUE 'replayStorageMb';--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_storage_quota_mb" integer DEFAULT 4096 NOT NULL;