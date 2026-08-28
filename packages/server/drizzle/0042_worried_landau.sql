CREATE TYPE "public"."iot_ota_device_status" AS ENUM('pending', 'notified', 'downloading', 'installing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."iot_ota_task_status" AS ENUM('running', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "iot_firmwares" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"version" varchar(32) NOT NULL,
	"file_id" uuid,
	"file_name" varchar(255) NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"release_notes" text,
	"status" "status" DEFAULT 'enabled' NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_online_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_count" integer NOT NULL,
	"online_count" integer NOT NULL,
	"sampled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_ota_task_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"device_id" integer NOT NULL,
	"status" "iot_ota_device_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"from_version" varchar(32),
	"error_msg" varchar(256),
	"notified_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_ota_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(128) NOT NULL,
	"firmware_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"firmware_version" varchar(32) NOT NULL,
	"status" "iot_ota_task_status" DEFAULT 'running' NOT NULL,
	"timeout_minutes" integer DEFAULT 30 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"succeeded_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"tenant_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_telemetry_hourly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" integer NOT NULL,
	"property" varchar(64) NOT NULL,
	"bucket" timestamp NOT NULL,
	"min_value" double precision NOT NULL,
	"max_value" double precision NOT NULL,
	"avg_value" double precision NOT NULL,
	"last_value" double precision NOT NULL,
	"count" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "iot_firmwares" ADD CONSTRAINT "iot_firmwares_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_firmwares" ADD CONSTRAINT "iot_firmwares_file_id_managed_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."managed_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_firmwares" ADD CONSTRAINT "iot_firmwares_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_firmwares" ADD CONSTRAINT "iot_firmwares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_firmwares" ADD CONSTRAINT "iot_firmwares_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ADD CONSTRAINT "iot_ota_task_devices_task_id_iot_ota_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."iot_ota_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_task_devices" ADD CONSTRAINT "iot_ota_task_devices_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD CONSTRAINT "iot_ota_tasks_firmware_id_iot_firmwares_id_fk" FOREIGN KEY ("firmware_id") REFERENCES "public"."iot_firmwares"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD CONSTRAINT "iot_ota_tasks_product_id_iot_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."iot_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD CONSTRAINT "iot_ota_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD CONSTRAINT "iot_ota_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_ota_tasks" ADD CONSTRAINT "iot_ota_tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_telemetry_hourly" ADD CONSTRAINT "iot_telemetry_hourly_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_firmwares_product_version" ON "iot_firmwares" USING btree ("product_id","version");--> statement-breakpoint
CREATE INDEX "idx_iot_online_snapshots_time" ON "iot_online_snapshots" USING btree ("sampled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_ota_task_devices" ON "iot_ota_task_devices" USING btree ("task_id","device_id");--> statement-breakpoint
CREATE INDEX "idx_iot_ota_task_devices_device" ON "iot_ota_task_devices" USING btree ("device_id","status");--> statement-breakpoint
CREATE INDEX "idx_iot_ota_tasks_product" ON "iot_ota_tasks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_iot_ota_tasks_status" ON "iot_ota_tasks" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_iot_telemetry_hourly" ON "iot_telemetry_hourly" USING btree ("device_id","property","bucket");--> statement-breakpoint
CREATE INDEX "idx_iot_telemetry_hourly_bucket" ON "iot_telemetry_hourly" USING btree ("bucket");