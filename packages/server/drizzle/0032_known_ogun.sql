ALTER TABLE "open_api_call_logs" ADD COLUMN "auth_channel" varchar(16);--> statement-breakpoint
ALTER TABLE "open_api_call_logs" ADD COLUMN "user_id" integer;