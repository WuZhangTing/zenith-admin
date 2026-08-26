ALTER TABLE "push_send_logs" ADD COLUMN "delivery_status" varchar(32);--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "push_send_logs" ADD COLUMN "clicked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "push_send_logs_provider_msg_id_idx" ON "push_send_logs" USING btree ("provider_msg_id");