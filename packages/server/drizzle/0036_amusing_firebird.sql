CREATE TYPE "public"."notification_channel" AS ENUM('inapp', 'email', 'sms', 'webhook', 'chat');--> statement-breakpoint
CREATE TYPE "public"."notification_decision" AS ENUM('sent', 'suppressed', 'deferred', 'deduped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_digest_mode" AS ENUM('realtime', 'hourly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."notification_outbox_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient_type" AS ENUM('user', 'member', 'external');--> statement-breakpoint
CREATE TABLE "notification_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"outbox_id" integer,
	"event_key" varchar(100) NOT NULL,
	"recipient_type" "notification_recipient_type" NOT NULL,
	"recipient_id" integer,
	"recipient_address" varchar(512),
	"channel" "notification_channel" NOT NULL,
	"decision" "notification_decision" NOT NULL,
	"reason_code" varchar(64),
	"reason_detail" text,
	"provider_msg_id" varchar(128),
	"dedupe_key" varchar(256),
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_event_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"event_key" varchar(100) NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_key" varchar(100) NOT NULL,
	"recipients" jsonb NOT NULL,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channel_policy" jsonb,
	"channel_options" jsonb,
	"link" varchar(512),
	"dedupe_key" varchar(192),
	"status" "notification_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(500),
	"claimed_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"trace_id" varchar(64),
	"tenant_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_type" "notification_recipient_type" NOT NULL,
	"recipient_id" integer NOT NULL,
	"event_key" varchar(100) NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_recipient_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_type" "notification_recipient_type" NOT NULL,
	"recipient_id" integer NOT NULL,
	"global_muted" boolean DEFAULT false NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Shanghai' NOT NULL,
	"quiet_start" varchar(5),
	"quiet_end" varchar(5),
	"digest_mode" "notification_digest_mode" DEFAULT 'realtime' NOT NULL,
	"digest_hour" smallint DEFAULT 9 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_outbox_id_notification_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."notification_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_dispatches" ADD CONSTRAINT "notification_dispatches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ADD CONSTRAINT "notification_event_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ADD CONSTRAINT "notification_event_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_event_overrides" ADD CONSTRAINT "notification_event_overrides_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_dispatches_dedupe_uq" ON "notification_dispatches" USING btree ("dedupe_key") WHERE "notification_dispatches"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notification_dispatches_recipient_idx" ON "notification_dispatches" USING btree ("recipient_type","recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_dispatches_event_idx" ON "notification_dispatches" USING btree ("event_key","created_at");--> statement-breakpoint
CREATE INDEX "notification_dispatches_outbox_idx" ON "notification_dispatches" USING btree ("outbox_id");--> statement-breakpoint
CREATE INDEX "notification_dispatches_decision_idx" ON "notification_dispatches" USING btree ("decision","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_event_overrides_tenant_uq" ON "notification_event_overrides" USING btree ("tenant_id","event_key","channel") WHERE "notification_event_overrides"."tenant_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_event_overrides_global_uq" ON "notification_event_overrides" USING btree ("event_key","channel") WHERE "notification_event_overrides"."tenant_id" is null;--> statement-breakpoint
CREATE INDEX "notification_event_overrides_event_idx" ON "notification_event_overrides" USING btree ("event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_dedupe_uq" ON "notification_outbox" USING btree ("dedupe_key") WHERE "notification_outbox"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notification_outbox_pending_idx" ON "notification_outbox" USING btree ("status","scheduled_at") WHERE "notification_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "notification_outbox_event_idx" ON "notification_outbox" USING btree ("event_key","created_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_tenant_idx" ON "notification_outbox" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_uq" ON "notification_preferences" USING btree ("recipient_type","recipient_id","event_key","channel");--> statement-breakpoint
CREATE INDEX "notification_preferences_recipient_idx" ON "notification_preferences" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_recipient_settings_uq" ON "notification_recipient_settings" USING btree ("recipient_type","recipient_id");