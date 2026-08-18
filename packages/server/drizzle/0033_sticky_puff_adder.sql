CREATE TYPE "public"."directory_sync_conflict_status" AS ENUM('pending', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."directory_sync_run_status" AS ENUM('running', 'success', 'partial', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."directory_sync_source_type" AS ENUM('ldap', 'dingtalk');--> statement-breakpoint
CREATE TABLE "directory_sync_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"run_id" integer,
	"entity_type" varchar(16) NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"name" varchar(128),
	"conflict_type" varchar(32) NOT NULL,
	"source_data" jsonb,
	"local_data" jsonb,
	"candidate_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "directory_sync_conflict_status" DEFAULT 'pending' NOT NULL,
	"resolution" varchar(16),
	"resolved_by" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_sync_dept_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"department_id" integer NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "directory_sync_dept_links_source_external_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "directory_sync_run_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"entity_type" varchar(16) NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"name" varchar(128),
	"action" varchar(16) NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"diff" jsonb,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"trigger_type" varchar(16) DEFAULT 'manual' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"status" "directory_sync_run_status" DEFAULT 'running' NOT NULL,
	"total_fetched" integer DEFAULT 0 NOT NULL,
	"dept_created" integer DEFAULT 0 NOT NULL,
	"dept_updated" integer DEFAULT 0 NOT NULL,
	"user_created" integer DEFAULT 0 NOT NULL,
	"user_linked" integer DEFAULT 0 NOT NULL,
	"user_updated" integer DEFAULT 0 NOT NULL,
	"user_disabled" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"message" text,
	"error_message" text,
	"triggered_by" integer,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directory_sync_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "directory_sync_source_type" NOT NULL,
	"status" "status" DEFAULT 'disabled' NOT NULL,
	"tenant_id" integer,
	"identity_provider_id" integer,
	"oauth_provider" varchar(32),
	"match_key" varchar(16) DEFAULT 'phone' NOT NULL,
	"field_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scope_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conflict_policy" varchar(16) DEFAULT 'suspend' NOT NULL,
	"lifecycle" jsonb DEFAULT '{"disableOnLeave":true,"kickSessions":true,"defaultRoleIds":[]}'::jsonb NOT NULL,
	"sync_departments" boolean DEFAULT true NOT NULL,
	"cron_expression" varchar(64),
	"circuit_breaker_percent" integer DEFAULT 30 NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" "directory_sync_run_status",
	"remark" text,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "directory_sync_sources_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "directory_sync_user_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" varchar(256) NOT NULL,
	"user_id" integer NOT NULL,
	"external_data" jsonb,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "directory_sync_user_links_source_external_unique" UNIQUE("source_id","external_id"),
	CONSTRAINT "directory_sync_user_links_source_user_unique" UNIQUE("source_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ADD CONSTRAINT "directory_sync_conflicts_source_id_directory_sync_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."directory_sync_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ADD CONSTRAINT "directory_sync_conflicts_run_id_directory_sync_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."directory_sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_conflicts" ADD CONSTRAINT "directory_sync_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_dept_links" ADD CONSTRAINT "directory_sync_dept_links_source_id_directory_sync_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."directory_sync_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_dept_links" ADD CONSTRAINT "directory_sync_dept_links_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_run_items" ADD CONSTRAINT "directory_sync_run_items_run_id_directory_sync_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."directory_sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_source_id_directory_sync_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."directory_sync_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_runs" ADD CONSTRAINT "directory_sync_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD CONSTRAINT "directory_sync_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD CONSTRAINT "directory_sync_sources_identity_provider_id_tenant_identity_providers_id_fk" FOREIGN KEY ("identity_provider_id") REFERENCES "public"."tenant_identity_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD CONSTRAINT "directory_sync_sources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_sources" ADD CONSTRAINT "directory_sync_sources_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_user_links" ADD CONSTRAINT "directory_sync_user_links_source_id_directory_sync_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."directory_sync_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directory_sync_user_links" ADD CONSTRAINT "directory_sync_user_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "directory_sync_conflicts_source_idx" ON "directory_sync_conflicts" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "directory_sync_conflicts_status_idx" ON "directory_sync_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "directory_sync_dept_links_department_idx" ON "directory_sync_dept_links" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "directory_sync_run_items_run_idx" ON "directory_sync_run_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "directory_sync_run_items_action_idx" ON "directory_sync_run_items" USING btree ("action");--> statement-breakpoint
CREATE INDEX "directory_sync_runs_source_idx" ON "directory_sync_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "directory_sync_runs_status_idx" ON "directory_sync_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "directory_sync_sources_status_idx" ON "directory_sync_sources" USING btree ("status");--> statement-breakpoint
CREATE INDEX "directory_sync_user_links_user_idx" ON "directory_sync_user_links" USING btree ("user_id");