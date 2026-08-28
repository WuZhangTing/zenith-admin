CREATE TYPE "public"."iot_schedule_action" AS ENUM('command', 'desired');--> statement-breakpoint
CREATE TYPE "public"."iot_schedule_type" AS ENUM('cron', 'once');--> statement-breakpoint
ALTER TYPE "public"."iot_alarm_status" ADD VALUE 'acknowledged' BEFORE 'resolved';--> statement-breakpoint
ALTER TYPE "public"."iot_ota_task_status" ADD VALUE 'paused' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "iot_device_whitelist" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sn" varchar(64) NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"used_at" timestamp,
	"device_id" integer,
	"remark" varchar(256),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "iot_device_whitelist_sn_unique" UNIQUE("sn")
);
--> statement-breakpoint
CREATE TABLE "iot_maintenance_windows" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"product_id" integer,
	"group_id" integer,
	"device_id" integer,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"reason" varchar(256),
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_schedule_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"schedule_id" integer NOT NULL,
	"schedule_name" varchar(128) NOT NULL,
	"device_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"schedule_type" "iot_schedule_type" NOT NULL,
	"cron_expression" varchar(64),
	"run_at" timestamp,
	"product_id" integer NOT NULL,
	"group_id" integer,
	"device_id" integer,
	"action_type" "iot_schedule_action" NOT NULL,
	"service" varchar(64),
	"params" jsonb,
	"desired" jsonb,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "uq_iot_alarms_active";--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD COLUMN "escalate_after_minutes" integer;--> statement-breakpoint
ALTER TABLE "iot_alarm_rules" ADD COLUMN "escalate_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD COLUMN "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD COLUMN "acknowledged_by" integer;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD COLUMN "escalated_at" timestamp;--> statement-breakpoint
ALTER TABLE "iot_alarms" ADD COLUMN "resolve_note" varchar(512);--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ADD COLUMN "batch_index" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD COLUMN "batch_size" integer;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD COLUMN "current_batch" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD COLUMN "failure_threshold" integer;--> statement-breakpoint
ALTER TABLE "iot_products" ADD COLUMN "registration_secret" varchar(64);--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ADD CONSTRAINT "iot_device_whitelist_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ADD CONSTRAINT "iot_device_whitelist_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ADD CONSTRAINT "iot_device_whitelist_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ADD CONSTRAINT "iot_device_whitelist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_device_whitelist" ADD CONSTRAINT "iot_device_whitelist_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_group_id_iot_device_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."iot_device_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_maintenance_windows" ADD CONSTRAINT "iot_maintenance_windows_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedule_runs" ADD CONSTRAINT "iot_schedule_runs_schedule_id_iot_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."iot_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_group_id_iot_device_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."iot_device_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_schedules" ADD CONSTRAINT "iot_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_iot_device_whitelist_product" ON "iot_device_whitelist" USING btree ("product_id","used");--> statement-breakpoint
CREATE INDEX "idx_iot_maintenance_windows_time" ON "iot_maintenance_windows" USING btree ("start_at","end_at");--> statement-breakpoint
CREATE INDEX "idx_iot_schedule_runs_schedule" ON "iot_schedule_runs" USING btree ("schedule_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_iot_schedules_next_run" ON "iot_schedules" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "idx_iot_schedules_product" ON "iot_schedules" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_alarms_active" ON "iot_alarms" USING btree ("rule_id","device_id") WHERE status <> 'resolved';