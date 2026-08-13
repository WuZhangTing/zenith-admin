CREATE TYPE "public"."monitor_alert_notify_status" AS ENUM('skipped', 'success', 'partial', 'failed');--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "notify_status" "monitor_alert_notify_status" DEFAULT 'skipped' NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "notify_channels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "notify_error" text;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "monitor_alert_events_notify_status_idx" ON "monitor_alert_events" USING btree ("notify_status");--> statement-breakpoint
ALTER TABLE "monitor_alert_events" DROP COLUMN "notified";
