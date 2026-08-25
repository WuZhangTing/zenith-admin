CREATE TYPE "public"."app_arch" AS ENUM('x64', 'arm64', 'universal');--> statement-breakpoint
CREATE TYPE "public"."app_artifact_kind" AS ENUM('installer', 'hotupdate', 'metadata', 'external');--> statement-breakpoint
CREATE TYPE "public"."app_platform" AS ENUM('windows', 'macos', 'linux', 'android', 'ios', 'web');--> statement-breakpoint
CREATE TYPE "public"."app_release_channel" AS ENUM('stable', 'beta', 'internal');--> statement-breakpoint
CREATE TYPE "public"."app_release_event_type" AS ENUM('check', 'download', 'install_success', 'install_fail');--> statement-breakpoint
CREATE TYPE "public"."app_release_status" AS ENUM('draft', 'published', 'revoked');--> statement-breakpoint
CREATE TABLE "app_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"platform" "app_platform" NOT NULL,
	"arch" "app_arch" DEFAULT 'x64' NOT NULL,
	"kind" "app_artifact_kind" DEFAULT 'installer' NOT NULL,
	"file_id" uuid,
	"external_url" varchar(500),
	"file_name" varchar(255) NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"sha256" varchar(64),
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_artifacts_release_filename_unique" UNIQUE("release_id","file_name")
);
--> statement-breakpoint
CREATE TABLE "app_release_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"release_id" integer,
	"artifact_id" integer,
	"event_type" "app_release_event_type" NOT NULL,
	"channel" "app_release_channel" DEFAULT 'stable' NOT NULL,
	"platform" "app_platform",
	"arch" "app_arch",
	"version" varchar(32),
	"device_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"channel" "app_release_channel" DEFAULT 'stable' NOT NULL,
	"version" varchar(32) NOT NULL,
	"notes" text,
	"status" "app_release_status" DEFAULT 'draft' NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"min_version" varchar(32),
	"rollout_percent" smallint DEFAULT 100 NOT NULL,
	"published_at" timestamp,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_releases_app_channel_version_unique" UNIQUE("app_id","channel","version")
);
--> statement-breakpoint
CREATE TABLE "client_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_key" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_apps_app_key_unique" UNIQUE("app_key")
);
--> statement-breakpoint
ALTER TABLE "app_artifacts" ADD CONSTRAINT "app_artifacts_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_artifacts" ADD CONSTRAINT "app_artifacts_file_id_managed_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."managed_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_artifacts" ADD CONSTRAINT "app_artifacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_artifacts" ADD CONSTRAINT "app_artifacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_release_events" ADD CONSTRAINT "app_release_events_app_id_client_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_release_events" ADD CONSTRAINT "app_release_events_release_id_app_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."app_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_release_events" ADD CONSTRAINT "app_release_events_artifact_id_app_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."app_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_app_id_client_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."client_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_apps" ADD CONSTRAINT "client_apps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_apps" ADD CONSTRAINT "client_apps_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_artifacts_release_idx" ON "app_artifacts" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "app_release_events_app_time_idx" ON "app_release_events" USING btree ("app_id","created_at");