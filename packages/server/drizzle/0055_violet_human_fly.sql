CREATE TYPE "public"."replay_mode" AS ENUM('buffer', 'stream');--> statement-breakpoint
CREATE TYPE "public"."replay_status" AS ENUM('recording', 'completed', 'expired');--> statement-breakpoint
CREATE TABLE "replay_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"replay_id" varchar(36) NOT NULL,
	"seq" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"from_ts" timestamp with time zone NOT NULL,
	"to_ts" timestamp with time zone NOT NULL,
	"byte_size" integer NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"has_full_snapshot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replay_sessions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"session_id" varchar(36) NOT NULL,
	"mode" "replay_mode" NOT NULL,
	"status" "replay_status" DEFAULT 'recording' NOT NULL,
	"triggers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"segment_count" integer DEFAULT 0 NOT NULL,
	"total_bytes" bigint DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"page_count" integer DEFAULT 0 NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"entry_page_url" varchar(512),
	"source" "analytics_event_source" DEFAULT 'web_admin' NOT NULL,
	"app_id" varchar(64) DEFAULT 'admin' NOT NULL,
	"environment" varchar(32) DEFAULT 'production' NOT NULL,
	"user_id" integer,
	"username" varchar(64),
	"member_id" integer,
	"browser" varchar(48),
	"os" varchar(48),
	"device_type" "analytics_device_type",
	"sdk_version" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "track_replay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_session_sample_rate" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_on_error" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_mask_all_text" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_block_selector" varchar(256) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_settings" ADD COLUMN "replay_retention_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "error_events" ADD COLUMN "replay_id" varchar(36);--> statement-breakpoint
ALTER TABLE "replay_segments" ADD CONSTRAINT "replay_segments_replay_id_replay_sessions_id_fk" FOREIGN KEY ("replay_id") REFERENCES "public"."replay_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_sessions" ADD CONSTRAINT "replay_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_sessions" ADD CONSTRAINT "replay_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "replay_segments_replay_seq_uq" ON "replay_segments" USING btree ("replay_id","seq");--> statement-breakpoint
CREATE INDEX "replay_sessions_session_idx" ON "replay_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "replay_sessions_started_idx" ON "replay_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "replay_sessions_status_activity_idx" ON "replay_sessions" USING btree ("status","last_activity_at");--> statement-breakpoint
CREATE INDEX "replay_sessions_tenant_idx" ON "replay_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "replay_sessions_user_idx" ON "replay_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "replay_sessions_member_idx" ON "replay_sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "error_events_replay_idx" ON "error_events" USING btree ("replay_id");