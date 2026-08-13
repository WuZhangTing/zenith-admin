CREATE TYPE "public"."monitor_alert_handle_status" AS ENUM('pending', 'acknowledged', 'closed');--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "handle_status" "monitor_alert_handle_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "handled_by" integer;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD COLUMN "handle_note" varchar(500);--> statement-breakpoint
ALTER TABLE "monitor_alert_events" ADD CONSTRAINT "monitor_alert_events_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitor_alert_events_handle_status_idx" ON "monitor_alert_events" USING btree ("handle_status");