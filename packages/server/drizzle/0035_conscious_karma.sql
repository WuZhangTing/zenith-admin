ALTER TYPE "public"."directory_sync_source_type" ADD VALUE 'scim';--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "callback_token" text;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "callback_aes_key" text;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "callback_url_key" varchar(64);--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "pending_callback_sync" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD COLUMN "callback_last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD CONSTRAINT "directory_sync_sources_callback_key_unique" UNIQUE("callback_url_key");